import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import ProjectList from './pages/projects/ProjectList'
import { Home } from './pages/Home'
import { DashboardLayout } from './components/layout/DashboardLayout'
import EmergencyMode from './pages/EmergencyMode'
import './App.css'

const queryClient = new QueryClient()

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const DashboardRoutes: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <DashboardLayout userName={"Admin User"} userRole={"owner"}>
      {children}
    </DashboardLayout>
  </ProtectedRoute>
);

function AppContent() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route 
        path="/onboarding" 
        element={
          <ProtectedRoute>
            <OnboardingFlow />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/emergency" 
        element={
          <ProtectedRoute>
            <EmergencyMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          <DashboardRoutes>
            <Home />
          </DashboardRoutes>
        } 
      />
      <Route 
        path="/projects" 
        element={
          <DashboardRoutes>
            <ProjectList />
          </DashboardRoutes>
        } 
      />
      <Route 
        path="/tasks" 
        element={
          <DashboardRoutes>
            <div className="glass-card p-10 text-center"><h2 className="text-2xl font-bold">Tasks Management</h2><p className="text-text-muted mt-2">Coming soon...</p></div>
          </DashboardRoutes>
        } 
      />
      <Route 
        path="/users" 
        element={
          <DashboardRoutes>
            <div className="glass-card p-10 text-center"><h2 className="text-2xl font-bold">Users & Team</h2><p className="text-text-muted mt-2">Coming soon...</p></div>
          </DashboardRoutes>
        } 
      />
      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
