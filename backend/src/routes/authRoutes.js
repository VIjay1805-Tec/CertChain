import { Router } from "express";
import pool from "../config/database.js";
const router = Router();
router.post("/register", async (req, res) => {
    const { name, email, password, role, extra = {} } = req.body;
    if (!name || !email || !password || !role) {
        return res.status(400).json({
            message: "Name, email, password and role are required",
        });
    }
    if (!["student", "institute", "company"].includes(role)) {
        return res.status(400).json({
            message: "Invalid role",
        });
    }
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const existingUser = await client.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [email.trim()]);
        if (existingUser.rows.length > 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                message: "Email already registered",
            });
        }
        const userResult = await client.query(`INSERT INTO users (
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, role, created_at`, [
            name.trim(),
            email.trim().toLowerCase(),
            password,
            role,
        ]);
        const user = userResult.rows[0];
        let entity;
        if (role === "institute") {
            const result = await client.query(`INSERT INTO institutes (
          user_id,
          institute_name,
          address
        )
        VALUES ($1, $2, $3)
        RETURNING *`, [
                user.id,
                name.trim(),
                extra.location || null,
            ]);
            entity = result.rows[0];
        }
        else if (role === "student") {
            const instituteId = extra.instituteId
                ? Number(extra.instituteId)
                : null;
            if (instituteId) {
                const instituteResult = await client.query("SELECT id FROM institutes WHERE id = $1 LIMIT 1", [instituteId]);
                if (instituteResult.rows.length === 0) {
                    await client.query("ROLLBACK");
                    return res.status(400).json({
                        message: "Selected institute does not exist",
                    });
                }
            }
            const result = await client.query(`INSERT INTO students (
          user_id,
          institute_id,
          student_id,
          course,
          profile_completed
        )
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING *`, [
                user.id,
                instituteId,
                extra.enrollmentId || null,
                extra.program || null,
            ]);
            entity = result.rows[0];
        }
        else {
            const result = await client.query(`INSERT INTO companies (
          user_id,
          company_name,
          industry,
          address
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *`, [
                user.id,
                name.trim(),
                extra.industry || null,
                extra.location || null,
            ]);
            entity = result.rows[0];
        }
        await client.query("COMMIT");
        return res.status(201).json({
            message: "Registration successful",
            user,
            entity,
        });
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("Registration error:", error);
        return res.status(500).json({
            message: "Registration failed",
            error: error?.message || "Unknown error",
        });
    }
    finally {
        client.release();
    }
});
router.post("/login", async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password || !role) {
        return res.status(400).json({
            message: "Email, password and role are required",
        });
    }
    if (!["student", "institute", "company"].includes(role)) {
        return res.status(400).json({
            message: "Invalid role",
        });
    }
    try {
        const userResult = await pool.query(`SELECT id, full_name, email, role, password_hash, created_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
         AND role = $2
       LIMIT 1`, [email.trim(), role]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        const user = userResult.rows[0];
        if (user.password_hash !== password) {
            return res.status(401).json({
                message: "Invalid credentials",
            });
        }
        let entity = null;
        if (role === "student") {
            const result = await pool.query(`SELECT *
         FROM students
         WHERE user_id = $1
         LIMIT 1`, [user.id]);
            entity = result.rows[0] || null;
        }
        else if (role === "institute") {
            const result = await pool.query(`SELECT *
         FROM institutes
         WHERE user_id = $1
         LIMIT 1`, [user.id]);
            entity = result.rows[0] || null;
        }
        else {
            const result = await pool.query(`SELECT *
         FROM companies
         WHERE user_id = $1
         LIMIT 1`, [user.id]);
            entity = result.rows[0] || null;
        }
        const safeUser = {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            created_at: user.created_at,
        };
        return res.status(200).json({
            message: "Login successful",
            user: safeUser,
            entity,
        });
    }
    catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            message: "Login failed",
            error: error?.message || "Unknown error",
        });
    }
});
export default router;
//# sourceMappingURL=authRoutes.js.map