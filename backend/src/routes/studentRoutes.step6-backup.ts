import { Router, type Request, type Response } from "express";
import pool from "../config/database.js";

const router = Router();

/**
 * GET /api/students/me
 * Get the logged-in student's profile.
 *
 * TEMPORARY:
 * Until JWT authentication is implemented, userId is supplied
 * through the x-user-id header.
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const result = await pool.query(
      `
      SELECT
        s.id,
        s.user_id,
        s.institute_id,
        s.student_id,
        s.roll_number,
        s.course,
        s.department,
        s.specialization,
        s.admission_year,
        s.graduation_year,
        s.date_of_birth,
        s.address,
        s.city,
        s.state,
        s.country,
        s.profile_completed,
        s.created_at,
        s.updated_at,
        u.full_name,
        u.email
      FROM students s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.user_id = $1
      LIMIT 1
      `,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    return res.json({
      success: true,
      student: result.rows[0],
    });
  } catch (error) {
    console.error("Get student profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch student profile",
    });
  }
});

/**
 * PUT /api/students/me
 * Update the student's profile.
 */
router.put("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const {
      roll_number,
      course,
      department,
      specialization,
      admission_year,
      graduation_year,
      date_of_birth,
      address,
      city,
      state,
      country,
    } = req.body;

    const result = await pool.query(
      `
      UPDATE students
      SET
        roll_number = COALESCE($1, roll_number),
        course = COALESCE($2, course),
        department = COALESCE($3, department),
        specialization = COALESCE($4, specialization),
        admission_year = COALESCE($5, admission_year),
        graduation_year = COALESCE($6, graduation_year),
        date_of_birth = COALESCE($7, date_of_birth),
        address = COALESCE($8, address),
        city = COALESCE($9, city),
        state = COALESCE($10, state),
        country = COALESCE($11, country),
        profile_completed = true,
        updated_at = NOW()
      WHERE user_id = $12
      RETURNING *
      `,
      [
        roll_number,
        course,
        department,
        specialization,
        admission_year,
        graduation_year,
        date_of_birth,
        address,
        city,
        state,
        country,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Student profile not found",
      });
    }

    return res.json({
      success: true,
      message: "Student profile updated",
      student: result.rows[0],
    });
  } catch (error) {
    console.error("Update student profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update student profile",
    });
  }
});

/**
 * GET /api/students/me/records
 * Get academic records belonging to the logged-in student.
 */
router.get("/me/records", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const result = await pool.query(
      `
      SELECT
        ar.*
      FROM academic_records ar
      INNER JOIN students s ON s.id = ar.student_id
      WHERE s.user_id = $1
      ORDER BY ar.issue_date DESC NULLS LAST, ar.created_at DESC
      `,
      [userId]
    );

    return res.json({
      success: true,
      records: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get academic records error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch academic records",
    });
  }
});

/**
 * GET /api/students/me/applications
 * Get jobs the student has applied for.
 */
router.get("/me/applications", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const result = await pool.query(
      `
      SELECT
        a.*,
        j.title AS job_title,
        j.company_id,
        u.full_name AS company_name
      FROM applications a
      INNER JOIN students s
        ON s.id = a.student_id
      INNER JOIN jobs j
        ON j.id = a.job_id
      INNER JOIN users u
        ON u.id = j.company_id
      WHERE s.user_id = $1
      ORDER BY a.created_at DESC
      `,
      [userId]
    );

    return res.json({
      success: true,
      applications: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get student applications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch applications",
    });
  }
});

/**
 * GET /api/students/me/notifications
 * Get notifications for the logged-in student.
 */
router.get("/me/notifications", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const result = await pool.query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId]
    );

    return res.json({
      success: true,
      notifications: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get student notifications error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
});
// =====================================================
// GET ALL OPEN JOBS
// GET /api/students/jobs
// =====================================================

router.get("/jobs", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        j.id,
        j.company_id,
        j.title,
        j.description,
        j.location,
        j.employment_type,
        j.experience_required,
        j.salary_min,
        j.salary_max,
        j.skills,
        j.status,
        j.application_deadline,
        j.created_at,
        c.company_name,
        c.industry,
        c.website
      FROM jobs j
      JOIN companies c
        ON c.id = j.company_id
      WHERE j.status = 'open'
      ORDER BY j.created_at DESC
    `);

    return res.json({
      success: true,
      jobs: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get student jobs error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get jobs",
    });
  }
});
// =====================================================
// APPLY FOR A JOB
// POST /api/students/jobs/:jobId/apply
// =====================================================

router.post(
  "/jobs/:jobId/apply",
  async (req, res) => {
    try {
      const userId = req.header("x-user-id");
      const { jobId } = req.params;
      const { cover_letter } = req.body;
      // ---------------------------------------------
      // Validate user
      // ---------------------------------------------

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "x-user-id header is required",
        });
      }

      // ---------------------------------------------
      // Find student
      // ---------------------------------------------

      const studentResult = await pool.query(
        `
        SELECT
          s.id,
          s.user_id,
          s.student_id,
          u.full_name,
          u.email
        FROM students s
        JOIN users u
          ON u.id = s.user_id
        WHERE s.user_id = $1
          AND u.role = 'student'
        `,
        [userId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Student profile not found",
        });
      }

      const student = studentResult.rows[0];

      // ---------------------------------------------
      // Check job
      // ---------------------------------------------

      const jobResult = await pool.query(
        `
        SELECT
          j.id,
          j.company_id,
          j.title,
          j.status,
          j.application_deadline,
          c.company_name
        FROM jobs j
        JOIN companies c
          ON c.id = j.company_id
        WHERE j.id = $1
        `,
        [jobId]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      const job = jobResult.rows[0];

      // ---------------------------------------------
      // Check job status
      // ---------------------------------------------

      if (job.status !== "open") {
        return res.status(400).json({
          success: false,
          message: "This job is not currently open",
        });
      }

      // ---------------------------------------------
      // Check application deadline
      // ---------------------------------------------

      if (
        job.application_deadline &&
        new Date(job.application_deadline) < new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Application deadline has passed",
        });
      }

      // ---------------------------------------------
      // Check duplicate application
      // ---------------------------------------------

      const existingApplication =
        await pool.query(
          `
          SELECT id, status
          FROM applications
          WHERE job_id = $1
            AND student_id = $2
          `,
          [jobId, student.id]
        );

      if (existingApplication.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "You have already applied for this job",
          application: existingApplication.rows[0],
        });
      }

      // ---------------------------------------------
      // Create application
      // ---------------------------------------------

      const applicationResult =
        await pool.query(
          `
          INSERT INTO applications (
            job_id,
            student_id,
            status,
            cover_letter
          )
          VALUES (
            $1,
            $2,
            'applied',
            $3
          )
          RETURNING *
          `,
          [
            jobId,
            student.id,
            cover_letter || null,
          ]
        );

      const application =
        applicationResult.rows[0];

      // ---------------------------------------------
      // Create company notification
      // ---------------------------------------------

      const companyResult =
        await pool.query(
          `
          SELECT user_id
          FROM companies
          WHERE id = $1
          `,
          [job.company_id]
        );

      if (companyResult.rows.length > 0) {
        const companyUserId =
          companyResult.rows[0].user_id;

        await pool.query(
          `
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_application_id
          )
          VALUES (
            $1,
            'job_application',
            'New Job Application',
            $2,
            $3
          )
          `,
          [
            companyUserId,
            `${student.full_name} applied for ${job.title}`,
            application.id,
          ]
        );
      }

      // ---------------------------------------------
      // Response
      // ---------------------------------------------

      return res.status(201).json({
        success: true,
        message: "Job application submitted successfully",
        application,
        job: {
          id: job.id,
          title: job.title,
          company_name: job.company_name,
        },
        student: {
          id: student.id,
          name: student.full_name,
          email: student.email,
        },
      });
    } catch (error: any) {
      console.error(
        "Apply for job error:",
        error
      );

      // Handle PostgreSQL unique constraint
      // in case of simultaneous duplicate requests
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "You have already applied for this job",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to apply for job",
      });
    }
  }
);
export default router;

