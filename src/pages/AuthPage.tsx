import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, GraduationCap, Building2, Briefcase, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useStore } from '@/store/AppStore';
import type { UserRole } from '@/types/schema';

const ROLE_CONFIG: { key: UserRole; label: string; icon: typeof GraduationCap; desc: string }[] = [
  { key: 'institute', label: 'Institute', icon: Building2, desc: 'Verify & upload certificates' },
  { key: 'student', label: 'Student', icon: GraduationCap, desc: 'Apply to jobs & track verification' },
  { key: 'company', label: 'Company', icon: Briefcase, desc: 'Post jobs & request verification' },
];

export function AuthPage() {
  const { login, pushToast } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('institute');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [institutes, setInstitutes] = useState<{ id: number; institute_name: string }[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'register' && role === 'student') {
      fetch('http://localhost:5000/api/institutes')
        .then((response) => response.json())
        .then((result) => {
          if (result.success) setInstitutes(result.institutes || []);
        })
        .catch((error) => console.error('Failed to load institutes:', error));
    }
  }, [mode, role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'login') {
      const ok = await login(email, password, role);
      if (ok) {
        pushToast('Welcome back!', 'success');
        navigate('/dashboard');
      } else {
        setError('Invalid credentials. Please check your email, password, and selected role.');
      }
    } else {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setError('Please fill all required fields.');
        return;
      }
      try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, role, extra }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.message || 'Registration failed.');
          return;
        }

        pushToast('Account created successfully!', 'success');
        navigate('/dashboard');
      } catch (error) {
        console.error('Registration error:', error);
        setError('Unable to connect to the server.');
      }
    }
  }
  return (
    <div className="min-h-screen flex">
      {/* Left Ã¢â‚¬â€ brand panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #4F46E5 0%, transparent 50%), radial-gradient(circle at 70% 80%, #4F46E5 0%, transparent 40%)' }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <span className="text-white font-bold text-xl">CertiGuard</span>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold text-white leading-tight text-balance">
            Blockchain-Powered<br />Academic Certificate<br />Verification
          </h1>
          <p className="text-slate-400 mt-4 max-w-md leading-relaxed">
            Tamper-proof certificate verification using SHA-256 hashing, IPFS storage, and blockchain proof Ã¢â‚¬â€ combined with AI forgery detection.
          </p>
          <div className="flex gap-6 mt-8">
            <div>
              <p className="text-2xl font-bold text-white">3-Step</p>
              <p className="text-sm text-slate-400">Verification Process</p>
            </div>
            <div className="w-px bg-slate-700" />
            <div>
              <p className="text-2xl font-bold text-white">3 Roles</p>
              <p className="text-sm text-slate-400">Student, Institute, Company</p>
            </div>
            <div className="w-px bg-slate-700" />
            <div>
              <p className="text-2xl font-bold text-white">3 Tiers</p>
              <p className="text-sm text-slate-400">Verification Plans</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-sm text-slate-500">
          Trusted by institutes and companies worldwide
        </div>
      </div>

      {/* Right Ã¢â‚¬â€ auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-xl">CertiGuard</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'login' ? 'Sign in to your CertiGuard account' : 'Get started with CertiGuard in minutes'}
          </p>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2 mt-6">
            {ROLE_CONFIG.map((r) => {
              const Icon = r.icon;
              const active = role === r.key;
              return (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={`p-3 rounded-xl border-2 transition-all text-center ${
                    active ? 'border-accent-600 bg-accent-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1.5 ${active ? 'text-accent-600' : 'text-slate-400'}`} />
                  <p className={`text-xs font-semibold ${active ? 'text-accent-700' : 'text-slate-600'}`}>{r.label}</p>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label-text">{role === 'institute' ? 'Institute Name' : role === 'company' ? 'Company Name' : 'Full Name'}</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input className="input-field pl-10" placeholder={`Enter ${role === 'institute' ? 'institute' : role === 'company' ? 'company' : 'full'} name`} value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
            )}

            <div>
              <label className="label-text">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="input-field pl-10" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="label-text">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input className="input-field pl-10" type="password" placeholder="Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢Ã¢â‚¬Â¢" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>

            {/* Extra fields for register */}
            {mode === 'register' && role === 'institute' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">Location</label>
                  <input className="input-field" placeholder="City, Country" value={extra.location || ''} onChange={(e) => setExtra({ ...extra, location: e.target.value })} />
                </div>
                <div>
                  <label className="label-text">Established Year</label>
                  <input className="input-field" type="number" placeholder="1960" value={extra.establishedYear || ''} onChange={(e) => setExtra({ ...extra, establishedYear: e.target.value })} />
                </div>
              </div>
            )}
            {mode === 'register' && role === 'student' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">Enrollment ID</label>
                  <input className="input-field" placeholder="NIT2021001" value={extra.enrollmentId || ''} onChange={(e) => setExtra({ ...extra, enrollmentId: e.target.value })} />
                </div>
                <div>
                  <label className="label-text">Program</label>
                  <input className="input-field" placeholder="Computer Science" value={extra.program || ''} onChange={(e) => setExtra({ ...extra, program: e.target.value })} />
                  </div>
                  <div>
                    <label className="label-text">Institute</label>
                    <select
                      className="input-field"
                      value={extra.instituteId || ''}
                      onChange={(e) => setExtra({ ...extra, instituteId: e.target.value })}
                    >
                      <option value="">Select Institute</option>
                      {institutes.map((institute) => (
                        <option key={institute.id} value={institute.id}>
                          {institute.institute_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
            )}
            {mode === 'register' && role === 'company' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-text">Industry</label>
                  <input className="input-field" placeholder="Information Technology" value={extra.industry || ''} onChange={(e) => setExtra({ ...extra, industry: e.target.value })} />
                </div>
                <div>
                  <label className="label-text">Location</label>
                  <input className="input-field" placeholder="Bangalore, India" value={extra.location || ''} onChange={(e) => setExtra({ ...extra, location: e.target.value })} />
                </div>
              </div>
            )}

            {error && (
              <div className="px-3.5 py-2.5 rounded-xl bg-danger-50 text-danger-700 text-sm">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-3">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-sm text-slate-500 text-center mt-4">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="text-accent-600 font-medium hover:text-accent-700">
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}










