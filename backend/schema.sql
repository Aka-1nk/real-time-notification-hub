-- =============================================================
-- Real-Time Notification Hub — Database Schema
-- MySQL 8.0+
-- =============================================================

CREATE DATABASE IF NOT EXISTS notification_hub;
USE notification_hub;

-- -------------------------------------------------------------
-- notifications
-- One row per notification sent by an admin/user.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sender_id VARCHAR(100),
  recipient_count INT DEFAULT 0
);

-- -------------------------------------------------------------
-- notification_events
-- One row per (notification, user, event_type) combination.
-- event_type is one of:
--   'delivered' — user's client acked receipt
--   'opened'    — user clicked the Open button
--   'failed'    — user did not ack within the timeout window
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_events (
  event_id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  event_type ENUM('delivered', 'opened', 'failed') NOT NULL,
  event_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  UNIQUE KEY unique_event (notification_id, user_id, event_type),
  INDEX idx_notification (notification_id),
  INDEX idx_event_type (event_type),
  INDEX idx_user (user_id)
);

-- -------------------------------------------------------------
-- users
-- Optional user metadata for future segmentation.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(100) PRIMARY KEY,
  segment VARCHAR(50) DEFAULT 'general',
  device_type VARCHAR(50) DEFAULT 'unknown',
  first_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- Handy analytics queries (for reference / testing)
-- =============================================================

-- 1. Overview: total counts and open rate across all notifications
-- SELECT
--   (SELECT COUNT(*) FROM notifications) AS total_notifications,
--   (SELECT COUNT(*) FROM notification_events WHERE event_type = 'delivered') AS total_delivered,
--   (SELECT COUNT(*) FROM notification_events WHERE event_type = 'opened')    AS total_opened,
--   (SELECT COUNT(*) FROM notification_events WHERE event_type = 'failed')    AS total_failed,
--   ROUND(
--     (SELECT COUNT(*) FROM notification_events WHERE event_type = 'opened') * 100.0 /
--     NULLIF((SELECT COUNT(*) FROM notification_events WHERE event_type = 'delivered'), 0),
--     2
--   ) AS open_rate_percent;

-- 2. Per-notification breakdown
-- SELECT
--   n.id,
--   n.title,
--   SUM(CASE WHEN e.event_type = 'delivered' THEN 1 ELSE 0 END) AS delivered,
--   SUM(CASE WHEN e.event_type = 'opened'    THEN 1 ELSE 0 END) AS opened,
--   SUM(CASE WHEN e.event_type = 'failed'    THEN 1 ELSE 0 END) AS failed,
--   ROUND(
--     SUM(CASE WHEN e.event_type = 'opened' THEN 1 ELSE 0 END) * 100.0 /
--     NULLIF(SUM(CASE WHEN e.event_type = 'delivered' THEN 1 ELSE 0 END), 0),
--     2
--   ) AS open_rate
-- FROM notifications n
-- LEFT JOIN notification_events e ON n.id = e.notification_id
-- GROUP BY n.id, n.title
-- ORDER BY n.sent_at DESC;

-- 3. Failure rate per notification
-- SELECT
--   n.id,
--   n.title,
--   SUM(CASE WHEN e.event_type = 'failed' THEN 1 ELSE 0 END) AS failed,
--   n.recipient_count,
--   ROUND(
--     SUM(CASE WHEN e.event_type = 'failed' THEN 1 ELSE 0 END) * 100.0 /
--     NULLIF(n.recipient_count, 0),
--     2
--   ) AS failure_rate_percent
-- FROM notifications n
-- LEFT JOIN notification_events e ON n.id = e.notification_id
-- GROUP BY n.id, n.title, n.recipient_count
-- ORDER BY n.sent_at DESC;