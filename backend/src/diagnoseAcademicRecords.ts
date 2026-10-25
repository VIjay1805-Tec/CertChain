import pool from "./config/database.js";

async function main() {
  try {
    const result = await pool.query(`
      SELECT
        u.id AS institute_user_id,
        u.email AS institute_email,
        i.id AS institute_id,
        i.institute_name,
        s.id AS student_id,
        su.email AS student_email,
        s.institute_id AS student_institute_id,
        ar.id AS academic_record_id,
        ar.institute_id AS record_institute_id
      FROM institutes i
      JOIN users u ON u.id = i.user_id
      LEFT JOIN students s ON TRUE
      LEFT JOIN users su ON su.id = s.user_id
      LEFT JOIN academic_records ar ON ar.student_id = s.id
      ORDER BY i.id, s.id, ar.id
      LIMIT 100
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("Diagnostic query failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
