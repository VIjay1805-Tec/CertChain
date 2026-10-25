import pool from "./src/config/database.js";

try {
  const result = await pool.query(
    "SELECT u.id, u.email, u.role, c.company_name FROM users u LEFT JOIN companies c ON c.user_id = u.id WHERE u.role = $1 ORDER BY u.id LIMIT 20",
    ["company"]
  );
  console.table(result.rows);
} catch (error) {
  console.error(error.message);
} finally {
  await pool.end();
}

