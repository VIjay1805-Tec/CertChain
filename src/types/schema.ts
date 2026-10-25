// ============================================================
// CertiGuard â€” Database Schema Types
// These interfaces mirror a real relational DB schema for a
// clean 1:1 mapping when the backend is wired in later.
// ============================================================

export type UserRole = 'institute' | 'student' | 'company';

export type VerificationStatus = 'pending' | 'verified' | 'suspicious' | 'invalid';

export type ApplicationStage =
  | 'applied'
  | 'institute_notified'
  | 'certificate_uploaded'
  | 'verification_requested'
  | 'verification_completed'
  | 'selected'
  | 'rejected';

export type VerificationTier = 'blockchain' | 'ai_forgery' | 'combined';

export type VerificationVerdict = 'verified' | 'suspicious' | 'invalid';

export type NotificationType =
  | 'student_applied'
  | 'certificate_uploaded'
  | 'verification_requested'
  | 'verification_completed'
  | 'verification_result_student'
  | 'verification_result_institute';

// ---------- Users / Accounts ----------

export interface User {
  id: string;
  email: string;
  password_hash: string; // mock â€” real auth added with backend
  role: UserRole;
  name: string;
  created_at: string;
}

export interface Institute {
  id: string;
  user_id: string;
  name: string; // institute name
  email: string;
  location: string;
  established_year: number;
  created_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  institute_id: string;
  enrollment_id: string;
  program: string;
  created_at: string;
}

export interface Company {
  id: string;
  user_id: string;
  name: string; // company name
  email: string;
  industry: string;
  location: string;
  created_at: string;
}

// ---------- Academic Records ----------

export interface AcademicRecord {
  id: string;
  student_id: string;
  institute_id: string;
  degree: string;
  course: string;
  grade: string;
  graduation_year: number;
  created_at: string;
}

// ---------- Certificates (uploaded by institute after notification) ----------

export interface Certificate {
  id: string;
  student_id: string;
  institute_id: string;
  record_id: string;
  application_id: string; // tied to a specific job application
  file_name: string;
  file_size: number;
  sha256_hash: string;
  ipfs_cid: string;
  blockchain_tx_hash: string;
  blockchain_contract_address: string;
  uploaded_at: string;
}

// ---------- Jobs ----------

export interface Job {
  id: string;
  company_id: string;
  title: string;
  description: string;
  requirements: string;
  location: string;
  salary_range: string;
  created_at: string;
}

// ---------- Applications ----------

export interface Application {
  id: string;
  job_id: string;
  student_id: string;
  institute_id: string;
  company_id: string;
  cover_note: string;
  stage: ApplicationStage;
  applied_at: string;
  certificate_id: string | null;
  student_name?: string;
  student_email?: string;
  student_phone?: string;
  student_code?: string;
  institute_name?: string;

  academic_record_id?: string | null;
  record_type?: string | null;
  academic_title?: string | null;
  grade?: string | null;
  percentage?: number | string | null;
  cgpa?: number | string | null;
  issue_date?: string | null;
  completion_date?: string | null;
  academic_description?: string | null;

  original_file_name?: string | null;
  sha256_hash?: string | null;
  ipfs_cid?: string | null;
  ipfs_url?: string | null;
  transaction_hash?: string | null;
  contract_address?: string | null;
  blockchain_certificate_id?: string | null;
  blockchain_status?: string | null;
  verification_status?: string | null;
}

// ---------- Verifications ----------

export interface Verification {
  id: string;
  application_id: string;
  company_id: string;
  student_id: string;
  institute_id: string;
  tier: VerificationTier;
  amount_paid: number;
  payment_status: 'pending' | 'completed';
  // blockchain check
  blockchain_check: {
    performed: boolean;
    stored_hash: string;
    stored_cid: string;
    document_hash: string;
    match: boolean | null;
  };
  // AI forgery check
  ai_forgery_check: {
    performed: boolean;
    result: 'genuine' | 'suspicious' | 'forged' | null;
    confidence_score: number | null;
    forgery_probability: number | null;
    indicators: string[];
  };
  // final verdict
  verdict: VerificationVerdict | null;
  confidence: number | null;
  blockchain_proof_ref: string | null;
  report_generated_at: string | null;
  created_at: string;
}

// ---------- Notifications ----------

export interface AppNotification {
  id: string;
  recipient_role: UserRole;
  recipient_id: string; // user_id or entity id
  type: NotificationType;
  title: string;
  message: string;
  application_id: string | null;
  student_id: string | null;
  job_id: string | null;
  read: boolean;
  created_at: string;
}

// ---------- Auth Session (mock) ----------

export interface AuthSession {
  user: User;
  entity: Institute | Student | Company;
}



