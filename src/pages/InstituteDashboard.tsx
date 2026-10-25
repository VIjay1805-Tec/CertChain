import { useEffect, useState } from 'react';




import {
  Building2, Users, FileText, ShieldCheck, Clock, UserPlus,
  Bell, Upload, Hash, Link2, Boxes, CheckCircle2,
  FileCheck, ChevronRight,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard, EmptyState, SectionHeader } from '@/components/ui/Common';
import { useStore } from '@/store/AppStore';
import type { Student, AcademicRecord, AppNotification } from '@/types/schema';

type Tab = 'overview' | 'students' | 'records' | 'verification_requests' | 'certificates' | 'notifications';

export function InstituteDashboard() {
  const store = useStore();
  const { session } = store;
  const [tab, setTab] = useState<Tab>('overview');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AcademicRecord | null>(null);
  const [recordStudentId, setRecordStudentId] = useState('');
  const [uploadNotif, setUploadNotif] = useState<AppNotification | null>(null);
  const [uploadStep, setUploadStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [selectedCertificateFile, setSelectedCertificateFile] = useState<File | null>(null);

  if (!session) return null;
  const inst = session.entity as typeof session.entity & { id: string };

  const instStudents = store.getInstituteStudents(inst.id);
  const instRecords = store.getInstituteRecords(inst.id);
  const instNotifs = store.getNotificationsFor('institute', session.user.id);

  const verifiedCount = instStudents.filter((s) => {
    const certs = store.certificates.filter((c) => c.student_id === s.id);
    const vers = store.verifications.filter((v) => v.student_id === s.id);
    return vers.some((v) => v.verdict === 'verified') && certs.length > 0;
  }).length;

  const pendingCount = store.applications.filter((app) => app.institute_id === inst.id && app.stage !== 'rejected' && app.stage !== 'verification_completed' && !store.getCertificateForApplication(app.id)).length;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Building2 },
    { key: 'students', label: 'Students', icon: Users },
    { key: 'records', label: 'Records', icon: FileText },
    { key: 'verification_requests', label: 'Verification Requests', icon: Clock },
    { key: 'certificates', label: 'Certificates', icon: ShieldCheck },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ];

  function handleNotifClick(_notifId: string, applicationId: string | null, _studentId: string | null) {
    void _studentId;
    if (!applicationId) return;
    const notif = instNotifs.find((n) => n.application_id === applicationId && n.type === 'student_applied');
    if (notif) {
      setUploadNotif(notif);
      setUploadStep(0);
      setTab('overview');
    }
  }

  async function handleUpload() {
    if (!uploadNotif || !selectedCertificateFile) {
      alert("Please select a certificate file first.");
      return;
    }

    setUploading(true);

    try {
      const app = store.getApplicationById(uploadNotif.application_id!);

      if (!app) {
        throw new Error("Application not found: " + uploadNotif.application_id);
      }

      const stuRecords = store.getStudentRecords(uploadNotif.student_id!);
      const record = stuRecords[0];

      if (!record) {
        throw new Error("Academic record not found for student: " + uploadNotif.student_id);
      }

      setUploadStep(0);
      await new Promise((r) => setTimeout(r, 1000));

      setUploadStep(1);
      await new Promise((r) => setTimeout(r, 1200));

      setUploadStep(2);
      await new Promise((r) => setTimeout(r, 1000));

      await store.uploadCertificate({
        applicationId: app.id,
        studentId: uploadNotif.student_id!,
        recordId: String(record.id),
        file: selectedCertificateFile,
      });

      setUploadNotif(null);
    } catch (error) {
      console.error("Certificate upload error:", error);
      alert(error instanceof Error ? error.message : "Certificate upload failed");
    } finally {
      setUploading(false);
      setUploadStep(0);
    }
  }

  return (
    <DashboardLayout activeTab={tab} tabs={tabs} onTabChange={(k) => setTab(k as Tab)} onNotificationClick={handleNotifClick}>
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Students" value={instStudents.length} icon={Users} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <StatCard label="Records Added" value={instRecords.length} icon={FileText} iconBg="bg-accent-50" iconColor="text-accent-600" />
            <StatCard label="Certificates Verified" value={verifiedCount} icon={ShieldCheck} iconBg="bg-success-50" iconColor="text-success-600" />
            <StatCard label="Pending Requests" value={pendingCount} icon={Clock} iconBg="bg-warning-50" iconColor="text-warning-600" />
          </div>

          {/* Pending notifications / upload requests */}
          <div className="card p-6">
            <SectionHeader title="Pending Verification Requests" description="Applications that still need a certificate upload" />
            {store.applications.filter((app) => app.institute_id === inst.id && app.stage !== 'rejected' && app.stage !== 'verification_completed' && !store.getCertificateForApplication(app.id)).length === 0 ? (
              <EmptyState icon={Bell} title="No pending requests" description="Applications that need certificates will appear here." />
            ) : (
              <div className="space-y-3">
                {store.applications
                  .filter((app) => app.institute_id === inst.id && app.stage !== 'rejected' && app.stage !== 'verification_completed' && !store.getCertificateForApplication(app.id))
                  .map((app) => {
                    const student = store.getStudentById(app.student_id);
                    const job = store.getJobById(app.job_id);
                    const notif: AppNotification = {
                      id: `application-${app.id}`,
                      recipient_role: 'institute',
                      recipient_id: session.user.id,
                      type: 'student_applied',
                      title: 'Student Applied for Job',
                      message: `${student?.full_name || 'A student'} applied for "${job?.title || 'a job'}" � upload their certificate for verification.`,
                      application_id: app.id,
                      student_id: app.student_id,
                      job_id: app.job_id,
                      read: false,
                      created_at: app.applied_at,
                    };
                    return (
                      <div key={app.id} className="flex items-center gap-4 p-4 rounded-xl border bg-amber-50/50 border-amber-100">
                        <div className="w-10 h-10 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-semibold">
                          {student?.full_name?.split(' ').map((w) => w[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{notif.message}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{student?.email} � {job?.title}</p>
                        </div>
                        <button onClick={() => { setUploadNotif(notif); setUploadStep(0); }} className="btn-primary">
                          <Upload className="w-4 h-4" />
                          Upload Certificate
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          {/* Recent students */}
          <div className="card p-6">
            <SectionHeader title="Recent Students" action={<button onClick={() => setShowAddStudent(true)} className="btn-primary"><UserPlus className="w-4 h-4" />Add Student</button>} />
            {instStudents.length === 0 ? (
              <EmptyState icon={Users} title="No students yet" description="Add your first student to get started." action={<button onClick={() => setShowAddStudent(true)} className="btn-primary"><UserPlus className="w-4 h-4" />Add Student</button>} />
            ) : (
              <div className="space-y-2">
                {instStudents.slice(0, 5).map((s) => {
                  const sRecords = store.getStudentRecords(s.id);
                  const sApps = store.getStudentApplications(s.id);
                  const sVer = store.verifications.filter((v) => v.student_id === s.id);
                  const status = sVer.some((v) => v.verdict === 'verified') ? 'verified'
                    : sVer.some((v) => v.verdict === 'suspicious') ? 'suspicious'
                    : sVer.some((v) => v.verdict === 'invalid') ? 'invalid'
                    : 'pending';
                  return (
                    <div key={s.id} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
                        {s.full_name.split(' ').map((w) => w[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                        <p className="text-xs text-slate-500">{s.email} • {s.enrollment_id}</p>
                      </div>
                      <div className="hidden sm:block text-xs text-slate-500">{sRecords.length} records • {sApps.length} applications</div>
                      <StatusBadge status={status} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'students' && (
        <StudentsTab instId={inst.id} onAddStudent={() => setShowAddStudent(true)} onAddRecord={(sid) => { setRecordStudentId(sid); setShowAddRecord(true); }} />
      )}

      {tab === 'records' && (
        <RecordsTab instId={inst.id} onAddRecord={() => { setEditingRecord(null); setRecordStudentId(''); setShowAddRecord(true); }} />
      )}

      {tab === 'verification_requests' && (
        <VerificationRequestsTab instId={inst.id} onUploadNotif={(n) => { setUploadNotif(n); setUploadStep(0); }} />
      )}

      {tab === 'certificates' && (
        <CertificatesTab instId={inst.id} />
      )}

      {tab === 'notifications' && (
        <div className="card p-6">
          <SectionHeader title="All Notifications" description="Stay updated on student applications and verification results" />
          {instNotifs.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="You'll be notified when students apply for jobs." />
          ) : (
            <div className="space-y-2">
              {instNotifs.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border ${n.read ? 'border-slate-100' : 'border-accent-100 bg-accent-50/30'}`}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Bell className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                  {n.type === 'student_applied' && n.application_id && (
                    <button onClick={() => { setUploadNotif(n); setUploadStep(0); }} className="btn-ghost text-accent-600">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Student Modal */}
      <AddStudentModal open={showAddStudent} onClose={() => setShowAddStudent(false)} />

      {/* Add Record Modal */}
      <AddRecordModal open={showAddRecord} onClose={() => { setShowAddRecord(false); setEditingRecord(null); }} studentId={recordStudentId} students={instStudents} record={editingRecord} />

      {/* Certificate Upload Modal (3-step) */}
      <CertificateUploadModal
        notif={uploadNotif}
        step={uploadStep}
        uploading={uploading}
        onClose={() => { if (!uploading) { setUploadNotif(null); setUploadStep(0); } }}
        onUpload={handleUpload}
        store={store}
          selectedCertificateFile={selectedCertificateFile}
          setSelectedCertificateFile={setSelectedCertificateFile}
      />
    </DashboardLayout>
  );
}

// ============================================================
// Students Tab
// ============================================================

function StudentsTab({ instId, onAddStudent, onAddRecord }: { instId: string; onAddStudent: () => void; onAddRecord: (sid: string) => void }) {
  const store = useStore();
  const students = store.getInstituteStudents(instId);

  return (
    <div className="card p-6">
      <SectionHeader title="Students" description="Manage your enrolled students and their records" action={<button onClick={onAddStudent} className="btn-primary"><UserPlus className="w-4 h-4" />Add Student</button>} />
      {students.length === 0 ? (
        <EmptyState icon={Users} title="No students yet" description="Add your first student to get started." action={<button onClick={onAddStudent} className="btn-primary"><UserPlus className="w-4 h-4" />Add Student</button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Student</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Enrollment</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Program</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Records</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Actions</th>
                <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const sRecords = store.getStudentRecords(s.id);
                const sVer = store.verifications.filter((v) => v.student_id === s.id);
                const status = sVer.some((v) => v.verdict === 'verified') ? 'verified'
                  : sVer.some((v) => v.verdict === 'suspicious') ? 'suspicious'
                  : sVer.some((v) => v.verdict === 'invalid') ? 'invalid'
                  : 'pending';
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold">
                          {s.full_name.split(' ').map((w) => w[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{s.full_name}</p>
                          <p className="text-xs text-slate-500">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-600">{s.enrollment_id}</td>
                    <td className="py-3 px-2 text-sm text-slate-600">{s.program}</td>
                    <td className="py-3 px-2 text-sm text-slate-600">{sRecords.length}</td>
                    <td className="py-3 px-2"><StatusBadge status={status} /></td>
                    <td className="py-3 px-2 text-right">
                      <button onClick={() => onAddRecord(s.id)} className="btn-ghost">
                        <FileText className="w-4 h-4" />Add Record
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Records Tab
// ============================================================

function RecordsTab({ instId, onAddRecord }: { instId: string; onAddRecord: () => void }) {
  const store = useStore();
  const records = store.getInstituteRecords(instId);

  return (
    <div className="card p-6">
      <SectionHeader title="Academic Records" description="All academic records added by your institute" action={<button onClick={onAddRecord} className="btn-primary"><FileText className="w-4 h-4" />Add Record</button>} />
      {records.length === 0 ? (
        <EmptyState icon={FileText} title="No records yet" description="Add academic records for your students." action={<button onClick={onAddRecord} className="btn-primary"><FileText className="w-4 h-4" />Add Record</button>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Student</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Degree</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Course</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Grade</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Year</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const student = store.getStudentById(r.student_id);
                const sVer = store.verifications.filter((v) => v.student_id === r.student_id);
                const status = sVer.some((v) => v.verdict === 'verified') ? 'verified'
                  : sVer.some((v) => v.verdict === 'suspicious') ? 'suspicious'
                  : sVer.some((v) => v.verdict === 'invalid') ? 'invalid'
                  : 'pending';
                return (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-2">
                      <p className="text-sm font-medium text-slate-900">{student?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{student?.enrollment_id}</p>
                    </td>
                    <td className="py-3 px-2 text-sm text-slate-600">{r.degree}</td>
                    <td className="py-3 px-2 text-sm text-slate-600">{r.course}</td>
                    <td className="py-3 px-2"><span className="text-sm font-medium text-slate-900">{r.grade}</span></td>
                    <td className="py-3 px-2 text-sm text-slate-600">{r.graduation_year}</td>
                    <td className="py-3 px-2"><StatusBadge status={status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Add Student Modal
// ============================================================

function AddStudentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addStudent } = useStore();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [enrollmentId, setEnrollmentId] = useState('');
  const [program, setProgram] = useState('');

  function handleSubmit() {
    if (!fullName.trim() || !email.trim() || !enrollmentId.trim() || !program.trim()) return;
    addStudent({ fullName, email, enrollmentId, program });
    setFullName(''); setEmail(''); setEnrollmentId(''); setProgram('');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Student" subtitle="Register a new student under your institute">
      <div className="space-y-4">
        <div>
          <label className="label-text">Full Name</label>
          <input className="input-field" placeholder="e.g. Arjun Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="label-text">Email Address</label>
          <input className="input-field" type="email" placeholder="student@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">Enrollment ID</label>
            <input className="input-field" placeholder="NIT2021001" value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Program</label>
            <input className="input-field" placeholder="Computer Science" value={program} onChange={(e) => setProgram(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary flex-1"><UserPlus className="w-4 h-4" />Add Student</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Add Record Modal
// ============================================================

function AddRecordModal({
  open, onClose, studentId, students, record,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  students: Student[];
  record: AcademicRecord | null;
}) {
  const { addAcademicRecord, updateAcademicRecord } = useStore();
  const [sid, setSid] = useState(studentId);
  const [degree, setDegree] = useState('');
  const [course, setCourse] = useState('');
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState('');

  useEffect(() => {
    setSid(record?.student_id || studentId);
    setDegree(record?.degree || '');
    setCourse(record?.course || '');
    setGrade(record?.grade || '');
    setYear(record ? String(record.graduation_year) : '');
  }, [record, studentId, open]);

  async function handleSubmit() {
    const targetSid = sid || studentId;
    if (
      !targetSid.trim() ||
      !degree.trim() ||
      !course.trim() ||
      !grade.trim() ||
      !year.trim()
    ) return;

    const graduationYear = Number(year);
    if (!Number.isInteger(graduationYear) || graduationYear < 1900 || graduationYear > 2100) {
      console.error('Enter a valid graduation year.');
      return;
    }

    try {
      const data = {
        studentId: targetSid,
        degree: degree.trim(),
        course: course.trim(),
        grade: grade.trim(),
        graduationYear,
      };

      if (record) {
        await updateAcademicRecord(record.id, data);
      } else {
        await addAcademicRecord(data);
      }

      setDegree('');
      setCourse('');
      setGrade('');
      setYear('');
      onClose();
    } catch (error) {
      console.error(record ? 'Failed to update academic record:' : 'Failed to create academic record:', error);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edit Academic Record' : 'Add Academic Record'}
      subtitle={record ? 'Update the selected student academic record' : 'Create a new academic record for a student'}
    >
      <div className="space-y-4">
        <div>
          <label className="label-text">Student</label>
          <select
            className="input-field"
            value={sid || studentId}
            onChange={(e) => setSid(e.target.value)}
            disabled={!!record}
          >
            <option value="">Select a student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.full_name} ({s.enrollment_id})</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">Degree</label>
            <input className="input-field" placeholder="B.Tech" value={degree} onChange={(e) => setDegree(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Course</label>
            <input className="input-field" placeholder="Computer Science" value={course} onChange={(e) => setCourse(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-text">Grade</label>
            <input className="input-field" placeholder="A+" value={grade} onChange={(e) => setGrade(e.target.value)} />
          </div>
          <div>
            <label className="label-text">Graduation Year</label>
            <input className="input-field" type="number" placeholder="2024" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary flex-1">
            <FileText className="w-4 h-4" />
            {record ? 'Save Changes' : 'Add Record'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
// ============================================================
// Certificate Upload Modal — 3-step visual process
// ============================================================

const STEPS = [
  { label: 'Generate SHA-256 Hash', icon: Hash, desc: 'Creating a unique cryptographic fingerprint of the certificate' },
  { label: 'Upload to IPFS', icon: Link2, desc: 'Storing the document on the InterPlanetary File System' },
  { label: 'Store Hash + CID on Blockchain', icon: Boxes, desc: 'Permanently recording the proof on-chain' },
];

function CertificateUploadModal({
  notif, step, uploading, onClose, onUpload, store, setSelectedCertificateFile,
}: {
  notif: AppNotification | null;
  step: number;
  uploading: boolean;
  onClose: () => void;
  onUpload: () => void;
  store: ReturnType<typeof useStore>;
  selectedCertificateFile: File | null;
  setSelectedCertificateFile: (file: File | null) => void;
}) {
  if (!notif) return null;
  const student = store.getStudentById(notif.student_id!);
  const job = store.getJobById(notif.job_id!);
  const app = store.getApplicationById(notif.application_id!);
  const hasCert = app?.certificate_id !== null && app?.certificate_id !== undefined;

  return (
    <Modal open={!!notif} onClose={onClose} title="Upload Certificate" subtitle={`${student?.full_name} — for ${job?.title}`} size="lg">
      <div className="space-y-5">
        {/* Student info */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50">
          <div className="w-12 h-12 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-semibold">
            {student?.full_name?.split(' ').map((w) => w[0]).join('')}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{student?.full_name}</p>
            <p className="text-xs text-slate-500">{student?.email} • {student?.enrollment_id}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Applied for</p>
            <p className="text-sm font-medium text-slate-900">{job?.title}</p>
          </div>
        </div>

        {hasCert && !uploading ? (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-success-50 border border-success-100">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
            <p className="text-sm font-medium text-success-700">Certificate already uploaded and stored on blockchain.</p>
          </div>
        ) : uploading ? (
          /* 3-step tracker */
          <div className="space-y-4 py-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = i < step;
              const isActive = i === step;
              const isPending = i > step;
              return (
                <div key={i} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isDone ? 'bg-success-100' : isActive ? 'bg-accent-600' : 'bg-slate-100'
                    }`}>
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-success-600" />
                      ) : isActive ? (
                        <Icon className="w-5 h-5 text-white animate-pulse" />
                      ) : (
                        <Icon className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-0.5 h-12 mt-1 rounded-full transition-colors ${isDone ? 'bg-success-200' : 'bg-slate-100'}`} />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <p className={`text-sm font-medium ${isPending ? 'text-slate-400' : 'text-slate-900'}`}>{s.label}</p>
                    <p className={`text-xs mt-0.5 ${isPending ? 'text-slate-400' : 'text-slate-500'}`}>{s.desc}</p>
                    {isActive && (
                      <p className="text-xs text-accent-600 mt-1 font-medium animate-pulse">Processing...</p>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="pt-4">
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-accent-600 rounded-full transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-500 mt-2 text-center">Step {step + 1} of 3</p>
            </div>
          </div>
        ) : (
          /* Upload prompt */
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
              <FileCheck className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSelectedCertificateFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-slate-600 mt-3" />
              <p className="text-sm font-medium text-slate-900">Upload Original Certificate</p>
              <p className="text-xs text-slate-500 mt-1">PDF, JPG, PNG up to 10MB</p>
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-600">
                <FileText className="w-3.5 h-3.5" />
                {student?.full_name}_certificate.pdf
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent-50 border border-accent-100">
              <ShieldCheck className="w-5 h-5 text-accent-600 flex-shrink-0" />
              <p className="text-xs text-accent-700">This certificate will be cryptographically hashed, stored on IPFS, and recorded on the blockchain as the trusted original.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button onClick={onUpload} className="btn-primary flex-1">
                <Upload className="w-4 h-4" />Start Upload
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ============================================================
// Certificates Tab
// ============================================================

function CertificatesTab({ instId }: { instId: string }) {
  const store = useStore();

  const instituteCertificates = store.certificates.filter(
    (certificate) => certificate.institute_id === instId
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Issued Certificates"
        description="Certificates uploaded and recorded for your institute"
      />

      {instituteCertificates.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={ShieldCheck}
            title="No certificates uploaded"
            description="Uploaded certificates will appear here after the institute completes the upload process."
          />
        </div>
      ) : (
        <div className="card p-6">
          <div className="space-y-3">
            {instituteCertificates.map((certificate) => {
              const student = store.getStudentById(certificate.student_id);

              return (
                <div
                  key={certificate.id}
                  className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-slate-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-success-50 text-success-700 flex items-center justify-center flex-shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {student?.full_name || 'Unknown Student'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {student?.email || 'No student email'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 break-all">
                      File: {certificate.file_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 break-all">
                      SHA-256: {certificate.sha256_hash}
                    </p>
                  </div>

                  <div className="flex flex-col items-start md:items-end gap-2">
                    <StatusBadge status="certificate_uploaded" />
                    <p className="text-xs text-slate-500">
                      {new Date(certificate.uploaded_at).toLocaleString()}
                    </p>
                    {certificate.blockchain_tx_hash && (
                      <p className="text-xs text-slate-400 break-all">
                        TX: {certificate.blockchain_tx_hash}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
// ============================================================
// Verification Requests Tab
// ============================================================

function VerificationRequestsTab({ instId, onUploadNotif }: { instId: string; onUploadNotif: (n: AppNotification) => void }) {
  const store = useStore();
  const instNotifs = store.getNotificationsFor('institute', store.session!.user.id);

  const instituteApplications = store.applications.filter(
    (app) => app.institute_id === instId
  );

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Verification Requests"
        description="All requests triggered by student job applications"
      />

      {instituteApplications.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={Clock}
            title="No verification requests"
            description="When students apply for jobs, verification requests will appear here."
          />
        </div>
      ) : (
        <div className="card p-6">
          <div className="space-y-3">
            {instituteApplications.map((app) => {
              const student = store.getStudentById(app.student_id);
              const job = store.getJobById(app.job_id);
              const notif = instNotifs.find(
                (n) =>
                  n.application_id === app.id &&
                  n.type === 'student_applied'
              );
              const cert = store.getCertificateForApplication(app.id);
              const ver = store.getVerificationForApplication(app.id);

              let statusLabel = 'Pending Approval';
              let statusColor = 'bg-amber-50 text-amber-600';

              if (ver?.verdict === 'verified') {
                statusLabel = 'Verified';
                statusColor = 'bg-success-100 text-success-700';
              } else if (ver?.verdict === 'suspicious') {
                statusLabel = 'Suspicious';
                statusColor = 'bg-warning-100 text-warning-700';
              } else if (ver?.verdict === 'invalid') {
                statusLabel = 'Invalid';
                statusColor = 'bg-danger-100 text-danger-700';
              } else if (cert) {
                statusLabel = 'Uploaded � Awaiting Verification';
                statusColor = 'bg-blue-50 text-blue-600';
              } else if (app.stage === 'selected') {
                statusLabel = 'Approved';
                statusColor = 'bg-success-100 text-success-700';
              } else if (app.stage === 'rejected') {
                statusLabel = 'Rejected';
                statusColor = 'bg-danger-100 text-danger-700';
              } else if (app.stage === 'verification_requested') {
                statusLabel = 'Verification Requested';
                statusColor = 'bg-indigo-50 text-indigo-600';
              }

              return (
                <div
                  key={app.id}
                  className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                    {student?.full_name?.split(' ').map((w) => w[0]).join('')}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      Student Job Application
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {student?.full_name || 'Unknown Student'} � {student?.email || ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Job: {job?.title || 'Job application'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColor}`}
                    >
                      {statusLabel}
                    </span>

                    {app.stage !== 'selected' &&
                      app.stage !== 'rejected' &&
                      !cert && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => store.approveApplication(app.id)}
                            className="btn-primary text-xs px-3 py-1.5"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => store.rejectApplication(app.id)}
                            className="btn-ghost text-xs px-3 py-1.5 text-danger-600"
                          >
                            Reject
                          </button>
                        </div>
                      )}

                    {app.stage === 'selected' &&
                      notif &&
                      !cert && (
                        <button
                          onClick={() => onUploadNotif(notif)}
                          className="btn-primary text-xs px-3 py-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
















