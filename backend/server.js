const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173"
  }
});

let onlineUsers = 0;

// Track connected socket ids per notification for failure detection
// Map: notificationId -> Set of socketIds that were online at send time
const pendingDeliveries = new Map();

// Timeout in milliseconds — user must ack within this window
const DELIVERY_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------
// Helper: fetch all notifications from DB
// ---------------------------------------------------------------
async function getAllNotifications() {
  const [rows] = await pool.query(
    "SELECT id, title, message, sent_at FROM notifications ORDER BY sent_at DESC"
  );
  return rows;
}

// ---------------------------------------------------------------
// Helper: compute analytics from DB
// ---------------------------------------------------------------
async function getAnalytics() {
  const [rows] = await pool.query(`
    SELECT
      n.id AS notificationId,
      n.title,
      SUM(CASE WHEN e.event_type = 'delivered' THEN 1 ELSE 0 END) AS delivered,
      SUM(CASE WHEN e.event_type = 'opened' THEN 1 ELSE 0 END) AS opened,
      SUM(CASE WHEN e.event_type = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM notifications n
    LEFT JOIN notification_events e ON n.id = e.notification_id
    GROUP BY n.id, n.title
    ORDER BY n.sent_at DESC
  `);

  const analytics = {
    delivered: {},
    opened: {},
    failed: {}
  };

  rows.forEach((row) => {
    // Wrap in array so frontend .length works
    analytics.delivered[row.notificationId] = new Array(
      Number(row.delivered) || 0
    ).fill(1);
    analytics.opened[row.notificationId] = new Array(
      Number(row.opened) || 0
    ).fill(1);
    analytics.failed[row.notificationId] = new Array(
      Number(row.failed) || 0
    ).fill(1);
  });

  return analytics;
}

// ---------------------------------------------------------------
// Helper: after timeout, mark non-acked users as failed
// ---------------------------------------------------------------
async function finalizeDeliveries(notificationId) {
  const pending = pendingDeliveries.get(notificationId);
  if (!pending) return;

  // pending.deliveredSockets = Set of socketIds that acked
  // pending.allSockets = Set of socketIds that were online when notification sent
  for (const socketId of pending.allSockets) {
    if (!pending.deliveredSockets.has(socketId)) {
      try {
        await pool.query(
          `INSERT IGNORE INTO notification_events
           (notification_id, user_id, event_type)
           VALUES (?, ?, 'failed')`,
          [notificationId, socketId]
        );
      } catch (err) {
        console.error("Failed to insert failure event:", err);
      }
    }
  }

  pendingDeliveries.delete(notificationId);

  // Push fresh analytics to all clients
  const analytics = await getAnalytics();
  io.emit("analytics_update", analytics);
}

// ---------------------------------------------------------------
// Socket.IO
// ---------------------------------------------------------------
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  onlineUsers++;
  io.emit("online_users", onlineUsers);

  // Load existing notifications + analytics on connect
  (async () => {
    try {
      const notifications = await getAllNotifications();
      socket.emit("load_notifications", notifications);

      const analytics = await getAnalytics();
      socket.emit("analytics_update", analytics);
    } catch (err) {
      console.error("Initial load error:", err);
    }
  })();

  // SEND NOTIFICATION
  socket.on("send_notification", async (data) => {
    try {
      const id = Date.now();

      // Get all currently-connected socket ids
      const connectedSockets = Array.from(io.sockets.sockets.keys());
      const recipientCount = connectedSockets.length;

      await pool.query(
        `INSERT INTO notifications (id, title, message, sender_id, recipient_count)
         VALUES (?, ?, ?, ?, ?)`,
        [id, data.title, data.message, socket.id, recipientCount]
      );

      // Track this notification's pending deliveries
      pendingDeliveries.set(id, {
        allSockets: new Set(connectedSockets),
        deliveredSockets: new Set()
      });

      // Schedule failure check
      setTimeout(() => {
        finalizeDeliveries(id).catch((err) =>
          console.error("finalizeDeliveries error:", err)
        );
      }, DELIVERY_TIMEOUT_MS);

      const notifications = await getAllNotifications();
      io.emit("receive_notification", notifications);

      const analytics = await getAnalytics();
      io.emit("analytics_update", analytics);
    } catch (err) {
      console.error("send_notification error:", err);
    }
  });

  // DELIVERY ACK
  socket.on("delivery_ack", async (data) => {
    const { notificationId, userId } = data;

    try {
      await pool.query(
        `INSERT IGNORE INTO notification_events
         (notification_id, user_id, event_type)
         VALUES (?, ?, 'delivered')`,
        [notificationId, userId]
      );

      // Mark this socket as delivered in the pending tracker
      const pending = pendingDeliveries.get(notificationId);
      if (pending) {
        pending.deliveredSockets.add(socket.id);
      }

      const analytics = await getAnalytics();
      io.emit("analytics_update", analytics);
    } catch (err) {
      console.error("delivery_ack error:", err);
    }
  });

  // OPEN TRACKING
  socket.on("notification_opened", async (data) => {
    const { notificationId, userId } = data;

    try {
      await pool.query(
        `INSERT IGNORE INTO notification_events
         (notification_id, user_id, event_type)
         VALUES (?, ?, 'opened')`,
        [notificationId, userId]
      );

      const analytics = await getAnalytics();
      io.emit("analytics_update", analytics);
    } catch (err) {
      console.error("notification_opened error:", err);
    }
  });
    // DELETE NOTIFICATION
  socket.on("delete_notification", async (data) => {
    const { notificationId } = data;

    try {
      await pool.query(
        "DELETE FROM notifications WHERE id = ?",
        [notificationId]
      );

      const notifications = await getAllNotifications();
      io.emit("receive_notification", notifications);

      const analytics = await getAnalytics();
      io.emit("analytics_update", analytics);
    } catch (err) {
      console.error("delete_notification error:", err);
    }
  });

  socket.on("disconnect", () => {
    onlineUsers--;
    io.emit("online_users", onlineUsers);
    console.log("User disconnected:", socket.id);
  });
});

// ---------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------
app.get("/analytics/overview", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM notifications) AS total_notifications,
        (SELECT COUNT(*) FROM notification_events WHERE event_type = 'delivered') AS total_delivered,
        (SELECT COUNT(*) FROM notification_events WHERE event_type = 'opened') AS total_opened,
        (SELECT COUNT(*) FROM notification_events WHERE event_type = 'failed') AS total_failed,
        ROUND(
          (SELECT COUNT(*) FROM notification_events WHERE event_type = 'opened') * 100.0 /
          NULLIF((SELECT COUNT(*) FROM notification_events WHERE event_type = 'delivered'), 0),
          2
        ) AS open_rate_percent
    `);

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/analytics/per-notification", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        n.id,
        n.title,
        SUM(CASE WHEN e.event_type = 'delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN e.event_type = 'opened' THEN 1 ELSE 0 END) AS opened,
        SUM(CASE WHEN e.event_type = 'failed' THEN 1 ELSE 0 END) AS failed,
        ROUND(
          SUM(CASE WHEN e.event_type = 'opened' THEN 1 ELSE 0 END) * 100.0 /
          NULLIF(SUM(CASE WHEN e.event_type = 'delivered' THEN 1 ELSE 0 END), 0),
          2
        ) AS open_rate
      FROM notifications n
      LEFT JOIN notification_events e ON n.id = e.notification_id
      GROUP BY n.id, n.title
      ORDER BY n.sent_at DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});