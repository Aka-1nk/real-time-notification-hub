import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function App() {

  const [notifications, setNotifications] = useState([]);

  const [analytics, setAnalytics] = useState({
    delivered: {},
    opened: {},
    failed: {}
  });

  const [onlineUsers, setOnlineUsers] = useState(0);

  const [title, setTitle] = useState("");

  const [message, setMessage] = useState("");

  const [openedByMe, setOpenedByMe] = useState({});

  useEffect(() => {

    socket.on("load_notifications", (data) => {
      setNotifications(data);
    });

    socket.on("receive_notification", (data) => {

      setNotifications(data);

      const latest = data[0];

      if (latest) {
        socket.emit("delivery_ack", {
          notificationId: latest.id,
          userId: socket.id
        });
      }

    });

    socket.on("analytics_update", (data) => {
      setAnalytics(data);
    });

    socket.on("online_users", (count) => {
      setOnlineUsers(count);
    });

    return () => {
      socket.off("load_notifications");
      socket.off("receive_notification");
      socket.off("analytics_update");
      socket.off("online_users");
    };

  }, []);

  const sendNotification = () => {

    if (title.trim() === "" || message.trim() === "") return;

    socket.emit("send_notification", {
      title,
      message
    });

    setTitle("");
    setMessage("");

  };

  const openNotification = (note) => {

    socket.emit("notification_opened", {
      notificationId: note.id,
      userId: socket.id
    });

    setOpenedByMe((prev) => ({
      ...prev,
      [note.id]: true
    }));

  };

  const deleteNotification = (note) => {

    const confirmed = window.confirm(
      `Delete notification "${note.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    socket.emit("delete_notification", {
      notificationId: note.id
    });

    // Also clean local opened-state so it doesn't leak
    setOpenedByMe((prev) => {
      const next = { ...prev };
      delete next[note.id];
      return next;
    });

  };

  return (

    <div className="min-h-screen bg-slate-950 text-white p-6">

      <div className="max-w-6xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">

          <div>
            <h1 className="text-5xl font-bold">
              Real-Time Notification Hub
            </h1>

            <p className="text-slate-400 mt-2">
              Live notification delivery & analytics dashboard
            </p>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700">
            <p className="text-slate-400">
              Online Users
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {onlineUsers}
            </h2>
          </div>

        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT PANEL */}
          <div className="bg-slate-900 rounded-3xl border border-slate-700 p-6">

            <h2 className="text-2xl font-semibold mb-6">
              Send Notification
            </h2>

            <div className="space-y-4">

              <input
                type="text"
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none"
              />

              <textarea
                rows="5"
                placeholder="Write your message here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none resize-none"
              />

              <button
                onClick={sendNotification}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition rounded-xl py-3 font-semibold cursor-pointer"
              >
                Send Notification
              </button>

            </div>

          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-2 bg-slate-900 rounded-3xl border border-slate-700 p-6">

            <div className="flex justify-between items-center mb-6">

              <h2 className="text-2xl font-semibold">
                Live Notifications
              </h2>

              <div className="text-green-400 font-medium">
                ● Live
              </div>

            </div>

            <div className="space-y-5">

              {notifications.length === 0 && (
                <div className="text-slate-500 text-center py-16">
                  No notifications yet. Send one from the left panel.
                </div>
              )}

              {notifications.map((note) => {

                const deliveredCount = analytics.delivered[note.id]
                  ? analytics.delivered[note.id].length
                  : 0;

                const openedCount = analytics.opened[note.id]
                  ? analytics.opened[note.id].length
                  : 0;

                const failedCount = analytics.failed && analytics.failed[note.id]
                  ? analytics.failed[note.id].length
                  : 0;

                const isOpenedByMe = openedByMe[note.id];

                return (

                  <div
                    key={note.id}
                    className="bg-slate-800 border border-slate-700 rounded-2xl p-5"
                  >

                    <div className="flex justify-between items-start gap-4">

                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-2">
                          {note.title}
                        </h3>

                        <p className="text-slate-400">
                          {note.message}
                        </p>
                      </div>

                      <div className="flex gap-2 shrink-0">

                        <button
                          onClick={() => openNotification(note)}
                          disabled={isOpenedByMe}
                          className={
                            isOpenedByMe
                              ? "bg-slate-700 text-slate-400 px-3 py-1 rounded-full cursor-default"
                              : "bg-green-500/20 text-green-400 px-3 py-1 rounded-full hover:bg-green-500/40 active:scale-95 transition cursor-pointer"
                          }
                        >
                          {isOpenedByMe ? "Opened ✓" : "Open"}
                        </button>

                        <button
                          onClick={() => deleteNotification(note)}
                          className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full hover:bg-red-500/40 active:scale-95 transition cursor-pointer"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                    {/* STATS */}
                    <div className="grid grid-cols-3 gap-4 mt-6">

                      <div className="bg-slate-900 rounded-xl p-4 text-center">

                        <p className="text-slate-400 text-sm">
                          Delivered
                        </p>

                        <h4 className="text-2xl font-bold text-green-400 mt-2">
                          {deliveredCount}
                        </h4>

                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 text-center">

                        <p className="text-slate-400 text-sm">
                          Opened
                        </p>

                        <h4 className="text-2xl font-bold text-yellow-400 mt-2">
                          {openedCount}
                        </h4>

                      </div>

                      <div className="bg-slate-900 rounded-xl p-4 text-center">

                        <p className="text-slate-400 text-sm">
                          Failed
                        </p>

                        <h4 className="text-2xl font-bold text-red-400 mt-2">
                          {failedCount}
                        </h4>

                      </div>

                    </div>

                  </div>

                );

              })}

            </div>

          </div>

        </div>

      </div>

    </div>

  );
}