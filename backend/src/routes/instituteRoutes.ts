import { uploadCertificateToIPFS } from "../blockchain/pinataService.js";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import crypto from "node:crypto";
import pool from "../config/database.js";
import {
  issueCertificate,
  verifyCertificate,
} from "../blockchain/certificateService.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/**
 * GET /api/institutes
 *
 * Get institutes available for student registration.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, institute_name FROM institutes ORDER BY institute_name ASC"
    );

    return res.json({
      success: true,
      institutes: result.rows,
    });
  } catch (error) {
    console.error("Get institutes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institutes",
    });
  }
});
/**
 * GET /api/institutes/me
 *
 * Get institute profile for the logged-in institute user.
 *
 * TEMPORARY AUTH:
 * x-user-id header
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.user_id,
        i.institute_name,
        i.registration_number,
        i.address,
        i.city,
        i.state,
        i.country,
        i.website,
        i.created_at,
        i.updated_at,
        u.full_name,
        u.email,
        u.phone
      FROM institutes i
      INNER JOIN users u
        ON u.id = i.user_id
      WHERE i.user_id = $1
      LIMIT 1
      `,
      [resolvedUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Institute profile not found",
      });
    }

    return res.json({
      success: true,
      institute: result.rows[0],
    });
  } catch (error) {
    console.error("Get institute profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institute profile",
    });
  }
});

/**
 * GET /api/institutes
 *
 * Get institutes available for student registration.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, institute_name FROM institutes ORDER BY institute_name ASC"
    );

    return res.json({
      success: true,
      institutes: result.rows,
    });
  } catch (error) {
    console.error("Get institutes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institutes",
    });
  }
});
/**
 * GET /api/institutes/me/students
 *
 * Get all students belonging to this institute.
 */
router.get("/me/students", async (req: Request, res: Response) => {
  try {
    const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Missing x-user-id header",
      });
    }

    const instituteResult = await pool.query(
      `
      SELECT id
      FROM institutes
      WHERE user_id = $1
      LIMIT 1
      `,
      [resolvedUserId]
    );

    if (instituteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Institute profile not found",
      });
    }

    const instituteId = instituteResult.rows[0].id;

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
        s.profile_completed,
        u.full_name,
        u.email,
        u.phone,
        s.created_at,
        s.updated_at
      FROM students s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE s.institute_id = $1
      ORDER BY s.created_at DESC
      `,
      [instituteId]
    );

    return res.json({
      success: true,
      students: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("Get institute students error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch students",
    });
  }
});

/**
 * POST /api/institutes/me/students
 *
 * Add an existing user as a student.
 *
 * Body:
 * {
 *   "user_id": 2,
 *   "student_id": "STU002",
 *   "roll_number": "ROLL002",
 *   "course": "Computer Science",
 *   "department": "Computer Science",
 *   "specialization": "Blockchain Technology",
 *   "admission_year": 2024,
 *   "graduation_year": 2028
 * }
 */
router.post("/me/students", async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const instituteUserId = req.header("x-user-id");
    const instituteUserEmail = req.header("x-user-email");

    if (!instituteUserId && !instituteUserEmail) {
      return res.status(401).json({
        success: false,
        message: "Missing institute identity headers",
      });
    }

    const {
      fullName,
      email,
      enrollmentId,
      program,
      user_id,
      student_id,
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

    const finalFullName = String(fullName || "").trim();
    const finalEmail = String(email || "").trim().toLowerCase();
    const finalStudentId = String(enrollmentId || student_id || "").trim();
    const finalCourse = String(program || course || "").trim();

    if (!finalFullName || !finalEmail || !finalStudentId || !finalCourse) {
      return res.status(400).json({
        success: false,
        message: "fullName, email, enrollmentId and program are required",
      });
    }

    let resolvedInstituteUserId = instituteUserId;

    if (instituteUserEmail) {
      const instituteUserResult = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND role = 'institute' LIMIT 1",
        [instituteUserEmail]
      );

      if (instituteUserResult.rows.length > 0) {
        resolvedInstituteUserId = String(instituteUserResult.rows[0].id);
      }
    }

    if (!resolvedInstituteUserId) {
      return res.status(404).json({
        success: false,
        message: "Institute user not found",
      });
    }

    const instituteResult = await pool.query(
      `
      SELECT id
      FROM institutes
      WHERE user_id = $1
      LIMIT 1
      `,
      [resolvedInstituteUserId]
    );

    if (instituteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Institute profile not found",
      });
    }

    const instituteId = instituteResult.rows[0].id;

    const existingUser = await pool.query(
      `
      SELECT id, role
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
      `,
      [finalEmail]
    );

    if (existingUser.rows.length > 0) {
      const existingUserId = existingUser.rows[0].id;

      if (existingUser.rows[0].role !== "student") {
        return res.status(409).json({
          success: false,
          message: "A non-student user already exists with this email",
        });
      }

      const existingStudent = await pool.query(
        `
        SELECT id
        FROM students
        WHERE user_id = $1
        LIMIT 1
        `,
        [existingUserId]
      );

      if (existingStudent.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Student profile already exists",
        });
      }
    }

    await client.query("BEGIN");

    let studentUserId: number;

    if (existingUser.rows.length > 0) {
      studentUserId = Number(existingUser.rows[0].id);
    } else {
      const newUserResult = await client.query(
        `
        INSERT INTO users (
          full_name,
          email,
          password_hash,
          role
        )
        VALUES ($1, $2, $3, 'student')
        RETURNING id
        `,
        [
          finalFullName,
          finalEmail,
          `mock_${finalEmail}`,
        ]
      );

      studentUserId = Number(newUserResult.rows[0].id);
    }

    const result = await client.query(
      `
      INSERT INTO students (
        user_id,
        institute_id,
        student_id,
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
        profile_completed
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, true
      )
      RETURNING *
      `,
      [
        studentUserId,
        instituteId,
        finalStudentId,
        roll_number || finalStudentId,
        finalCourse,
        department || null,
        specialization || null,
        admission_year || null,
        graduation_year || null,
        date_of_birth || null,
        address || null,
        city || null,
        state || null,
        country || null,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Student added successfully",
      student: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Add student failed:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add student",
    });
  } finally {
    client.release();
  }
});
router.get(
  "/me/academic-records",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id header",
        });
      }

      const result = await pool.query(
        `
        SELECT
          ar.*,
            s.student_id AS student_code,
          s.roll_number,
          u.full_name AS student_name,
          u.email AS student_email
        FROM academic_records ar
        INNER JOIN students s
          ON s.id = ar.student_id
        INNER JOIN users u
          ON u.id = s.user_id

        INNER JOIN institutes i
          ON i.id = ar.institute_id
        WHERE i.user_id = $1
        ORDER BY ar.created_at DESC
        `,
        [resolvedUserId]
      );

      return res.json({
        success: true,
        records: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      console.error(
        "Get institute academic records error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch academic records",
      });
    }
  }
);

/**
 * POST /api/institutes/me/academic-records
 *
 * Create an academic record for a student.
 */
router.post(
  "/me/academic-records",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id header",
        });
      }

      const {
        student_id,
        record_type,
        title,
        course,
        department,
        grade,
        percentage,
        cgpa,
        issue_date,
        completion_date,
        description,
      } = req.body;

      if (!student_id || !record_type || !title) {
        return res.status(400).json({
          success: false,
          message:
            "student_id, record_type and title are required",
        });
      }

      // Find institute
      const instituteResult = await pool.query(
        `
        SELECT id
        FROM institutes
        WHERE user_id = $1
        LIMIT 1
        `,
        [resolvedUserId]
      );

      if (instituteResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Institute profile not found",
        });
      }

      const instituteId = instituteResult.rows[0].id;

      // Make sure student belongs to institute
      const studentResult = await pool.query(
        `
        SELECT id
        FROM students
        WHERE id = $1
          AND institute_id = $2
        LIMIT 1
        `,
        [student_id, instituteId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Student not found or student does not belong to this institute",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO academic_records (
          student_id,
          institute_id,
          record_type,
          title,
          course,
          department,
          grade,
          percentage,
          cgpa,
          issue_date,
          completion_date,
          description,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          'active'
        )
        RETURNING *
        `,
        [
          student_id,
          instituteId,
          record_type,
          title,
          course,
          department,
          grade,
          percentage,
          cgpa,
          issue_date,
          completion_date,
          description,
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Academic record created successfully",
        record: result.rows[0],
      });
    } catch (error) {
      console.error("Create academic record error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create academic record",
      });
    }
  }
);


/**
 * PATCH /api/institutes/me/academic-records/:recordId
 *
 * Update an existing academic record owned by this institute.
 */
router.patch(
  "/me/academic-records/:recordId",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id header",
        });
      }

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );

        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

      const recordId = Number(req.params.recordId);

      if (!Number.isInteger(recordId) || recordId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid academic record ID",
        });
      }

      const {
        student_id,
        record_type,
        title,
        course,
        department,
        grade,
        percentage,
        cgpa,
        issue_date,
        completion_date,
        description,
      } = req.body;

      if (!student_id || !record_type || !title) {
        return res.status(400).json({
          success: false,
          message: "student_id, record_type and title are required",
        });
      }

      const instituteResult = await pool.query(
        "SELECT id FROM institutes WHERE user_id = $1 LIMIT 1",
        [resolvedUserId]
      );

      if (instituteResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Institute profile not found",
        });
      }

      const instituteId = instituteResult.rows[0].id;

      const studentResult = await pool.query(
        `SELECT id FROM students
         WHERE id = $1 AND institute_id = $2 LIMIT 1`,
        [student_id, instituteId]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Student not found or does not belong to this institute",
        });
      }

      const result = await pool.query(
        `UPDATE academic_records
         SET student_id = $1,
             record_type = $2,
             title = $3,
             course = $4,
             department = $5,
             grade = $6,
             percentage = $7,
             cgpa = $8,
             issue_date = $9,
             completion_date = $10,
             description = $11,
             updated_at = NOW()
         WHERE id = $12 AND institute_id = $13
         RETURNING *`,
        [
          student_id,
          record_type,
          title,
          course ?? null,
          department ?? null,
          grade ?? null,
          percentage ?? null,
          cgpa ?? null,
          issue_date ?? null,
          completion_date ?? null,
          description ?? null,
          recordId,
          instituteId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Academic record not found for this institute",
        });
      }

      return res.json({
        success: true,
        message: "Academic record updated successfully",
        record: result.rows[0],
      });
    } catch (error) {
      console.error("Update academic record error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update academic record",
      });
    }
  }
);


/**
 * GET /api/institutes
 *
 * Get institutes available for student registration.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, institute_name FROM institutes ORDER BY institute_name ASC"
    );

    return res.json({
      success: true,
      institutes: result.rows,
    });
  } catch (error) {
    console.error("Get institutes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institutes",
    });
  }
});
/**
 * GET /api/institutes/me/applications
 *
 * See job applications from students belonging to this institute.
 */
router.get(
  "/me/applications",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id header",
        });
      }

      const result = await pool.query(
        `
        SELECT
          a.id,
          a.job_id,
          a.student_id,
          a.status,
          a.cover_letter,
          a.applied_at,
          a.updated_at,

          s.student_id AS student_code,
          s.roll_number,
          s.course,

          student_user.full_name AS student_name,
          student_user.email AS student_email,

          j.title AS job_title,

          company_user.full_name AS company_name,
            ac.application_certificate_id,
            ac.certificate_id,
            ac.submitted_file_name,
            ac.submitted_sha256_hash,
            ac.submitted_ipfs_cid,
            cert.ipfs_url AS certificate_ipfs_url,
            cert.transaction_hash AS certificate_transaction_hash,
            cert.blockchain_status AS certificate_blockchain_status,
            cert.verification_status AS certificate_verification_status
        FROM applications a

        INNER JOIN students s
          ON s.id = a.student_id

        INNER JOIN users student_user
          ON student_user.id = s.user_id

        INNER JOIN jobs j
          ON j.id = a.job_id

        INNER JOIN companies c
          ON c.id = j.company_id

        INNER JOIN users company_user
          ON company_user.id = c.user_id


        LEFT JOIN LATERAL (
          SELECT
            ac.id AS application_certificate_id,
            ac.certificate_id,
            ac.submitted_file_name,
            ac.submitted_sha256_hash,
            ac.submitted_ipfs_cid
          FROM application_certificates ac
          WHERE ac.application_id = a.id
          ORDER BY ac.created_at DESC
          LIMIT 1
        ) ac ON true

        LEFT JOIN certificates cert
          ON cert.id = ac.certificate_id

        INNER JOIN institutes i
          ON i.id = s.institute_id

        WHERE i.user_id = $1

        ORDER BY a.applied_at DESC
        `,
        [resolvedUserId]
      );

      return res.json({
        success: true,
        applications: result.rows,
        count: result.rows.length,
      });
    } catch (error) {
      console.error(
        "Get institute applications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch applications",
      });
    }
  }
);

/**
 * GET /api/institutes
 *
 * Get institutes available for student registration.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, institute_name FROM institutes ORDER BY institute_name ASC"
    );

    return res.json({
      success: true,
      institutes: result.rows,
    });
  } catch (error) {
    console.error("Get institutes error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch institutes",
    });
  }
});
/**
 * GET /api/institutes/me/notifications
 *
 * Get institute notifications.
 */
router.get(
  "/me/notifications",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

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
      console.error(
        "Get institute notifications error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to fetch notifications",
      });
    }
  }
);

/**
 * POST /api/institutes/me/certificates
 *
 * Issue a certificate for an academic record.
 *
 * Flow:
 * 1. Verify institute
 * 2. Verify academic record belongs to institute
 * 3. Create SHA-256 certificate hash
 * 4. Save certificate as pending in PostgreSQL
 * 5. Issue certificate hash on blockchain
 * 6. Save blockchain certificate ID + transaction hash
 */
router.post(
  "/me/certificates",
  upload.single("certificate"),
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id header",
        });
      }

      const {
        academic_record_id,
          application_id,
          original_file_name,
        mime_type,
      } = req.body;

      // ---------------------------------------------
      // Validate request
      // ---------------------------------------------

      if (!academic_record_id) {
        return res.status(400).json({
          success: false,
          message: "academic_record_id is required",
        });
      }

      if (!application_id) {
          return res.status(400).json({
            success: false,
            message: "application_id is required",
          });
        }

        if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "certificate file is required",
        });
      }

      // ---------------------------------------------
      // Find institute
      // ---------------------------------------------

      const instituteResult = await pool.query(
        `
        SELECT id, institute_name
        FROM institutes
        WHERE user_id = $1
        LIMIT 1
        `,
        [resolvedUserId]
      );

      if (instituteResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Institute profile not found",
        });
      }

      const institute = instituteResult.rows[0];

      // ---------------------------------------------
      // Find academic record
      // ---------------------------------------------

      const recordResult = await pool.query(
        `
        SELECT
          ar.id,
          ar.student_id,
          ar.institute_id,
          ar.record_type,
          ar.title,
          ar.course,
          ar.department,
          ar.grade,
          ar.percentage,
          ar.cgpa,
          ar.issue_date,
          ar.completion_date,
          ar.description,
          s.student_id AS student_code,
          s.roll_number,
          u.full_name AS student_name
        FROM academic_records ar
        INNER JOIN students s
          ON s.id = ar.student_id
        INNER JOIN users u
          ON u.id = s.user_id
        WHERE ar.id = $1
          AND ar.institute_id = $2
        LIMIT 1
        `,
        [academic_record_id, institute.id]
      );

      if (recordResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Academic record not found or does not belong to this institute",
        });
      }

      const record = recordResult.rows[0];
      const applicationResult = await pool.query(
        `
        SELECT a.id, a.student_id
        FROM applications a
        INNER JOIN students s ON s.id = a.student_id

        INNER JOIN institutes i ON i.id = s.institute_id
        WHERE a.id = $1
          AND i.user_id = $2
        LIMIT 1
        `,
        [application_id, userId]
      );

      if (applicationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found or does not belong to this institute",
        });
      }

      if (String(applicationResult.rows[0].student_id) !== String(record.student_id)) {
        return res.status(400).json({
          success: false,
          message: "Application student does not match academic record student",
        });
      }

      // ---------------------------------------------
      // ---------------------------------------------
      // SHA-256 actual certificate file bytes
      // ---------------------------------------------

      const sha256Hash = crypto
        .createHash("sha256")
        .update(req.file.buffer)
        .digest("hex");

      // ---------------------------------------------
      // Check duplicate certificate
      // ---------------------------------------------

      const existingCertificate = await pool.query(
        `
        SELECT *
        FROM certificates
        WHERE sha256_hash = $1
        LIMIT 1
        `,
        [sha256Hash]
      );

      if (existingCertificate.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Certificate already exists",
          certificate: existingCertificate.rows[0],
        });
      }

      // ---------------------------------------------
// Upload certificate to IPFS via Pinata
// ---------------------------------------------

let ipfsResult;

try {
  ipfsResult = await uploadCertificateToIPFS(
    req.file.buffer,
    req.file.originalname || original_file_name || "certificate",
    req.file.mimetype || mime_type || "application/octet-stream"
  );

  console.log("Certificate uploaded to IPFS");
  console.log("IPFS CID:", ipfsResult.cid);
  console.log("IPFS URL:", ipfsResult.ipfsUrl);
} catch (ipfsError) {
  console.error(
    "IPFS certificate upload failed:",
    ipfsError
  );

  return res.status(500).json({
    success: false,
    message: "Certificate IPFS upload failed",
  });
}

      // ---------------------------------------------
      // Create PostgreSQL certificate record
      // ---------------------------------------------

      const certificateResult = await pool.query(
  `
  INSERT INTO certificates (
    academic_record_id,
    student_id,
    institute_id,
    original_file_name,
    mime_type,
    file_size,
    sha256_hash,
    ipfs_cid,
    ipfs_url,
    blockchain_network,
    contract_address,
    blockchain_status,
    verification_status
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9,
    $10,
    $11,
    'pending',
    'unverified'
  )
  RETURNING *
  `,
  [
    record.id,
    record.student_id,
    institute.id,
    original_file_name || null,
    mime_type || null,
    ipfsResult.size || null,
    sha256Hash,
    ipfsResult.cid,
    ipfsResult.ipfsUrl,
    "localhost-hardhat",
    process.env.CERTIFICATE_CONTRACT_ADDRESS,
  ]
);

      const certificate = certificateResult.rows[0];

      // ---------------------------------------------
      // Convert hash to bytes32
      // ---------------------------------------------

      const blockchainHash = `0x${sha256Hash}`;

      // ---------------------------------------------
      // Issue on blockchain
      // ---------------------------------------------

      let blockchainResult;

      try {
        blockchainResult =
          await issueCertificate(blockchainHash);
      } catch (blockchainError) {
        console.error(
          "Blockchain certificate issuance failed:",
          blockchainError
        );

        await pool.query(
          `
          UPDATE certificates
          SET
            blockchain_status = 'failed',
            updated_at = NOW()
          WHERE id = $1
          `,
          [certificate.id]
        );

        return res.status(500).json({
          success: false,
          message:
            "Certificate saved in PostgreSQL, but blockchain issuance failed",
          certificate_id: certificate.id,
        });
      }

      // ---------------------------------------------
      // Update PostgreSQL with blockchain result
      // ---------------------------------------------

      const updatedCertificateResult = await pool.query(
        `
        UPDATE certificates
        SET
          blockchain_certificate_id = $1,
          transaction_hash = $2,
          blockchain_status = 'confirmed',
          blockchain_confirmed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `,
        [
          blockchainResult.certificateId,
          blockchainResult.transactionHash,
          certificate.id,
        ]
      );
      // ---------------------------------------------
      // Link certificate to the job application
      // ---------------------------------------------

      await pool.query(
        `
        INSERT INTO application_certificates (
          application_id,
          certificate_id,
          submitted_file_name,
          submitted_file_path,
          submitted_sha256_hash,
          submitted_ipfs_cid
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          application_id,
          updatedCertificateResult.rows[0].id,
          original_file_name || req.file.originalname || null,
          ipfsResult.ipfsUrl || null,
          sha256Hash,
          ipfsResult.cid,
        ]
      );



      // ---------------------------------------------
      // Response
      // ---------------------------------------------

      return res.status(201).json({
        success: true,
        message:
          "Certificate created and issued on blockchain successfully",
        certificate:
          updatedCertificateResult.rows[0],
      });
    } catch (error) {
      console.error(
        "Create blockchain certificate error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to create certificate",
      });
    }
  }
);

// =====================================================
// =====================================================
// RECOVER EXISTING CERTIFICATE ON CURRENT BLOCKCHAIN
// POST /api/institutes/me/certificates/:certificateId/recover-blockchain
// Reuses the existing SHA-256 hash and IPFS CID; never uploads a file.
// =====================================================
router.post(
  "/me/certificates/:certificateId/recover-blockchain",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const { certificateId } = req.params;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "x-user-id header is required",
        });
      }

      const result = await pool.query(
        `
        SELECT c.id, c.sha256_hash, c.ipfs_cid,
               c.blockchain_certificate_id, c.transaction_hash,
               c.blockchain_status, c.institute_id
        FROM certificates c
        JOIN institutes i ON i.id = c.institute_id
        WHERE c.id = $1 AND i.user_id = $2
        LIMIT 1
        `,
        [certificateId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found for this institute",
        });
      }

      const certificate = result.rows[0];
      const hash = String(certificate.sha256_hash || "").trim();
      const cid = String(certificate.ipfs_cid || "").trim();

      if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
        return res.status(400).json({
          success: false,
          message: "Stored certificate SHA-256 hash is invalid",
        });
      }

      if (!cid) {
        return res.status(400).json({
          success: false,
          message: "Existing IPFS CID is missing; recovery stopped",
        });
      }

      const existingId = certificate.blockchain_certificate_id
        ? String(certificate.blockchain_certificate_id)
        : "";

      if (existingId) {
        const alreadyValid = await verifyCertificate(
          existingId,
          `0x${hash}`
        );

        if (alreadyValid) {
          return res.status(409).json({
            success: false,
            message: "This certificate already verifies on the configured blockchain",
            certificateId: certificate.id,
            blockchainCertificateId: existingId,
          });
        }
      }

      const issued = await issueCertificate(`0x${hash}`);
      const verified = await verifyCertificate(
        issued.certificateId,
        `0x${hash}`
      );

      if (!verified) {
        return res.status(500).json({
          success: false,
          message: "Blockchain transaction was submitted, but verification failed; database was not updated",
          transactionHash: issued.transactionHash,
          blockchainCertificateId: issued.certificateId,
        });
      }

      const updated = await pool.query(
        `
        UPDATE certificates
        SET blockchain_certificate_id = $1,
            transaction_hash = $2,
            blockchain_status = 'confirmed',
            verification_status = 'verified',
            blockchain_network = 'localhost-hardhat',
            contract_address = $3,
            blockchain_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = $4
        RETURNING id, sha256_hash, ipfs_cid, blockchain_certificate_id,
                  transaction_hash, blockchain_status, verification_status,
                  blockchain_network, contract_address, blockchain_confirmed_at
        `,
        [
          issued.certificateId,
          issued.transactionHash,
          process.env.CERTIFICATE_CONTRACT_ADDRESS,
          certificateId,
        ]
      );

      return res.json({
        success: true,
        message: "Existing certificate recovered on the configured blockchain; original IPFS CID preserved",
        certificate: updated.rows[0],
      });
    } catch (error) {
      console.error("Recover certificate blockchain error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to recover certificate on the configured blockchain",
      });
    }
  }
);
// VERIFY CERTIFICATE
// GET /api/institutes/me/certificates/:certificateId/verify
// =====================================================

router.get(
  "/me/certificates/:certificateId/verify",
  async (req, res) => {
    try {
      const userId = req.header("x-user-id");
      const userEmail = req.header("x-user-email");
      let resolvedUserId = userId;

      if (userEmail) {
        const userResult = await pool.query(
          "SELECT id FROM users WHERE email = $1 LIMIT 1",
          [userEmail]
        );
        if (userResult.rows.length > 0) {
          resolvedUserId = String(userResult.rows[0].id);
        }
      }
      const { certificateId } = req.params;

      // ---------------------------------------------
      // Validate user
      // ---------------------------------------------

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "x-user-id header is required",
        });
      }

      // ---------------------------------------------
      // Get certificate from PostgreSQL
      // ---------------------------------------------

      const certificateResult = await pool.query(
        `
        SELECT
          c.id,
          c.academic_record_id,
          c.student_id,
          c.institute_id,
          c.sha256_hash,
          c.blockchain_certificate_id,
          c.transaction_hash,
          c.blockchain_status,
          c.verification_status
        FROM certificates c
        JOIN institutes i
          ON i.id = c.institute_id
        WHERE c.id = $1
          AND i.user_id = $2
        LIMIT 1
        `,
        [certificateId, userId]
      );

      if (certificateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Certificate not found",
        });
      }

      const certificate = certificateResult.rows[0];

      // ---------------------------------------------
      // Check blockchain information
      // ---------------------------------------------

      if (!certificate.blockchain_certificate_id) {
        return res.status(400).json({
          success: false,
          message: "Certificate has not been issued on blockchain",
          certificate,
        });
      }

      if (!certificate.sha256_hash) {
        return res.status(400).json({
          success: false,
          message: "Certificate hash is missing",
          certificate,
        });
      }

      // ---------------------------------------------
      // Convert SHA-256 hash to bytes32
      // ---------------------------------------------

      const blockchainHash =
        `0x${certificate.sha256_hash}`;

      // ---------------------------------------------
      // Verify against blockchain
      // ---------------------------------------------

      const verified = await verifyCertificate(
        certificate.blockchain_certificate_id.toString(),
        blockchainHash
      );

      // ---------------------------------------------
      // Update PostgreSQL verification status
      // ---------------------------------------------

      await pool.query(
        `
        UPDATE certificates
        SET
          verification_status = $1,
          updated_at = NOW()
        WHERE id = $2
        `,
        [
          verified ? "verified" : "unverified",
          certificate.id,
        ]
      );

      // ---------------------------------------------
      // Response
      // ---------------------------------------------

      return res.json({
        success: true,
        verified,
        certificate: {
          id: certificate.id,
          academic_record_id:
            certificate.academic_record_id,
          blockchain_certificate_id:
            certificate.blockchain_certificate_id,
          transaction_hash:
            certificate.transaction_hash,
          blockchain_status:
            certificate.blockchain_status,
          verification_status:
            verified ? "verified" : "unverified",
        },
      });
    } catch (error) {
      console.error(
        "Certificate verification error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to verify certificate",
      });
    }
  }
);

router.patch(
  "/me/applications/:applicationId/approve",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const applicationId = Number(req.params.applicationId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id",
        });
      }

      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID",
        });
      }

      const instituteResult = await pool.query(
        `
        SELECT id, institute_name
        FROM institutes
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (instituteResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Institute account not found",
        });
      }

      const institute = instituteResult.rows[0];

      const applicationResult = await pool.query(
        `
        SELECT
          a.id,
          a.status,
          a.student_id,
          s.institute_id
        FROM applications a
        JOIN students s ON s.id = a.student_id
        WHERE a.id = $1
        LIMIT 1
        `,
        [applicationId]
      );

      if (applicationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      const application = applicationResult.rows[0];

      if (Number(application.institute_id) !== Number(institute.id)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to manage this application",
        });
      }

      if (application.status === "rejected") {
        return res.status(400).json({
          success: false,
          message: "Rejected application cannot be approved",
        });
      }

      const updated = await pool.query(
        `
        UPDATE applications
        SET status = 'selected'
        WHERE id = $1
        RETURNING id, job_id, student_id, status, cover_letter, applied_at
        `,
        [applicationId]
      );

      return res.json({
        success: true,
        message: "Application approved successfully",
        application: updated.rows[0],
      });
    } catch (error) {
      console.error("Approve application error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to approve application",
      });
    }
  }
);

router.patch(
  "/me/applications/:applicationId/reject",
  async (req: Request, res: Response) => {
    try {
      const userId = req.header("x-user-id");
      const applicationId = Number(req.params.applicationId);

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Missing x-user-id",
        });
      }

      if (!Number.isInteger(applicationId) || applicationId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID",
        });
      }

      const instituteResult = await pool.query(
        `
        SELECT id, institute_name
        FROM institutes
        WHERE user_id = $1
        LIMIT 1
        `,
        [userId]
      );

      if (instituteResult.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Institute account not found",
        });
      }

      const institute = instituteResult.rows[0];

      const applicationResult = await pool.query(
        `
        SELECT
          a.id,
          a.status,
          a.student_id,
          s.institute_id
        FROM applications a
        JOIN students s ON s.id = a.student_id
        WHERE a.id = $1
        LIMIT 1
        `,
        [applicationId]
      );

      if (applicationResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Application not found",
        });
      }

      const application = applicationResult.rows[0];

      if (Number(application.institute_id) !== Number(institute.id)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to manage this application",
        });
      }

      if (application.status === "selected") {
        return res.status(400).json({
          success: false,
          message: "Selected application cannot be rejected",
        });
      }

      const updated = await pool.query(
        `
        UPDATE applications
        SET status = 'rejected'
        WHERE id = $1
        RETURNING id, job_id, student_id, status, cover_letter, applied_at
        `,
        [applicationId]
      );

      return res.json({
        success: true,
        message: "Application rejected successfully",
        application: updated.rows[0],
      });
    } catch (error) {
      console.error("Reject application error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to reject application",
      });
    }
  }
);

export default router;



