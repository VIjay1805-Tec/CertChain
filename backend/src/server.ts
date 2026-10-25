import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import pool from "./config/database.js";
import studentRoutes from "./routes/studentRoutes.js";
import instituteRoutes from "./routes/instituteRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import authRoutes from "./routes/authRoutes.js";

dotenv.config();

const app = express();

// ========================================
// CORS
// ========================================
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// ========================================
// BODY PARSER
// ========================================
app.use(express.json());

// ========================================
// HEALTH CHECK
// ========================================
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "CertChain backend is running",
  });
});

// ========================================
// DATABASE TEST
// ========================================
app.get("/api/db-test", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    res.json({
      success: true,
      message: "PostgreSQL connected successfully",
      databaseTime: result.rows[0].current_time,
    });
  } catch (error) {
    console.error(
      "PostgreSQL connection error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "PostgreSQL connection failed",
    });
  }
});

// ========================================
// STUDENT ROUTES
// ========================================
//
// Base URL:
// http://localhost:5000/api/students
//
// Examples:
//
// GET /api/students/me
// PUT /api/students/me
// GET /api/students/me/records
// GET /api/students/me/applications
// GET /api/students/me/notifications
//
app.use("/api/students", studentRoutes);

// ========================================
// INSTITUTE ROUTES
// ========================================
//
// Base URL:
// http://localhost:5000/api/institutes
//
// Examples:
//
// GET  /api/institutes/me
// GET  /api/institutes/me/students
// POST /api/institutes/me/students
// GET  /api/institutes/me/academic-records
// POST /api/institutes/me/academic-records
// GET  /api/institutes/me/applications
// GET  /api/institutes/me/notifications
//
app.use("/api/institutes", instituteRoutes);

// ========================================
// COMPANY ROUTES
// ========================================
//
// Base URL:
// http://localhost:5000/api/companies
//
// Examples:
//
// GET  /api/companies/me
// POST /api/companies/me/jobs
// GET  /api/companies/me/jobs
// GET  /api/companies/jobs
//
app.use("/api/companies", companyRoutes);
app.use("/api/auth", authRoutes);

// ========================================
// TEST DATABASE CONNECTION ON STARTUP
// ========================================
pool
  .query("SELECT NOW()")
  .then(() => {
    console.log("PostgreSQL connected successfully");
  })
  .catch((error: unknown) => {
  console.error(
    "PostgreSQL connection failed:",
    error instanceof Error ? error.message : error
  );
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(
    `CertChain backend running on http://localhost:${PORT}`
  );
});

