import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

try {
  const result = await pool.query(
    "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'verification_requests'::regclass AND contype = 'c'"
  );
  console.log(JSON.stringify(result.rows, null, 2));
} catch (error) {
  console.log("Schema check failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
