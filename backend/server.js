const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173"
  }
});

let notifications = [];

let analytics = {
  delivered: {},
  opened: {}
};

let onlineUsers = 0;

io.on("connection", (socket) => {

  console.log("User connected:", socket.id);

  onlineUsers++;

  io.emit("online_users", onlineUsers);

  socket.emit("load_notifications", notifications);

  // SEND NOTIFICATION
  socket.on("send_notification", (data) => {

    const notification = {
      id: Date.now(),
      title: data.title,
      message: data.message
    };

    notifications.unshift(notification);

    analytics.delivered[notification.id] = [];
    analytics.opened[notification.id] = [];

    io.emit("receive_notification", notifications);

    io.emit("analytics_update", analytics);
  });

  // DELIVERY ACK
  socket.on("delivery_ack", (data) => {

    const { notificationId, userId } = data;

    if (
      analytics.delivered[notificationId] &&
      !analytics.delivered[notificationId].includes(userId)
    ) {
      analytics.delivered[notificationId].push(userId);
    }

    io.emit("analytics_update", analytics);
  });

  // OPEN TRACKING
  socket.on("notification_opened", (data) => {

    const { notificationId, userId } = data;

    if (
      analytics.opened[notificationId] &&
      !analytics.opened[notificationId].includes(userId)
    ) {
      analytics.opened[notificationId].push(userId);
    }

    io.emit("analytics_update", analytics);
  });

  socket.on("disconnect", () => {

    onlineUsers--;

    io.emit("online_users", onlineUsers);

    console.log("User disconnected:", socket.id);

  });

});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});