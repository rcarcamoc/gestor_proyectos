import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import ProjectList from './pages/projects/ProjectList'
import Dashboard from './pages/Dashboard'
import EmergencyMode from './pages/EmergencyMode'
import './App.css'

const queryClient = new QueryClient()

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

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
        path="/projects" 
        element={
          <ProtectedRoute>
            <ProjectList />
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
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
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
