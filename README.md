# Real-Time Notification Hub

A full-stack real-time notification delivery platform built using React, Node.js, Express, Socket.IO, and MySQL.

This system allows admin users to send live notifications to connected users while tracking delivery analytics, opened notifications, failed deliveries, and active users in real time.

---

## 🆕 What's New (Recent Updates)

- **MySQL integration** — all notifications and events are now persisted in a normalized MySQL schema (`notifications`, `notification_events`, `users`), replacing in-memory storage
- **Failure tracking** — added timeout-based failure detection: users who don't acknowledge a notification within 5 seconds are logged as `failed` events
- **Delete feature** — full CRUD support; deleting a notification automatically cascades and removes its associated events
- **SQL analytics** — open rate and failure rate are now computed via SQL aggregation (`GROUP BY`, `CASE`, `LEFT JOIN`) instead of client-side calculations
- **REST endpoints** — added `/analytics/overview` and `/analytics/per-notification` for programmatic access to analytics
- **Persistence** — data survives server restarts, enabling historical analysis across sessions

---

## Features

- Real-time notification broadcasting
- Live analytics dashboard (delivered / opened / failed)
- Delivery tracking system
- Notification open tracking
- Failure detection with 5-second timeout
- Full CRUD on notifications (create, read, delete)
- Online users counter
- Modern responsive UI
- Socket.IO real-time communication
- React frontend + Express backend architecture
- MySQL-backed persistent storage

---

## Tech Stack

### Frontend
- React
- Tailwind CSS
- Socket.IO Client

### Backend
- Node.js
- Express.js
- Socket.IO
- MySQL (`mysql2` driver)

---
## Screenshot
<img width="1917" height="1008" alt="image" src="https://github.com/user-attachments/assets/6bf31969-7e00-4078-a2b8-dd47558733fb" />

## Project Architecture

```text
Admin Dashboard
       ↓
Express + Socket.IO Backend
       ↓
MySQL (notification_hub)
       ↓
Connected Web Clients



