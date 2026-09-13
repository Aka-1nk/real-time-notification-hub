const pool = require("./db");

(async () => {
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS result");
    console.log("DB connected ✅", rows);

    const [tables] = await pool.query("SHOW TABLES");
    console.log("Tables:", tables);
  } catch (err) {
    console.error("DB connection failed ❌", err.message);
  } finally {
    process.exit(0);
  }
})();