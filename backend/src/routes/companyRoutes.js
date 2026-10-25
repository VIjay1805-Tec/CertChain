import { verifyCertificate, } from "../blockchain/certificateService.js";
import { verifyCertificateAtAddress } from "../blockchain/addressAwareVerification.js";
import express, {} from "express";
import multer from "multer";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import pool from "../config/database.js";
import { analyzeCertificateWithAI } from "../services/aiForgeryService.js";
const router = express.Router();
const companyCertificateUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});
// =====================================================
// GET COMPANY PROFILE
// GET /api/companies/me
// =====================================================
router.get("/me", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        const result = await pool.query(`
      SELECT
        c.id,
        c.user_id,
        c.company_name,
        c.registration_number,
        c.industry,
        c.description,
        c.website,
        c.address,
        c.city,
        c.state,
        c.country,
        c.created_at,
        c.updated_at,
        u.full_name,
        u.email,
        u.phone
      FROM companies c
      JOIN users u
        ON u.id = c.user_id
      WHERE c.user_id = $1
        AND u.role = 'company'
      `, [userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        return res.json({
            success: true,
            company: result.rows[0],
        });
    }
    catch (error) {
        console.error("Get company profile error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get company profile",
        });
    }
});
// =====================================================
// CREATE JOB
// POST /api/companies/me/jobs
// =====================================================
router.post("/me/jobs", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        const { title, description, location, employment_type, experience_required, salary_min, salary_max, skills, status, application_deadline, } = req.body;
        // -----------------------------
        // Validation
        // -----------------------------
        if (!title || title.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Job title is required",
            });
        }
        // -----------------------------
        // Find company
        // -----------------------------
        const companyResult = await pool.query(`
        SELECT id
        FROM companies
        WHERE user_id = $1
        `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const companyId = companyResult.rows[0].id;
        // -----------------------------
        // Create job
        // -----------------------------
        const jobResult = await pool.query(`
        INSERT INTO jobs (
          company_id,
          title,
          description,
          location,
          employment_type,
          experience_required,
          salary_min,
          salary_max,
          skills,
          status,
          application_deadline
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
          COALESCE($10, 'open'),
          $11
        )
        RETURNING *
        `, [
            companyId,
            title.trim(),
            description || null,
            location || null,
            employment_type || null,
            experience_required || null,
            salary_min ?? null,
            salary_max ?? null,
            skills || null,
            status || null,
            application_deadline || null,
        ]);
        return res.status(201).json({
            success: true,
            message: "Job created successfully",
            job: jobResult.rows[0],
        });
    }
    catch (error) {
        console.error("Create job error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create job",
        });
    }
});
// =====================================================
// GET COMPANY JOBS
// GET /api/companies/me/jobs
// =====================================================
router.get("/me/jobs", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
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
          j.updated_at,
          c.company_name
        FROM jobs j
        JOIN companies c
          ON c.id = j.company_id
        WHERE c.user_id = $1
        ORDER BY j.created_at DESC
        `, [userId]);
        return res.json({
            success: true,
            jobs: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        console.error("Get company jobs error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get company jobs",
        });
    }
});
// =====================================================
// GET ALL OPEN JOBS
// GET /api/jobs
// =====================================================
//
// Students will use this endpoint to see available jobs.
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
    }
    catch (error) {
        console.error("Get open jobs error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get jobs",
        });
    }
});
// =====================================================
// GET COMPANY APPLICATIONS
// GET /api/companies/me/applications
// =====================================================
router.get("/me/applications", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
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

          j.title AS job_title,
          j.location AS job_location,

          s.student_id AS student_code,
          s.roll_number,
          s.course,
          s.department,
          s.specialization,
          s.graduation_year,
          s.institute_id,

          institute.institute_name,

          u.full_name AS student_name,
          u.email AS student_email,
          u.phone AS student_phone,

          ar.id AS academic_record_id,
          ar.record_type,
          ar.title AS academic_title,
          ar.grade,
          ar.percentage,
          ar.cgpa,
          ar.issue_date,
          ar.completion_date,
          ar.description AS academic_description,

          cert.id AS certificate_id,
          cert.original_file_name,
          cert.sha256_hash,
          cert.ipfs_cid,
          cert.ipfs_url,
          cert.transaction_hash,
          cert.contract_address,
          cert.blockchain_certificate_id,
          cert.blockchain_status,
          cert.verification_status

        FROM applications a

        JOIN jobs j
          ON j.id = a.job_id

        JOIN companies c
          ON c.id = j.company_id

        JOIN students s
          ON s.id = a.student_id

        JOIN users u
          ON u.id = s.user_id

        LEFT JOIN institutes institute
          ON institute.id = s.institute_id

        LEFT JOIN LATERAL (
          SELECT ar.*
          FROM academic_records ar
          WHERE ar.student_id = a.student_id
          ORDER BY ar.created_at DESC
          LIMIT 1
        ) ar ON true

        LEFT JOIN LATERAL (
          SELECT cert.*
          FROM certificates cert
          WHERE cert.student_id = a.student_id
          ORDER BY cert.created_at DESC
          LIMIT 1
        ) cert ON true

        WHERE c.user_id = $1

        ORDER BY a.applied_at DESC
        `, [userId]);
        return res.json({
            success: true,
            applications: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        console.error("Get company applications error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get company applications",
        });
    }
});
// =====================================================
// GET COMPANY VERIFICATION REQUESTS
// GET /api/companies/me/verification-requests
// =====================================================
router.get("/me/verification-requests", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        const result = await pool.query(`
        SELECT
          vr.id,
          vr.application_id,
          vr.company_id,
          vr.student_id,
          vr.certificate_id,
          vr.verification_type,
          vr.fee_amount,
          vr.status,
          vr.created_at,
          vr.completed_at,

          j.title AS job_title,
          j.location AS job_location,

          s.student_id AS student_code,

          u.full_name AS student_name,
          u.email AS student_email,
          u.phone AS student_phone,

          cert.original_file_name,
          cert.sha256_hash,
          cert.ipfs_cid,
          cert.ipfs_url,
          cert.transaction_hash,
          cert.contract_address,
          cert.blockchain_certificate_id,
          cert.blockchain_status,
          cert.verification_status,

          bv.submitted_sha256_hash,
          bv.original_sha256_hash,
          bv.hash_match,
          bv.blockchain_status AS verification_blockchain_status,
          bv.checked_at AS blockchain_checked_at,

          av.confidence_score,
          av.verdict AS ai_verdict,
          av.analysis_details,
          av.checked_at AS ai_checked_at,

          rpt.blockchain_result,
          rpt.ai_result,
          rpt.final_status,
          rpt.blockchain_hash_match,
          rpt.ai_confidence_score,
          rpt.report_data,
          rpt.generated_at AS report_generated_at

        FROM verification_requests vr

        JOIN applications a
          ON a.id = vr.application_id

        JOIN jobs j
          ON j.id = a.job_id

        JOIN companies c
          ON c.id = vr.company_id
          AND c.id = j.company_id

        JOIN students s
          ON s.id = vr.student_id

        JOIN users u
          ON u.id = s.user_id

        LEFT JOIN certificates cert
          ON cert.id = vr.certificate_id

        LEFT JOIN blockchain_verifications bv
          ON bv.verification_request_id = vr.id

        LEFT JOIN ai_verifications av
          ON av.verification_request_id = vr.id

        LEFT JOIN verification_reports rpt
          ON rpt.verification_request_id = vr.id

        WHERE c.user_id = $1

        ORDER BY vr.created_at DESC
        `, [userId]);
        return res.json({
            success: true,
            verification_requests: result.rows,
            count: result.rows.length,
        });
    }
    catch (error) {
        console.error("Get company verification requests error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get company verification requests",
        });
    }
});
// =====================================================// =====================================================
// UPDATE APPLICATION STATUS
// PATCH /api/companies/me/applications/:id/status
// =====================================================
router.patch("/me/applications/:id/status", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const applicationId = req.params.id;
        const { status } = req.body;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        const allowedStatuses = [
            "applied",
            "under_review",
            "verification_requested",
            "verified",
            "suspicious",
            "invalid",
            "rejected",
            "selected",
        ];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid application status",
                allowedStatuses,
            });
        }
        // Make sure this application belongs to this company
        const applicationCheck = await pool.query(`
        SELECT
          a.id,
          a.student_id,
          a.status,
          j.title AS job_title,
          c.id AS company_id,
          c.user_id AS company_user_id
        FROM applications a
        JOIN jobs j
          ON j.id = a.job_id
        JOIN companies c
          ON c.id = j.company_id
        WHERE a.id = $1
          AND c.user_id = $2
        `, [applicationId, userId]);
        if (applicationCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Application not found",
            });
        }
        const application = applicationCheck.rows[0];
        // Update application
        const result = await pool.query(`
        UPDATE applications
        SET
          status = $1,
          updated_at = NOW()
        WHERE id = $2
        RETURNING *
        `, [status, applicationId]);
        // Get student's user_id
        const studentResult = await pool.query(`
        SELECT user_id
        FROM students
        WHERE id = $1
        `, [application.student_id]);
        if (studentResult.rows.length > 0) {
            const studentUserId = studentResult.rows[0].user_id;
            // Create notification for student
            await pool.query(`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_application_id
          )
          VALUES ($1, $2, $3, $4, $5)
          `, [
                studentUserId,
                "application_status",
                "Application Status Updated",
                `Your application for ${application.job_title} is now ${status.replace("_", " ")}.`,
                applicationId,
            ]);
        }
        return res.json({
            success: true,
            message: "Application status updated successfully",
            application: result.rows[0],
        });
    }
    catch (error) {
        console.error("Update application status error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update application status",
        });
    }
});
// =====================================================
// REQUEST CERTIFICATE VERIFICATION
// POST /api/companies/me/applications/:id/verification-request
// =====================================================
router.post("/me/applications/:id/verification-request", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const applicationId = req.params.id;
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
        // Find company
        // ---------------------------------------------
        const companyResult = await pool.query(`
        SELECT
          id,
          user_id,
          company_name
        FROM companies
        WHERE user_id = $1
        LIMIT 1
        `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const company = companyResult.rows[0];
        // ---------------------------------------------
        // Find application belonging to this company
        // ---------------------------------------------
        const applicationResult = await pool.query(`
        SELECT
          a.id,
          a.job_id,
          a.student_id,
          a.status,
          j.title AS job_title,
          j.company_id
        FROM applications a
        JOIN jobs j
          ON j.id = a.job_id
        WHERE a.id = $1
          AND j.company_id = $2
        LIMIT 1
        `, [applicationId, company.id]);
        if (applicationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Application not found",
            });
        }
        const application = applicationResult.rows[0];
        // ---------------------------------------------
        // Check application status
        //
        // Verification should only be requested for a
        // valid application.
        // ---------------------------------------------
        const allowedApplicationStatuses = [
            "applied",
            "under_review",
            "verification_requested",
        ];
        if (!allowedApplicationStatuses.includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: `Verification cannot be requested when application status is "${application.status}"`,
            });
        }
        // ---------------------------------------------
        // Find student's latest blockchain-confirmed
        // certificate
        // ---------------------------------------------
        const certificateResult = await pool.query(`
        SELECT
          id,
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
          blockchain_certificate_id,
          transaction_hash,
          blockchain_status,
          verification_status
        FROM certificates
        WHERE student_id = $1
          AND blockchain_status = 'confirmed'
          AND blockchain_certificate_id IS NOT NULL
        ORDER BY id DESC
        LIMIT 1
        `, [application.student_id]);
        if (certificateResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Student does not have a blockchain-confirmed certificate",
            });
        }
        const certificate = certificateResult.rows[0];
        // ---------------------------------------------
        // Check whether a verification request already
        // exists for this application/company.
        //
        // Valid statuses according to the database:
        //
        // payment_pending
        // paid
        // processing
        // completed
        // failed
        //
        // We only block creation for active requests.
        // ---------------------------------------------
        const existingRequestResult = await pool.query(`
        SELECT
          id,
          application_id,
          company_id,
          student_id,
          certificate_id,
          verification_type,
          fee_amount,
          status,
          created_at,
          completed_at
        FROM verification_requests
        WHERE application_id = $1
          AND company_id = $2
          AND status IN (
            'payment_pending',
            'paid',
            'processing'
          )
        ORDER BY id DESC
        LIMIT 1
        `, [application.id, company.id]);
        if (existingRequestResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Verification request already exists",
                verification_request: existingRequestResult.rows[0],
            });
        }
        // ---------------------------------------------
        // Create verification request
        //
        // IMPORTANT:
        //
        // verification_type MUST be one of:
        //   blockchain
        //   ai
        //   combined
        //
        // status MUST be one of:
        //   payment_pending
        //   paid
        //   processing
        //   completed
        //   failed
        //
        // We use:
        //
        // verification_type = the type selected by the company
        // status = payment_pending
        //
        // because the next step will handle payment and
        // then execute blockchain + AI verification.
        // ---------------------------------------------
        const requestedVerificationType = req.body?.verification_type;
        const allowedVerificationTypes = [
            "blockchain",
            "ai_forgery",
            "combined",
        ];
        if (!allowedVerificationTypes.includes(requestedVerificationType)) {
            return res.status(400).json({
                success: false,
                message: "verification_type must be blockchain, ai_forgery, or combined",
            });
        }
        const verificationFees = {
            blockchain: 999,
            ai_forgery: 1999,
            combined: 2999,
        };
        const feeAmount = verificationFees[requestedVerificationType];
        const verificationRequestResult = await pool.query(`
  INSERT INTO verification_requests (
    application_id,
    company_id,
    student_id,
    certificate_id,
    verification_type,
    fee_amount,
    status
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    'payment_pending'
  )
  RETURNING *
  `, [
            application.id,
            company.id,
            application.student_id,
            certificate.id,
            requestedVerificationType,
            feeAmount,
        ]);
        const verificationRequest = verificationRequestResult.rows[0];
        // ---------------------------------------------
        // Update application status
        // ---------------------------------------------
        await pool.query(`
        UPDATE applications
        SET
          status = 'verification_requested',
          updated_at = NOW()
        WHERE id = $1
        `, [application.id]);
        // ---------------------------------------------
        // Notify student
        // ---------------------------------------------
        const studentResult = await pool.query(`
        SELECT
          user_id
        FROM students
        WHERE id = $1
        LIMIT 1
        `, [application.student_id]);
        if (studentResult.rows.length > 0) {
            const studentUserId = studentResult.rows[0].user_id;
            await pool.query(`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_application_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          `, [
                studentUserId,
                "verification_request",
                "Certificate Verification Requested",
                `${company.company_name} has requested verification of your certificate for the job "${application.job_title}".`,
                application.id,
            ]);
        }
        // ---------------------------------------------
        // Notify institute
        // ---------------------------------------------
        const instituteResult = await pool.query(`
        SELECT
          user_id
        FROM institutes
        WHERE id = $1
        LIMIT 1
        `, [certificate.institute_id]);
        if (instituteResult.rows.length > 0) {
            const instituteUserId = instituteResult.rows[0].user_id;
            await pool.query(`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_application_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          `, [
                instituteUserId,
                "verification_request",
                "Certificate Verification Requested",
                `${company.company_name} has requested verification of a student's certificate.`,
                application.id,
            ]);
        }
        // ---------------------------------------------
        // Response
        // ---------------------------------------------
        return res.status(201).json({
            success: true,
            message: "Certificate verification requested successfully",
            verification_request: verificationRequest,
            application: {
                id: application.id,
                job_id: application.job_id,
                student_id: application.student_id,
                status: "verification_requested",
                job_title: application.job_title,
            },
            certificate: {
                id: certificate.id,
                academic_record_id: certificate.academic_record_id,
                original_file_name: certificate.original_file_name,
                mime_type: certificate.mime_type,
                file_size: certificate.file_size,
                sha256_hash: certificate.sha256_hash,
                ipfs_cid: certificate.ipfs_cid,
                ipfs_url: certificate.ipfs_url,
                blockchain_network: certificate.blockchain_network,
                contract_address: certificate.contract_address,
                blockchain_certificate_id: certificate.blockchain_certificate_id,
                transaction_hash: certificate.transaction_hash,
                blockchain_status: certificate.blockchain_status,
                verification_status: certificate.verification_status,
            },
        });
    }
    catch (error) {
        console.error("Create verification request error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create verification request",
        });
    }
});
// =====================================================
// =====================================================
// CREATE RAZORPAY ORDER FOR VERIFICATION REQUEST
// POST /api/companies/me/verification-requests/:id/payment/order
// =====================================================
router.post("/me/verification-requests/:id/payment/order", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const verificationRequestId = req.params.id;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Razorpay credentials are not configured",
            });
        }
        const companyResult = await pool.query(`
        SELECT id
        FROM companies
        WHERE user_id = $1
        `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const companyId = companyResult.rows[0].id;
        const requestResult = await pool.query(`
        SELECT vr.*, j.title AS job_title
        FROM verification_requests vr
        JOIN applications a ON a.id = vr.application_id
        JOIN jobs j ON j.id = a.job_id
        WHERE vr.id = $1
          AND vr.company_id = $2
        LIMIT 1
        `, [verificationRequestId, companyId]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verification request not found",
            });
        }
        const verificationRequest = requestResult.rows[0];
        if (verificationRequest.status !== "payment_pending") {
            return res.status(400).json({
                success: false,
                message: "Verification request is not waiting for payment",
                current_status: verificationRequest.status,
            });
        }
        const amountInRupees = Number(verificationRequest.fee_amount);
        if (!Number.isFinite(amountInRupees) || amountInRupees <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification fee amount",
            });
        }
        const razorpayOrder = await razorpay.orders.create({
            amount: Math.round(amountInRupees * 100),
            currency: "INR",
            receipt: `certchain_vr_${verificationRequest.id}`,
            notes: {
                verification_request_id: String(verificationRequest.id),
                company_id: String(companyId),
            },
        });
        return res.status(201).json({
            success: true,
            message: "Razorpay order created successfully",
            order: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
            },
            key_id: process.env.RAZORPAY_KEY_ID,
            verification_request_id: verificationRequest.id,
        });
    }
    catch (error) {
        console.error("Create Razorpay order error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create Razorpay order",
        });
    }
});
// =====================================================
// VERIFY RAZORPAY PAYMENT FOR VERIFICATION REQUEST
// POST /api/companies/me/verification-requests/:id/payment/verify
// =====================================================
router.post("/me/verification-requests/:id/payment/verify", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const verificationRequestId = req.params.id;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Razorpay credentials are not configured",
            });
        }
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "razorpay_order_id, razorpay_payment_id and razorpay_signature are required",
            });
        }
        const companyResult = await pool.query(`
        SELECT id, user_id, company_name
        FROM companies
        WHERE user_id = $1
        LIMIT 1
        `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const company = companyResult.rows[0];
        const requestResult = await pool.query(`
        SELECT
          vr.id,
          vr.application_id,
          vr.company_id,
          vr.student_id,
          vr.certificate_id,
          vr.verification_type,
          vr.fee_amount,
          vr.status,
          j.title AS job_title
        FROM verification_requests vr
        JOIN applications a ON a.id = vr.application_id
        JOIN jobs j ON j.id = a.job_id
        WHERE vr.id = $1
          AND vr.company_id = $2
        LIMIT 1
        `, [verificationRequestId, company.id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verification request not found",
            });
        }
        const verificationRequest = requestResult.rows[0];
        if (verificationRequest.status !== "payment_pending") {
            return res.status(400).json({
                success: false,
                message: "Verification request is not waiting for payment",
                current_status: verificationRequest.status,
            });
        }
        const existingPaymentResult = await pool.query(`
        SELECT *
        FROM payments
        WHERE verification_request_id = $1
        ORDER BY id DESC
        LIMIT 1
        `, [verificationRequestId]);
        if (existingPaymentResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Payment already exists for this verification request",
                payment: existingPaymentResult.rows[0],
            });
        }
        const expectedSignature = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        const signaturesMatch = expectedSignature.length === razorpay_signature.length &&
            timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(razorpay_signature));
        if (!signaturesMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay payment signature",
            });
        }
        const paymentResult = await pool.query(`
        INSERT INTO payments (
          verification_request_id,
          company_id,
          amount,
          currency,
          payment_method,
          transaction_id,
          status,
          paid_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'INR',
          'razorpay',
          $4,
          'successful',
          NOW()
        )
        RETURNING *
        `, [
            verificationRequest.id,
            company.id,
            verificationRequest.fee_amount,
            razorpay_payment_id,
        ]);
        const payment = paymentResult.rows[0];
        const updatedRequestResult = await pool.query(`
        UPDATE verification_requests
        SET status = 'paid'
        WHERE id = $1
        RETURNING *
        `, [verificationRequest.id]);
        const updatedRequest = updatedRequestResult.rows[0];
        const studentResult = await pool.query(`
        SELECT user_id
        FROM students
        WHERE id = $1
        LIMIT 1
        `, [verificationRequest.student_id]);
        if (studentResult.rows.length > 0) {
            await pool.query(`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_application_id
          )
          VALUES ($1, $2, $3, $4, $5)
          `, [
                studentResult.rows[0].user_id,
                "verification_payment",
                "Verification Payment Completed",
                `${company.company_name} has completed payment for verification of your certificate for the job "${verificationRequest.job_title}".`,
                verificationRequest.application_id,
            ]);
        }
        return res.status(200).json({
            success: true,
            message: "Razorpay payment verified successfully",
            payment,
            verification_request: updatedRequest,
        });
    }
    catch (error) {
        console.error("Verify Razorpay payment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to verify Razorpay payment",
        });
    }
});
// =====================================================
// CREATE PAYMENT FOR VERIFICATION REQUEST
// POST /api/companies/me/verification-requests/:id/payment
// =====================================================
router.post("/me/verification-requests/:id/payment", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
        const verificationRequestId = req.params.id;
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
        // Get company
        // ---------------------------------------------
        const companyResult = await pool.query(`
        SELECT
          id,
          user_id,
          company_name
        FROM companies
        WHERE user_id = $1
        LIMIT 1
        `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const company = companyResult.rows[0];
        // ---------------------------------------------
        // Find verification request
        // ---------------------------------------------
        const requestResult = await pool.query(`
        SELECT
          vr.id,
          vr.application_id,
          vr.company_id,
          vr.student_id,
          vr.certificate_id,
          vr.verification_type,
          vr.fee_amount,
          vr.status,
          vr.created_at,
          vr.completed_at,
          j.title AS job_title
        FROM verification_requests vr
        JOIN applications a
          ON a.id = vr.application_id
        JOIN jobs j
          ON j.id = a.job_id
        WHERE vr.id = $1
          AND vr.company_id = $2
        LIMIT 1
        `, [verificationRequestId, company.id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verification request not found",
            });
        }
        const verificationRequest = requestResult.rows[0];
        // ---------------------------------------------
        // Make sure request is waiting for payment
        // ---------------------------------------------
        if (verificationRequest.status !== "payment_pending") {
            return res.status(400).json({
                success: false,
                message: "Verification request is not waiting for payment",
                current_status: verificationRequest.status,
            });
        }
        // ---------------------------------------------
        // Get payment details
        // ---------------------------------------------
        const { payment_method, transaction_id, } = req.body;
        if (!payment_method) {
            return res.status(400).json({
                success: false,
                message: "payment_method is required",
            });
        }
        if (!transaction_id) {
            return res.status(400).json({
                success: false,
                message: "transaction_id is required",
            });
        }
        // ---------------------------------------------
        // Prevent duplicate payment
        // ---------------------------------------------
        const existingPaymentResult = await pool.query(`
        SELECT *
        FROM payments
        WHERE verification_request_id = $1
        ORDER BY id DESC
        LIMIT 1
        `, [verificationRequestId]);
        if (existingPaymentResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Payment already exists for this verification request",
                payment: existingPaymentResult.rows[0],
            });
        }
        // ---------------------------------------------
        // Create payment
        //
        // For now this simulates a successful payment.
        // A real payment gateway can be connected later.
        // ---------------------------------------------
        const paymentResult = await pool.query(`
        INSERT INTO payments (
          verification_request_id,
          company_id,
          amount,
          currency,
          payment_method,
          transaction_id,
          status,
          paid_at
        )
        VALUES (
          $1,
          $2,
          $3,
          'INR',
          $4,
          $5,
          'successful',
          NOW()
        )
        RETURNING *
        `, [
            verificationRequest.id,
            company.id,
            verificationRequest.fee_amount,
            payment_method,
            transaction_id,
        ]);
        const payment = paymentResult.rows[0];
        // ---------------------------------------------
        // Update verification request
        // ---------------------------------------------
        const updatedRequestResult = await pool.query(`
        UPDATE verification_requests
        SET
          status = 'paid'
        WHERE id = $1
        RETURNING *
        `, [verificationRequest.id]);
        const updatedRequest = updatedRequestResult.rows[0];
        // ---------------------------------------------
        // Notify student
        // ---------------------------------------------
        const studentResult = await pool.query(`
        SELECT user_id
        FROM students
        WHERE id = $1
        LIMIT 1
        `, [verificationRequest.student_id]);
        if (studentResult.rows.length > 0) {
            const studentUserId = studentResult.rows[0].user_id;
            await pool.query(`
          INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            related_application_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          `, [
                studentUserId,
                "verification_payment",
                "Verification Payment Completed",
                `${company.company_name} has completed payment for verification of your certificate for the job "${verificationRequest.job_title}".`,
                verificationRequest.application_id,
            ]);
        }
        // ---------------------------------------------
        // Response
        // ---------------------------------------------
        return res.status(201).json({
            success: true,
            message: "Payment completed successfully",
            payment,
            verification_request: updatedRequest,
        });
    }
    catch (error) {
        console.error("Create verification payment error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create payment",
        });
    }
});
// =====================================================
// BLOCKCHAIN VERIFY CERTIFICATE
// POST /api/companies/me/verification-requests/:id/blockchain-verify
// =====================================================
router.post("/me/verification-requests/:id/blockchain-verify", companyCertificateUpload.single("certificate"), async (req, res) => {
    const verificationRequestId = req.params.id;
    try {
        // =====================================================
        // VALIDATE USER
        // =====================================================
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        if (!verificationRequestId) {
            return res.status(400).json({
                success: false,
                message: "Verification request ID is required",
            });
        }
        // =====================================================
        // GET COMPANY
        // =====================================================
        const companyResult = await pool.query(`
        SELECT
          id,
          user_id,
          company_name
        FROM companies
        WHERE user_id = $1
        LIMIT 1
        `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const company = companyResult.rows[0];
        // =====================================================
        // GET VERIFICATION REQUEST
        // =====================================================
        const requestResult = await pool.query(`
        SELECT
          vr.id,
          vr.application_id,
          vr.company_id,
          vr.student_id,
          vr.certificate_id,
          vr.verification_type,
          vr.fee_amount,
          vr.status,
          vr.created_at,
          vr.completed_at,
          j.title AS job_title
        FROM verification_requests vr
        JOIN applications a
          ON a.id = vr.application_id
        JOIN jobs j
          ON j.id = a.job_id
        WHERE vr.id = $1
          AND vr.company_id = $2
        LIMIT 1
        `, [verificationRequestId, company.id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verification request not found",
            });
        }
        const verificationRequest = requestResult.rows[0];
        // =====================================================
        // VALIDATE VERIFICATION TYPE
        // =====================================================
        const allowedVerificationTypes = [
            "blockchain",
            "ai_forgery",
            "combined",
        ];
        if (!allowedVerificationTypes.includes(verificationRequest.verification_type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid verification type",
                verification_type: verificationRequest.verification_type,
                allowedVerificationTypes,
            });
        }
        // =====================================================
        // AI-ONLY REQUEST
        // =====================================================
        if (verificationRequest.verification_type ===
            "ai_forgery") {
            return res.status(400).json({
                success: false,
                message: "This verification request is AI-only. Blockchain verification is not required.",
                verification_type: "ai_forgery",
                next_step: "ai_forgery",
            });
        }
        // =====================================================
        // CHECK PAYMENT STATUS
        // =====================================================
        if (verificationRequest.status !== "paid") {
            if (verificationRequest.status === "processing") {
                return res.status(409).json({
                    success: false,
                    message: "Blockchain verification is already being processed",
                    status: verificationRequest.status,
                });
            }
            if (verificationRequest.status === "completed") {
                return res.status(409).json({
                    success: false,
                    message: "Verification request has already been completed",
                    status: verificationRequest.status,
                });
            }
            if (verificationRequest.status === "failed") {
                return res.status(409).json({
                    success: false,
                    message: "Verification request has already failed",
                    status: verificationRequest.status,
                });
            }
            return res.status(400).json({
                success: false,
                message: "Verification request must be paid before blockchain verification",
                status: verificationRequest.status,
            });
        }
        // =====================================================
        if (!req.file || !req.file.buffer || req.file.size === 0) {
            return res.status(400).json({
                success: false,
                message: "Upload the certificate file you received from the student",
            });
        }
        // CERTIFICATE ID CHECK
        // =====================================================
        if (!verificationRequest.certificate_id) {
            return res.status(400).json({
                success: false,
                message: "Verification request does not have a certificate",
            });
        }
        // =====================================================
        // GET CERTIFICATE
        // =====================================================
        const certificateResult = await pool.query(`
        SELECT
          id,
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
          blockchain_certificate_id,
          transaction_hash,
          blockchain_status,
          verification_status
        FROM certificates
        WHERE id = $1
          AND student_id = $2
        LIMIT 1
        `, [
            verificationRequest.certificate_id,
            verificationRequest.student_id,
        ]);
        if (certificateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Certificate not found",
            });
        }
        const certificate = certificateResult.rows[0];
        // =====================================================
        // CHECK BLOCKCHAIN CERTIFICATE ID
        // =====================================================
        if (certificate.blockchain_certificate_id === null ||
            certificate.blockchain_certificate_id === undefined) {
            return res.status(400).json({
                success: false,
                message: "Certificate has not been issued on blockchain",
            });
        }
        // =====================================================
        // CHECK SHA-256 HASH
        // =====================================================
        if (certificate.sha256_hash === null ||
            certificate.sha256_hash === undefined) {
            return res.status(400).json({
                success: false,
                message: "Certificate hash is missing",
            });
        }
        // =====================================================
        // NORMALIZE SHA-256 HASH
        // =====================================================
        const normalizedHash = certificate.sha256_hash
            .toString()
            .trim()
            .toLowerCase()
            .replace(/^0x/, "");
        if (!/^[a-f0-9]{64}$/.test(normalizedHash)) {
            return res.status(400).json({
                success: false,
                message: "Certificate SHA-256 hash is invalid",
            });
        }
        const uploadedFileHash = createHash("sha256")
            .update(req.file.buffer)
            .digest("hex");
        if (uploadedFileHash !== normalizedHash) {
            const mismatchDetails = {
                type: "blockchain",
                reason: "uploaded_file_hash_mismatch",
                message: "Uploaded certificate does not match the institute's original file",
                submitted_sha256_hash: uploadedFileHash,
                original_sha256_hash: normalizedHash,
            };
            await pool.query("BEGIN");
            try {
                const failedRequest = await pool.query(`
            UPDATE verification_requests
            SET status = 'failed', completed_at = NOW()
            WHERE id = $1 AND company_id = $2 AND status = 'paid'
            RETURNING id
            `, [verificationRequest.id, company.id]);
                if (failedRequest.rows.length === 0) {
                    throw new Error("Verification request is no longer in paid status");
                }
                await pool.query(`
            INSERT INTO blockchain_verifications (
              verification_request_id,
              original_certificate_id,
              submitted_sha256_hash,
              original_sha256_hash,
              original_ipfs_cid,
              hash_match,
              blockchain_certificate_id,
              contract_address,
              transaction_hash,
              blockchain_status,
              checked_at
            )
            VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, $8, 'mismatch', NOW())
            `, [
                    verificationRequest.id,
                    certificate.id,
                    uploadedFileHash,
                    normalizedHash,
                    certificate.ipfs_cid,
                    String(certificate.blockchain_certificate_id),
                    certificate.contract_address,
                    certificate.transaction_hash,
                ]);
                await pool.query(`
            INSERT INTO verification_reports (
              verification_request_id,
              blockchain_result,
              ai_result,
              final_status,
              blockchain_hash_match,
              report_data,
              generated_at
            )
            VALUES ($1, 'mismatch', NULL, 'invalid', FALSE, $2::jsonb, NOW())
            ON CONFLICT (verification_request_id)
            DO UPDATE SET
              blockchain_result = EXCLUDED.blockchain_result,
              final_status = EXCLUDED.final_status,
              blockchain_hash_match = FALSE,
              report_data = EXCLUDED.report_data,
              generated_at = NOW()
            `, [verificationRequest.id, JSON.stringify(mismatchDetails)]);
                await pool.query("COMMIT");
            }
            catch (persistError) {
                await pool.query("ROLLBACK");
                throw persistError;
            }
            return res.status(422).json({
                success: false,
                message: "Uploaded certificate does not match the institute's original file",
                hash_match: false,
                submitted_sha256_hash: uploadedFileHash,
                original_sha256_hash: normalizedHash,
                verification_request_id: String(verificationRequest.id),
                verdict: "invalid",
            });
        }
        const blockchainHash = `0x${normalizedHash}`;
        // =====================================================
        // CHECK BLOCKCHAIN TRANSACTION STATUS
        // =====================================================
        if (certificate.blockchain_status !== "confirmed") {
            return res.status(400).json({
                success: false,
                message: "Certificate blockchain transaction is not confirmed",
                blockchain_status: certificate.blockchain_status,
            });
        }
        // =====================================================
        // ATOMICALLY CHANGE STATUS TO PROCESSING
        // =====================================================
        const processingResult = await pool.query(`
        UPDATE verification_requests
        SET
          status = 'processing'
        WHERE id = $1
          AND company_id = $2
          AND status = 'paid'
        RETURNING *
        `, [
            verificationRequest.id,
            company.id,
        ]);
        if (processingResult.rows.length === 0) {
            return res.status(409).json({
                success: false,
                message: "Verification request is already being processed or is no longer available",
            });
        }
        // =====================================================
        // BLOCKCHAIN VERIFICATION
        // =====================================================
        console.log("Starting blockchain certificate verification:", {
            verificationRequestId,
            certificateId: certificate.id,
            blockchainCertificateId: certificate.blockchain_certificate_id,
        });
        // Verify the actual IPFS file against the stored SHA-256 hash.
        try {
            if (!certificate.ipfs_url) {
                throw new Error("Certificate IPFS URL is missing");
            }
            const ipfsResponse = await fetch(certificate.ipfs_url);
            if (!ipfsResponse.ok) {
                throw new Error(`IPFS download failed with status ${ipfsResponse.status}`);
            }
            const fileBuffer = Buffer.from(await ipfsResponse.arrayBuffer());
            const actualFileHash = createHash("sha256").update(fileBuffer).digest("hex");
            if (actualFileHash !== normalizedHash) {
                await pool.query(`UPDATE certificates SET verification_status = 'unverified', updated_at = NOW() WHERE id = $1`, [certificate.id]);
                await pool.query(`UPDATE verification_requests SET status = 'failed', completed_at = NOW() WHERE id = $1 AND status = 'processing'`, [verificationRequest.id]);
                return res.status(422).json({
                    success: false,
                    message: "Certificate file integrity check failed",
                    hash_match: false,
                });
            }
        }
        catch (integrityError) {
            console.error("Certificate IPFS integrity check failed:", integrityError);
            await pool.query(`UPDATE verification_requests SET status = 'failed', completed_at = NOW() WHERE id = $1 AND status = 'processing'`, [verificationRequest.id]);
            return res.status(502).json({
                success: false,
                message: "Unable to verify the certificate file from IPFS",
            });
        }
        let verified;
        try {
            verified = certificate.contract_address
                ? await verifyCertificateAtAddress(certificate.contract_address, certificate.blockchain_certificate_id.toString(), blockchainHash)
                : await verifyCertificate(certificate.blockchain_certificate_id.toString(), blockchainHash);
        }
        catch (blockchainError) {
            console.error("Blockchain verification service error:", blockchainError);
            try {
                await pool.query(`
            UPDATE verification_requests
            SET
              status = 'failed',
              completed_at = NOW()
            WHERE id = $1
              AND status = 'processing'
            `, [verificationRequest.id]);
            }
            catch (dbError) {
                console.error("Failed to mark verification request as failed:", dbError);
            }
            return res.status(502).json({
                success: false,
                message: "Blockchain verification service failed",
            });
        }
        // =====================================================
        // UPDATE CERTIFICATE VERIFICATION STATUS
        // =====================================================
        const certificateVerificationStatus = verified
            ? "verified"
            : "unverified";
        const certificateUpdateResult = await pool.query(`
          UPDATE certificates
          SET
            verification_status = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING
            id,
            academic_record_id,
            original_file_name,
            mime_type,
            file_size,
            sha256_hash,
            ipfs_cid,
            ipfs_url,
            blockchain_network,
            contract_address,
            blockchain_certificate_id,
            transaction_hash,
            blockchain_status,
            verification_status
          `, [
            certificateVerificationStatus,
            certificate.id,
        ]);
        const updatedCertificate = certificateUpdateResult.rows[0];
        // =====================================================
        // BLOCKCHAIN-ONLY
        // =====================================================
        if (verificationRequest.verification_type ===
            "blockchain") {
            const applicationStatus = verified
                ? "verified"
                : "invalid";
            // ---------------------------------------------------
            // COMPLETE VERIFICATION REQUEST
            // ---------------------------------------------------
            const completedRequestResult = await pool.query(`
            UPDATE verification_requests
            SET
              status = 'completed',
              completed_at = NOW()
            WHERE id = $1
            RETURNING *
            `, [verificationRequest.id]);
            const completedRequest = completedRequestResult.rows[0];
            // ---------------------------------------------------
            // UPDATE APPLICATION
            // ---------------------------------------------------
            const applicationResult = await pool.query(`
            UPDATE applications
            SET
              status = $1,
              updated_at = NOW()
            WHERE id = $2
            RETURNING *
            `, [
                applicationStatus,
                verificationRequest.application_id,
            ]);
            const updatedApplication = applicationResult.rows[0];
            // ---------------------------------------------------
            // NOTIFY STUDENT
            // ---------------------------------------------------
            try {
                const studentResult = await pool.query(`
              SELECT user_id
              FROM students
              WHERE id = $1
              LIMIT 1
              `, [verificationRequest.student_id]);
                if (studentResult.rows.length > 0) {
                    const studentUserId = studentResult.rows[0].user_id;
                    await pool.query(`
              INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                related_application_id
              )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5
              )
              `, [
                        studentUserId,
                        "blockchain_verification",
                        verified
                            ? "Certificate Verified"
                            : "Certificate Verification Failed",
                        verified
                            ? `Your certificate for "${verificationRequest.job_title}" has been successfully verified on the blockchain.`
                            : `Your certificate for "${verificationRequest.job_title}" failed blockchain verification.`,
                        verificationRequest.application_id,
                    ]);
                }
            }
            catch (notificationError) {
                console.error("Failed to send student notification:", notificationError);
            }
            return res.json({
                success: true,
                message: verified
                    ? "Certificate verified successfully on blockchain"
                    : "Certificate failed blockchain verification",
                verification_type: "blockchain",
                verified,
                verification_request: completedRequest,
                certificate: updatedCertificate,
                application: updatedApplication,
            });
        }
        // =====================================================
        // COMBINED
        // =====================================================
        if (verificationRequest.verification_type ===
            "combined") {
            // ---------------------------------------------------
            // BLOCKCHAIN FAILED
            // ---------------------------------------------------
            if (!verified) {
                const failedRequestResult = await pool.query(`
              UPDATE verification_requests
              SET
                status = 'failed',
                completed_at = NOW()
              WHERE id = $1
              RETURNING *
              `, [verificationRequest.id]);
                const failedRequest = failedRequestResult.rows[0];
                // -------------------------------------------------
                // MARK APPLICATION INVALID
                // -------------------------------------------------
                const applicationResult = await pool.query(`
              UPDATE applications
              SET
                status = 'invalid',
                updated_at = NOW()
              WHERE id = $1
              RETURNING *
              `, [
                    verificationRequest.application_id,
                ]);
                const updatedApplication = applicationResult.rows[0];
                // -------------------------------------------------
                // NOTIFY STUDENT
                // -------------------------------------------------
                try {
                    const studentResult = await pool.query(`
                SELECT user_id
                FROM students
                WHERE id = $1
                LIMIT 1
                `, [verificationRequest.student_id]);
                    if (studentResult.rows.length > 0) {
                        const studentUserId = studentResult.rows[0].user_id;
                        await pool.query(`
                INSERT INTO notifications (
                  user_id,
                  type,
                  title,
                  message,
                  related_application_id
                )
                VALUES (
                  $1,
                  $2,
                  $3,
                  $4,
                  $5
                )
                `, [
                            studentUserId,
                            "blockchain_verification",
                            "Certificate Verification Failed",
                            `Your certificate for "${verificationRequest.job_title}" failed blockchain verification.`,
                            verificationRequest.application_id,
                        ]);
                    }
                }
                catch (notificationError) {
                    console.error("Failed to send student notification:", notificationError);
                }
                return res.json({
                    success: true,
                    message: "Blockchain verification failed. Combined verification cannot continue.",
                    verification_type: "combined",
                    verified: false,
                    next_step: null,
                    verification_request: failedRequest,
                    certificate: updatedCertificate,
                    application: updatedApplication,
                });
            }
            // ---------------------------------------------------
            // BLOCKCHAIN SUCCESS
            // ---------------------------------------------------
            // Keep status = processing because AI verification
            // must run next.
            // ---------------------------------------------------
            return res.json({
                success: true,
                message: "Blockchain verification completed successfully. AI forgery verification is required next.",
                verification_type: "combined",
                verified: true,
                next_step: "ai_forgery",
                verification_request: {
                    id: verificationRequest.id,
                    application_id: verificationRequest.application_id,
                    certificate_id: verificationRequest.certificate_id,
                    verification_type: verificationRequest.verification_type,
                    status: "processing",
                },
                certificate: updatedCertificate,
            });
        }
        // =====================================================
        // SAFETY FALLBACK
        // =====================================================
        await pool.query(`
        UPDATE verification_requests
        SET
          status = 'failed',
          completed_at = NOW()
        WHERE id = $1
          AND status = 'processing'
        `, [verificationRequest.id]);
        return res.status(400).json({
            success: false,
            message: "Unsupported verification type",
            verification_type: verificationRequest.verification_type,
        });
    }
    catch (error) {
        // =====================================================
        // MAIN CATCH
        // =====================================================
        console.error("Company blockchain verification error:", error);
        // =====================================================
        // TRY TO MARK REQUEST AS FAILED
        // =====================================================
        try {
            await pool.query(`
          UPDATE verification_requests
          SET
            status = 'failed',
            completed_at = NOW()
          WHERE id = $1
            AND status = 'processing'
          `, [verificationRequestId]);
        }
        catch (updateError) {
            console.error("Failed to mark verification request as failed:", updateError);
        }
        return res.status(500).json({
            success: false,
            message: "Failed to verify certificate on blockchain",
        });
    }
});
/**
 * POST /api/companies/login
 * TEMPORARY Step 7 login bridge.
 * JWT authentication remains reserved for Step 15.
 */
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }
        const result = await pool.query(`
      SELECT
        u.id AS user_id,
        u.full_name,
        u.email,
        u.role,
        u.password_hash,
        u.phone,
        c.id AS company_id,
        c.company_name,
        c.registration_number,
        c.industry,
        c.description,
        c.website,
        c.address,
        c.city,
        c.state,
        c.country,
        c.created_at,
        c.updated_at
      FROM users u
      INNER JOIN companies c ON c.user_id = u.id
      WHERE LOWER(u.email) = LOWER($1)
        AND u.role = 'company'
      LIMIT 1
      `, [email.trim()]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid company credentials",
            });
        }
        const user = result.rows[0];
        const expectedPassword = `mock_${user.email}`;
        if (user.password_hash !== expectedPassword ||
            password !== expectedPassword) {
            return res.status(401).json({
                success: false,
                message: "Invalid company credentials",
            });
        }
        return res.json({
            success: true,
            user: {
                id: String(user.user_id),
                full_name: user.full_name,
                email: user.email,
                role: user.role,
                phone: user.phone,
            },
            company: {
                id: String(user.company_id),
                user_id: String(user.user_id),
                company_name: user.company_name,
                registration_number: user.registration_number,
                industry: user.industry,
                description: user.description,
                website: user.website,
                address: user.address,
                city: user.city,
                state: user.state,
                country: user.country,
                created_at: user.created_at,
                updated_at: user.updated_at,
            },
        });
    }
    catch (error) {
        console.error("Company login error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to login company",
        });
    }
});
// =====================================================
// AI FORGERY VERIFY CERTIFICATE
// POST /api/companies/me/verification-requests/:id/ai-verify
// =====================================================
router.post("/me/verification-requests/:id/ai-verify", async (req, res) => {
    const verificationRequestId = req.params.id;
    try {
        const userId = req.header("x-user-id");
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "x-user-id header is required",
            });
        }
        if (!verificationRequestId) {
            return res.status(400).json({
                success: false,
                message: "Verification request ID is required",
            });
        }
        // =====================================================
        // GET COMPANY
        // =====================================================
        const companyResult = await pool.query(`
          SELECT
            id,
            user_id,
            company_name
          FROM companies
          WHERE user_id = $1
          LIMIT 1
          `, [userId]);
        if (companyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company profile not found",
            });
        }
        const company = companyResult.rows[0];
        // =====================================================
        // GET VERIFICATION REQUEST + CERTIFICATE
        // =====================================================
        const requestResult = await pool.query(`
          SELECT
            vr.id,
            vr.application_id,
            vr.company_id,
            vr.student_id,
            vr.certificate_id,
            vr.verification_type,
            vr.status,
            j.title AS job_title,
            cert.ipfs_url,
            cert.ipfs_cid,
            cert.sha256_hash,
            cert.blockchain_status,
            cert.verification_status
          FROM verification_requests vr
          JOIN certificates cert
            ON cert.id = vr.certificate_id
          JOIN applications a
            ON a.id = vr.application_id
          JOIN jobs j
            ON j.id = a.job_id
          WHERE vr.id = $1
            AND vr.company_id = $2
          LIMIT 1
          `, [verificationRequestId, company.id]);
        if (requestResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Verification request or certificate not found",
            });
        }
        const verificationRequest = requestResult.rows[0];
        // Combined verification requires confirmed blockchain status
        // and successful certificate file-integrity verification.
        if (verificationRequest.verification_type === "combined" &&
            (verificationRequest.blockchain_status !== "confirmed" ||
                verificationRequest.verification_status !== "verified")) {
            return res.status(409).json({
                success: false,
                message: "Combined verification requires successful blockchain and file-integrity verification",
                blockchain_status: verificationRequest.blockchain_status,
                verification_status: verificationRequest.verification_status,
            });
        }
        // =====================================================
        // VALIDATE VERIFICATION TYPE
        // =====================================================
        if (verificationRequest.verification_type !== "ai_forgery" &&
            verificationRequest.verification_type !== "combined") {
            return res.status(400).json({
                success: false,
                message: "AI verification is available only for AI forgery or combined verification requests",
            });
        }
        // =====================================================
        // VALIDATE PAYMENT
        // =====================================================
        const expectedAIStatus = verificationRequest.verification_type === "combined"
            ? "processing"
            : "paid";
        if (verificationRequest.status !== expectedAIStatus) {
            return res.status(400).json({
                success: false,
                message: verificationRequest.verification_type === "combined"
                    ? "Blockchain verification must be completed successfully before AI verification"
                    : "Verification payment must be completed first",
                status: verificationRequest.status,
                expected_status: expectedAIStatus,
            });
        }
        if (!verificationRequest.ipfs_url) {
            return res.status(400).json({
                success: false,
                message: "Certificate IPFS URL is missing",
            });
        }
        // =====================================================
        // RUN AI DOCUMENT ANALYSIS
        // =====================================================
        const analysis = await analyzeCertificateWithAI(verificationRequest.ipfs_url, verificationRequest.sha256_hash || "");
        // =====================================================
        // SAVE AI VERIFICATION
        // =====================================================
        const aiResult = await pool.query(`
          INSERT INTO ai_verifications (
            verification_request_id,
            confidence_score,
            verdict,
            analysis_details,
            model_name,
            checked_at
          )
          VALUES ($1, $2, $3, $4, $5, NOW())
          RETURNING *
          `, [
            verificationRequestId,
            analysis.confidenceScore,
            analysis.verdict,
            JSON.stringify({
                indicators: analysis.indicators,
                page_count: analysis.pageCount,
                text_length: analysis.textLength,
                details: analysis.analysisDetails,
            }),
            analysis.modelName,
        ]);
        // =====================================================
        // AI-ONLY REPORT
        // =====================================================
        if (verificationRequest.verification_type === "ai_forgery") {
            const finalStatus = analysis.verdict === "genuine"
                ? "verified"
                : analysis.verdict === "suspicious"
                    ? "suspicious"
                    : "invalid";
            await pool.query(`
            INSERT INTO verification_reports (
              verification_request_id,
              blockchain_result,
              ai_result,
              final_status,
              blockchain_hash_match,
              ai_confidence_score,
              report_data,
              generated_at
            )
            VALUES ($1, NULL, $2, $3, NULL, $4, $5::jsonb, NOW())
            ON CONFLICT (verification_request_id)
            DO UPDATE SET
              ai_result = EXCLUDED.ai_result,
              final_status = EXCLUDED.final_status,
              ai_confidence_score = EXCLUDED.ai_confidence_score,
              report_data = EXCLUDED.report_data,
              generated_at = NOW()
            `, [
                verificationRequestId,
                analysis.verdict,
                finalStatus,
                analysis.confidenceScore,
                JSON.stringify({
                    type: "ai_forgery",
                    model_name: analysis.modelName,
                    forgery_probability: analysis.forgeryProbability,
                    indicators: analysis.indicators,
                    analysis_details: analysis.analysisDetails,
                    page_count: analysis.pageCount,
                    text_length: analysis.textLength,
                }),
            ]);
            await pool.query(`
            UPDATE verification_requests
            SET status = 'completed',
                completed_at = NOW()
            WHERE id = $1
            `, [verificationRequestId]);
        }
        // =====================================================
        // COMBINED VERIFICATION REPORT
        // =====================================================
        if (verificationRequest.verification_type === "combined") {
            const blockchainPassed = verificationRequest.blockchain_status === "confirmed" &&
                verificationRequest.verification_status === "verified";
            const combinedFinalStatus = analysis.verdict === "forged"
                ? "invalid"
                : analysis.verdict === "suspicious" || !blockchainPassed
                    ? "suspicious"
                    : "verified";
            await pool.query(`
            INSERT INTO verification_reports (
              verification_request_id,
              blockchain_result,
              ai_result,
              final_status,
              blockchain_hash_match,
              ai_confidence_score,
              report_data,
              generated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
            ON CONFLICT (verification_request_id)
            DO UPDATE SET
              blockchain_result = EXCLUDED.blockchain_result,
              ai_result = EXCLUDED.ai_result,
              final_status = EXCLUDED.final_status,
              blockchain_hash_match = EXCLUDED.blockchain_hash_match,
              ai_confidence_score = EXCLUDED.ai_confidence_score,
              report_data = EXCLUDED.report_data,
              generated_at = NOW()
            `, [
                verificationRequestId,
                verificationRequest.blockchain_status === "confirmed" &&
                    verificationRequest.verification_status === "verified"
                    ? "verified"
                    : "failed",
                analysis.verdict,
                combinedFinalStatus,
                verificationRequest.blockchain_status === "confirmed" &&
                    verificationRequest.verification_status === "verified",
                analysis.confidenceScore,
                JSON.stringify({
                    type: "combined",
                    blockchain_result: verificationRequest.blockchain_status === "confirmed" &&
                        verificationRequest.verification_status === "verified"
                        ? "verified"
                        : "failed",
                    blockchain_hash_match: verificationRequest.blockchain_status === "confirmed" &&
                        verificationRequest.verification_status === "verified",
                    model_name: analysis.modelName,
                    forgery_probability: analysis.forgeryProbability,
                    ai_verdict: analysis.verdict,
                    indicators: analysis.indicators,
                    analysis_details: analysis.analysisDetails,
                    page_count: analysis.pageCount,
                    text_length: analysis.textLength,
                }),
            ]);
            await pool.query(`
            UPDATE verification_requests
            SET
              status = 'completed',
              completed_at = NOW()
            WHERE id = $1
            `, [verificationRequestId]);
        }
        // =====================================================
        // UPDATE APPLICATION STATUS AFTER AI VERIFICATION
        // =====================================================
        const applicationStatus = verificationRequest.verification_type === "combined"
            ? (analysis.verdict === "forged"
                ? "invalid"
                : analysis.verdict === "suspicious" ||
                    !(verificationRequest.blockchain_status === "confirmed" &&
                        verificationRequest.verification_status === "verified")
                    ? "suspicious"
                    : "verified")
            : analysis.verdict === "genuine"
                ? "verified"
                : analysis.verdict === "suspicious"
                    ? "suspicious"
                    : "invalid";
        const applicationResult = await pool.query(`
          UPDATE applications
          SET
            status = CASE
              WHEN status IN ('selected', 'rejected') THEN status
              ELSE $1
            END,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
          `, [
            applicationStatus,
            verificationRequest.application_id,
        ]);
        const updatedApplication = applicationResult.rows[0];
        // =====================================================
        // NOTIFY STUDENT OF FINAL AI VERIFICATION RESULT
        // =====================================================
        try {
            const studentResult = await pool.query(`
            SELECT user_id
            FROM students
            WHERE id = $1
            LIMIT 1
            `, [verificationRequest.student_id]);
            if (studentResult.rows.length > 0) {
                const studentUserId = studentResult.rows[0].user_id;
                await pool.query(`
              INSERT INTO notifications (
                user_id,
                type,
                title,
                message,
                related_application_id,
                related_verification_id
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              `, [
                    studentUserId,
                    "ai_verification",
                    (applicationStatus === "verified" ? "Certificate Verified" : applicationStatus === "suspicious" ? "Certificate Requires Review" : "Certificate Verification Failed"),
                    (applicationStatus === "verified" ? `Your certificate for "${verificationRequest.job_title}" passed AI forgery verification.` : applicationStatus === "suspicious" ? `Your certificate for "${verificationRequest.job_title}" requires further review after AI forgery verification.` : `Your certificate for "${verificationRequest.job_title}" failed AI forgery verification.`),
                    verificationRequest.application_id,
                    verificationRequestId,
                ]);
            }
        }
        catch (notificationError) {
            console.error("Failed to send AI verification notification:", notificationError);
        }
        return res.json({
            success: true,
            message: "AI forgery verification completed successfully",
            verification_request_id: String(verificationRequestId),
            ai_verification: {
                id: String(aiResult.rows[0].id),
                verdict: analysis.verdict,
                confidence_score: analysis.confidenceScore,
                forgery_probability: analysis.forgeryProbability,
                indicators: analysis.indicators,
                analysis_details: analysis.analysisDetails,
                model_name: analysis.modelName,
                page_count: analysis.pageCount,
                text_length: analysis.textLength,
            },
        });
    }
    catch (error) {
        console.error("AI forgery verification error:", error);
        return res.status(500).json({
            success: false,
            message: error instanceof Error
                ? error.message
                : "AI forgery verification failed",
        });
    }
});
/**
 * GET /api/companies/me/notifications
 * Get notifications for the logged-in company.
 */
router.get("/me/notifications", async (req, res) => {
    try {
        const userId = req.header("x-user-id");
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
        console.error("Get company notifications error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications",
        });
    }
});
export default router;
//# sourceMappingURL=companyRoutes.js.map