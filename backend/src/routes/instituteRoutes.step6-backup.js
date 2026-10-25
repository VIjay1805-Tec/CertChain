import { uploadCertificateToIPFS } from "../blockchain/pinataService.js";
import { Router } from "express";
import multer from "multer";
import crypto from "node:crypto";
import pool from "../config/database.js";
import { issueCertificate, verifyCertificate, } from "../blockchain/certificateService.js";
const router = Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
/**
 * GET /api/institutes/me
 *
 * Get institute profile for the logged-in institute user.
 *
 * TEMPORARY AUTH:
 * x-user-id header
 */
router.get("/me", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const result = await pool.query(`
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
      `, [userId]);
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
    }
    catch (error) {
        console.error("Get institute profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch institute profile",
        });
    }
});
/**
 * GET /api/institutes/me/students
 *
 * Get all students belonging to this institute.
 */
router.get("/me/students", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const instituteResult = await pool.query(`
      SELECT id
      FROM institutes
      WHERE user_id = $1
      LIMIT 1
      `, [resolvedUserId]);
        if (instituteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Institute profile not found",
            });
        }
        const instituteId = instituteResult.rows[0].id;
        const result = await pool.query(`
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
      `, [instituteId]);
        return res.json({
            success: true,
            students: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
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
router.post("/me/students", async (req, res) => {
    try {
        const instituteUserId = req.header("x-user-id");
        if (!instituteUserId) {
            return res.status(401).json({
                success: false,
                message: "Missing x-user-id header",
            });
        }
        const { user_id, student_id, roll_number, course, department, specialization, admission_year, graduation_year, date_of_birth, address, city, state, country, } = req.body;
        if (!user_id) {
            return res.status(400).json({
                success: false,
                message: "user_id is required",
            });
        }
        // Find institute
        const instituteResult = await pool.query(`
      SELECT id
      FROM institutes
      WHERE user_id = $1
      LIMIT 1
      `, [instituteUserId]);
        if (instituteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Institute profile not found",
            });
        }
        const instituteId = instituteResult.rows[0].id;
        // Make sure target user exists and is a student
        const userResult = await pool.query(`
      SELECT id, full_name, email, role
      FROM users
      WHERE id = $1
      LIMIT 1
      `, [user_id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student user not found",
            });
        }
        if (userResult.rows[0].role !== "student") {
            return res.status(400).json({
                success: false,
                message: "Selected user is not a student",
            });
        }
        // Check if student profile already exists
        const existingStudent = await pool.query(`
      SELECT id
      FROM students
      WHERE user_id = $1
      LIMIT 1
      `, [user_id]);
        if (existingStudent.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Student profile already exists",
            });
        }
        const result = await pool.query(`
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
        $13,
        $14,
        true
      )
      RETURNING *
      `, [
            user_id,
            instituteId,
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
        ]);
        return res.status(201).json({
            success: true,
            message: "Student added successfully",
            student: result.rows[0],
        });
    }
    catch (error) {
        console.error("Add student error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to add student",
        });
    }
});
/**
 * GET /api/institutes/me/academic-records
 *
 * Get all academic records belonging to this institute.
 */
router.get("/me/academic-records", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const result = await pool.query(`
        SELECT
          ar.*,
          s.student_id,
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
        `, [userId]);
        return res.json({
            success: true,
            records: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        console.error("Get institute academic records error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch academic records",
        });
    }
});
/**
 * POST /api/institutes/me/academic-records
 *
 * Create an academic record for a student.
 */
router.post("/me/academic-records", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const { student_id, record_type, title, course, department, grade, percentage, cgpa, issue_date, completion_date, description, } = req.body;
        if (!student_id || !record_type || !title) {
            return res.status(400).json({
                success: false,
                message: "student_id, record_type and title are required",
            });
        }
        // Find institute
        const instituteResult = await pool.query(`
        SELECT id
        FROM institutes
        WHERE user_id = $1
        LIMIT 1
        `, [resolvedUserId]);
        if (instituteResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Institute profile not found",
            });
        }
        const instituteId = instituteResult.rows[0].id;
        // Make sure student belongs to institute
        const studentResult = await pool.query(`
        SELECT id
        FROM students
        WHERE id = $1
          AND institute_id = $2
        LIMIT 1
        `, [student_id, instituteId]);
        if (studentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found or student does not belong to this institute",
            });
        }
        const result = await pool.query(`
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
        `, [
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
        ]);
        return res.status(201).json({
            success: true,
            message: "Academic record created successfully",
            record: result.rows[0],
        });
    }
    catch (error) {
        console.error("Create academic record error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create academic record",
        });
    }
});
/**
 * GET /api/institutes/me/applications
 *
 * See job applications from students belonging to this institute.
 */
router.get("/me/applications", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const result = await pool.query(`
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

          company_user.full_name AS company_name

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

        INNER JOIN institutes i
          ON i.id = s.institute_id

        WHERE i.user_id = $1

        ORDER BY a.applied_at DESC
        `, [userId]);
        return res.json({
            success: true,
            applications: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        console.error("Get institute applications error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch applications",
        });
    }
});
/**
 * GET /api/institutes/me/notifications
 *
 * Get institute notifications.
 */
router.get("/me/notifications", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const result = await pool.query(`
        SELECT *
        FROM notifications
        WHERE user_id = $1
        ORDER BY created_at DESC
        `, [userId]);
        return res.json({
            success: true,
            notifications: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        console.error("Get institute notifications error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications",
        });
    }
});
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
router.post("/me/certificates", upload.single("certificate"), async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const { academic_record_id, original_file_name, mime_type, } = req.body;
        // ---------------------------------------------
        // Validate request
        // ---------------------------------------------
        if (!academic_record_id) {
            return res.status(400).json({
                success: false,
                message: "academic_record_id is required",
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
        const instituteResult = await pool.query(`
        SELECT id, institute_name
        FROM institutes
        WHERE user_id = $1
        LIMIT 1
        `, [resolvedUserId]);
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
        const recordResult = await pool.query(`
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
        `, [academic_record_id, institute.id]);
        if (recordResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Academic record not found or does not belong to this institute",
            });
        }
        const record = recordResult.rows[0];
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
        const existingCertificate = await pool.query(`
        SELECT *
        FROM certificates
        WHERE sha256_hash = $1
        LIMIT 1
        `, [sha256Hash]);
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
            ipfsResult = await uploadCertificateToIPFS(req.file.buffer, req.file.originalname || original_file_name || "certificate", req.file.mimetype || mime_type || "application/octet-stream");
            console.log("Certificate uploaded to IPFS");
            console.log("IPFS CID:", ipfsResult.cid);
            console.log("IPFS URL:", ipfsResult.ipfsUrl);
        }
        catch (ipfsError) {
            console.error("IPFS certificate upload failed:", ipfsError);
            return res.status(500).json({
                success: false,
                message: "Certificate IPFS upload failed",
            });
        }
        // ---------------------------------------------
        // Create PostgreSQL certificate record
        // ---------------------------------------------
        const certificateResult = await pool.query(`
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
  `, [
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
            "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        ]);
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
        }
        catch (blockchainError) {
            console.error("Blockchain certificate issuance failed:", blockchainError);
            await pool.query(`
          UPDATE certificates
          SET
            blockchain_status = 'failed',
            updated_at = NOW()
          WHERE id = $1
          `, [certificate.id]);
            return res.status(500).json({
                success: false,
                message: "Certificate saved in PostgreSQL, but blockchain issuance failed",
                certificate_id: certificate.id,
            });
        }
        // ---------------------------------------------
        // Update PostgreSQL with blockchain result
        // ---------------------------------------------
        const updatedCertificateResult = await pool.query(`
        UPDATE certificates
        SET
          blockchain_certificate_id = $1,
          transaction_hash = $2,
          blockchain_status = 'confirmed',
          blockchain_confirmed_at = NOW(),
          updated_at = NOW()
        WHERE id = $3
        RETURNING *
        `, [
            blockchainResult.certificateId,
            blockchainResult.transactionHash,
            certificate.id,
        ]);
        // ---------------------------------------------
        // Response
        // ---------------------------------------------
        return res.status(201).json({
            success: true,
            message: "Certificate created and issued on blockchain successfully",
            certificate: updatedCertificateResult.rows[0],
        });
    }
    catch (error) {
        console.error("Create blockchain certificate error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create certificate",
        });
    }
});
// =====================================================
// VERIFY CERTIFICATE
// GET /api/institutes/me/certificates/:certificateId/verify
// =====================================================
router.get("/me/certificates/:certificateId/verify", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const userEmail = req.header("x-user-email");
        let resolvedUserId = userId;
        if (userEmail) {
            const userResult = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [userEmail]);
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
        const certificateResult = await pool.query(`
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
        `, [certificateId, userId]);
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
        const blockchainHash = `0x${certificate.sha256_hash}`;
        // ---------------------------------------------
        // Verify against blockchain
        // ---------------------------------------------
        const verified = await verifyCertificate(certificate.blockchain_certificate_id.toString(), blockchainHash);
        // ---------------------------------------------
        // Update PostgreSQL verification status
        // ---------------------------------------------
        await pool.query(`
        UPDATE certificates
        SET
          verification_status = $1,
          updated_at = NOW()
        WHERE id = $2
        `, [
            verified ? "verified" : "unverified",
            certificate.id,
        ]);
        // ---------------------------------------------
        // Response
        // ---------------------------------------------
        return res.json({
            success: true,
            verified,
            certificate: {
                id: certificate.id,
                academic_record_id: certificate.academic_record_id,
                blockchain_certificate_id: certificate.blockchain_certificate_id,
                transaction_hash: certificate.transaction_hash,
                blockchain_status: certificate.blockchain_status,
                verification_status: verified ? "verified" : "unverified",
            },
        });
    }
    catch (error) {
        console.error("Certificate verification error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to verify certificate",
        });
    }
});
export default router;
//# sourceMappingURL=instituteRoutes.step6-backup.js.map