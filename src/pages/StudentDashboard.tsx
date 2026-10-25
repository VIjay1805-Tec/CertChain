import { useState } from 'react';
import {
  GraduationCap, FileText, Briefcase, Bell, Mail, IdCard,
  Send, MapPin, Building2, Clock, CheckCircle2, ShieldCheck,
  AlertCircle, ChevronRight,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard, EmptyState, SectionHeader } from '@/components/ui/Common';
import { useStore } from '@/store/AppStore';
import type { Job, Student } from '@/types/schema';

type Tab = 'overview' | 'records' | 'jobs' | 'applications' | 'notifications';

const STAGE_FLOW: { key: string; label: string }[] = [
  { key: 'applied', label: 'Applied' },
  { key: 'institute_notified', label: 'Institute Notified' },
  { key: 'certificate_uploaded', label: 'Certificate Uploaded' },
  { key: 'verification_requested', label: 'Verification Requested' },
  { key: 'verification_completed', label: 'Verification Result' },
];

export function StudentDashboard() {
  const store = useStore();
  const { session } = store;
  const [tab, setTab] = useState<Tab>('overview');
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [coverNote, setCoverNote] = useState('');

  if (!session) return null;
  const student = session.entity as Student;

  const myRecords = store.getStudentRecords(student.id);
  const myApps = store.getStudentApplications(student.id);
  const myNotifs = store.getNotificationsFor('student', session.user.id);
  const allJobs = store.jobs;
  const appliedJobIds = new Set(myApps.map((a) => a.job_id));

  const tabs = [
    { key: 'overview', label: 'Overview', icon: GraduationCap },
    { key: 'records', label: 'My Records', icon: FileText },
    { key: 'jobs', label: 'Job Opportunities', icon: Briefcase },
    { key: 'applications', label: 'My Applications', icon: Send },
    { key: 'notifications', label: 'Notifications', icon: Bell },
  ];

  function handleApply() {
    if (!applyJob) return;
    store.applyToJob(applyJob.id, coverNote);
    setApplyJob(null);
    setCoverNote('');
  }

  function getRecordStatus(studentId: string): 'pending' | 'verified' | 'suspicious' | 'invalid' {
    const sVer = store.verifications.filter((v) => v.student_id === studentId);
    if (sVer.some((v) => v.verdict === 'verified')) return 'verified';
    if (sVer.some((v) => v.verdict === 'suspicious')) return 'suspicious';
    if (sVer.some((v) => v.verdict === 'invalid')) return 'invalid';
    return 'pending';
  }

  return (
    <DashboardLayout activeTab={tab} tabs={tabs} onTabChange={(k) => setTab(k as Tab)}>
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Profile card */}
          <div className="card p-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-accent-100 text-accent-700 flex items-center justify-center text-xl font-bold">
                {student.full_name.split(' ').map((w) => w[0]).join('')}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-slate-900">{student.full_name}</h2>
                <div className="flex flex-wrap gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-sm text-slate-500"><Mail className="w-4 h-4" />{student.email}</span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-500"><IdCard className="w-4 h-4" />{student.enrollment_id}</span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-500"><GraduationCap className="w-4 h-4" />{student.program}</span>
                </div>
              </div>
              <div className="hidden md:block">
                <StatusBadge status={getRecordStatus(student.id)} size="md" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Academic Records" value={myRecords.length} icon={FileText} iconBg="bg-accent-50" iconColor="text-accent-600" />
            <StatCard label="Applications" value={myApps.length} icon={Send} iconBg="bg-blue-50" iconColor="text-blue-600" />
            <StatCard label="Notifications" value={myNotifs.filter((n) => !n.read).length} icon={Bell} iconBg="bg-warning-50" iconColor="text-warning-600" />
          </div>

          {/* Recent applications */}
          <div className="card p-6">
            <SectionHeader title="Recent Applications" action={<button onClick={() => setTab('applications')} className="btn-ghost text-accent-600">View all<ChevronRight className="w-4 h-4" /></button>} />
            {myApps.length === 0 ? (
              <EmptyState icon={Send} title="No applications yet" description="Browse job opportunities and apply to get started." action={<button onClick={() => setTab('jobs')} className="btn-primary"><Briefcase className="w-4 h-4" />Browse Jobs</button>} />
            ) : (
              <div className="space-y-3">
                {myApps.slice(0, 3).map((app) => {
                  const job = store.getJobById(app.job_id);
                  const company = store.getCompanyById(app.company_id);
                  const ver = store.getVerificationForApplication(app.id);
                  return (
                    <div key={app.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{job?.title}</p>
                        <p className="text-xs text-slate-500">{company?.name} • {job?.location}</p>
                      </div>
                      <StatusBadge status={ver?.verdict || (app.stage === 'verification_completed' ? 'verified' : 'pending')} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'records' && (
        <div className="card p-6">
          <SectionHeader title="My Academic Records" description="Your academic records and their verification status" />
          {myRecords.length === 0 ? (
            <EmptyState icon={FileText} title="No records yet" description="Your institute hasn't added any academic records for you yet." />
          ) : (
            <div className="space-y-3">
              {myRecords.map((r) => {
                const status = getRecordStatus(student.id);
                const cert = store.certificates.find((c) => c.record_id === r.id);
                return (
                  <div key={r.id} className="p-5 rounded-xl border border-slate-100 hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{r.degree} — {r.course}</p>
                          <div className="flex gap-4 mt-1">
                            <span className="text-xs text-slate-500">Grade: <span className="font-medium text-slate-700">{r.grade}</span></span>
                            <span className="text-xs text-slate-500">Year: <span className="font-medium text-slate-700">{r.graduation_year}</span></span>
                          </div>
                          {cert && (
                            <div className="flex items-center gap-2 mt-2">
                              <ShieldCheck className="w-3.5 h-3.5 text-accent-500" />
                              <span className="text-xs text-slate-500 font-mono">CID: {cert.ipfs_cid.slice(0, 20)}...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={status} size="md" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'jobs' && (
        <div className="space-y-5">
          <SectionHeader title="Job Opportunities" description="Browse jobs posted by companies" />
          {allJobs.length === 0 ? (
            <div className="card p-6"><EmptyState icon={Briefcase} title="No jobs available" description="Companies haven't posted any jobs yet." /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {allJobs.map((job) => {
                const company = store.getCompanyById(job.company_id);
                const applied = appliedJobIds.has(job.id);
                return (
                  <div key={job.id} className="card p-5 hover:shadow-card-hover transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{job.title}</p>
                          <p className="text-xs text-slate-500">{company?.name}</p>
                        </div>
                      </div>
                      {applied && <StatusBadge status="applied" />}
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{job.description}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>
                      <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{job.salary_range}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-50">
                      <p className="text-xs text-slate-500 mb-2 font-medium">Requirements:</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{job.requirements}</p>
                    </div>
                    <button
                      onClick={() => { if (!applied) setApplyJob(job); }}
                      disabled={applied}
                      className="btn-primary w-full mt-4"
                    >
                      {applied ? (<><CheckCircle2 className="w-4 h-4" />Applied</>) : (<><Send className="w-4 h-4" />Apply Now</>)}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'applications' && (
        <div className="space-y-5">
          <SectionHeader title="My Applications" description="Track the status of your job applications" />
          {myApps.length === 0 ? (
            <div className="card p-6"><EmptyState icon={Send} title="No applications yet" description="Apply to jobs to see their status progression here." action={<button onClick={() => setTab('jobs')} className="btn-primary"><Briefcase className="w-4 h-4" />Browse Jobs</button>} /></div>
          ) : (
            <div className="space-y-4">
              {myApps.map((app) => {
                const job = store.getJobById(app.job_id);
                const company = store.getCompanyById(app.company_id);
                const ver = store.getVerificationForApplication(app.id);
                const cert = store.getCertificateForApplication(app.id);
                const currentStageIdx = STAGE_FLOW.findIndex((s) => s.key === app.stage);

                return (
                  <div key={app.id} className="card p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{job?.title}</p>
                          <p className="text-xs text-slate-500">{company?.name} • {job?.location}</p>
                        </div>
                      </div>
                      <StatusBadge status={ver?.verdict || (app.stage === 'verification_completed' ? 'verified' : 'pending')} size="md" />
                    </div>

                    {/* Status progression stepper */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                      {STAGE_FLOW.map((stage, i) => {
                        const isDone = i <= currentStageIdx;
                        const isActive = i === currentStageIdx;
                        return (
                          <div key={stage.key} className="flex items-center gap-1 flex-shrink-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                                isDone ? (isActive && i === STAGE_FLOW.length - 1 && ver?.verdict ? 'bg-accent-600 text-white' : 'bg-success-100 text-success-700') : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                              </div>
                              <span className={`text-xs font-medium whitespace-nowrap ${isDone ? 'text-slate-700' : 'text-slate-400'}`}>{stage.label}</span>
                            </div>
                            {i < STAGE_FLOW.length - 1 && <div className={`w-6 h-0.5 rounded-full ${isDone && i < currentStageIdx ? 'bg-success-200' : 'bg-slate-200'}`} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Verification result */}
                    {ver && ver.verdict && (
                      <div className={`mt-4 p-4 rounded-xl border ${
                        ver.verdict === 'verified' ? 'bg-success-50 border-success-100' :
                        ver.verdict === 'suspicious' ? 'bg-warning-50 border-warning-100' :
                        'bg-danger-50 border-danger-100'
                      }`}>
                        <div className="flex items-center gap-2">
                          {ver.verdict === 'verified' ? <ShieldCheck className="w-5 h-5 text-success-600" /> :
                           ver.verdict === 'suspicious' ? <AlertCircle className="w-5 h-5 text-warning-600" /> :
                           <AlertCircle className="w-5 h-5 text-danger-600" />}
                          <p className={`text-sm font-semibold ${
                            ver.verdict === 'verified' ? 'text-success-700' :
                            ver.verdict === 'suspicious' ? 'text-warning-700' : 'text-danger-700'
                          }`}>
                            Verification Result: {ver.verdict.toUpperCase()}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3 text-xs">
                          <div>
                            <p className="text-slate-500">Confidence</p>
                            <p className="font-medium text-slate-700">{ver.confidence}%</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Tier</p>
                            <p className="font-medium text-slate-700 capitalize">{ver.tier.replace('_', ' ')}</p>
                          </div>
                          {ver.blockchain_proof_ref && (
                            <div className="col-span-2">
                              <p className="text-slate-500">Blockchain Proof</p>
                              <p className="font-mono text-slate-700 truncate">{ver.blockchain_proof_ref}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {cert && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                        <ShieldCheck className="w-3.5 h-3.5 text-accent-500" />
                        Certificate uploaded • Hash: <span className="font-mono">{cert.sha256_hash.slice(0, 16)}...</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card p-6">
          <SectionHeader title="Notifications" description="Updates about your applications and verification results" />
          {myNotifs.length === 0 ? (
            <EmptyState icon={Bell} title="No notifications" description="You'll be notified when verification results are ready." />
          ) : (
            <div className="space-y-2">
              {myNotifs.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 p-4 rounded-xl border ${n.read ? 'border-slate-100' : 'border-accent-100 bg-accent-50/30'}`}>
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    {n.type === 'verification_result_student' ? <ShieldCheck className="w-4 h-4 text-success-600" /> : <Bell className="w-4 h-4 text-slate-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                  </div>
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-1" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Apply to Job Modal */}
      <Modal open={!!applyJob} onClose={() => setApplyJob(null)} title="Apply for Job" subtitle={applyJob?.title}>
        {applyJob && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50">
              <p className="text-sm text-slate-600">{applyJob.description}</p>
              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{applyJob.location}</span>
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{applyJob.salary_range}</span>
              </div>
            </div>
            <div>
              <label className="label-text">Cover Note (optional)</label>
              <textarea className="input-field min-h-[100px] resize-none" placeholder="Tell the company why you're a good fit..." value={coverNote} onChange={(e) => setCoverNote(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-accent-50 border border-accent-100">
              <Bell className="w-4 h-4 text-accent-600 flex-shrink-0" />
              <p className="text-xs text-accent-700">Applying will notify your institute to upload your certificate for verification.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setApplyJob(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleApply} className="btn-primary flex-1"><Send className="w-4 h-4" />Submit Application</button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

