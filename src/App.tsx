import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider, useStore } from '@/store/AppStore';
import { ToastContainer } from '@/components/ui/Toast';
import { AuthPage } from '@/pages/AuthPage';
import { InstituteDashboard } from '@/pages/InstituteDashboard';
import { StudentDashboard } from '@/pages/StudentDashboard';
import { CompanyDashboard } from '@/pages/CompanyDashboard';
import type { UserRole } from '@/types/schema';

function DashboardRouter() {
  const { session } = useStore();

  if (!session) return <Navigate to="/" replace />;

  const role: UserRole = session.user.role;

  if (role === 'institute') return <InstituteDashboard />;
  if (role === 'student') return <StudentDashboard />;
  if (role === 'company') return <CompanyDashboard />;
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { session } = useStore();

  return (
    <Routes>
      <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <AuthPage />} />
      <Route path="/dashboard" element={<DashboardRouter />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <AppRoutes />
        <ToastContainer />
      </BrowserRouter>
    </StoreProvider>
  );
}

export default App;
