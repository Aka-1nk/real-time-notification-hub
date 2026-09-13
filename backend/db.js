const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",              // change to your MySQL user
  password: "Ak@1231001",  // change to your MySQL password
  database: "notification_hub",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;