# Real-Time Notification Hub

A full-stack real-time notification platform with **persistent MySQL-backed analytics**. Send notifications to connected clients, track delivery/open/failure events per user, and view live metrics — all streamed over Socket.IO.

Built with **React**, **Node.js**, **Express**, **Socket.IO**, and **MySQL**.

---

## Features

- **Real-time broadcasting** — notifications delivered instantly via Socket.IO
- **Delivery tracking** — clients ack receipt; backend logs each event to MySQL
- **Open tracking** — user clicks "Open" → event persisted to SQL
- **Failure detection** — users who don't ack within 5 seconds are logged as `failed`
- **Live analytics dashboard** — delivered / opened / failed counts per notification
- **Full CRUD** — create, read, delete notifications from the dashboard
- **Persistent storage** — all events survive server restarts (stored in MySQL)
- **SQL-aggregated analytics** — open rate and failure rate computed via `GROUP BY`, `CASE`, and `LEFT JOIN`
- **Online users counter** — driven by Socket.IO's connection registry
- **Modern responsive UI** — React + Tailwind CSS

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

### Database
- MySQL 8.0+
- Normalized schema: `notifications`, `notification_events`, `users`

---

## Project Architecture

```text
┌──────────────────────────┐
│   Admin Dashboard        │
│   (React + Tailwind)     │
└────────────┬─────────────┘
             │ Socket.IO
             ▼
┌──────────────────────────┐
│  Express + Socket.IO     │
│  Node.js Backend         │
└────────────┬─────────────┘
             │ mysql2
             ▼
┌──────────────────────────┐
│  MySQL                   │
│  notification_hub DB     │
└──────────────────────────┘
