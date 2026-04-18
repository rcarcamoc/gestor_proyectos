import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import Login from './pages/Login'
import Register from './pages/Register'
import OnboardingFlow from './pages/onboarding/OnboardingFlow'
import ProjectList from './pages/projects/ProjectList'
import { Home } from './pages/Home'
import { DashboardLayout } from './components/layout/DashboardLayout'
import EmergencyMode from './pages/EmergencyMode'
import { TaskList } from './pages/tasks/TaskList'
import { TeamList } from './pages/users/TeamList'
import { SettingsPage } from './pages/settings/Settings'
import CapacityDashboard from './pages/CapacityDashboard'
import TelegramVinculation from './pages/TelegramVinculation'
import './App.css'

const queryClient = new QueryClient()

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <>{children}</>;
};

const DashboardRoutes: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <DashboardLayout>
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
        path="/vincular"
        element={
          <DashboardRoutes>
            <TelegramVinculation />
          </DashboardRoutes>
        }
      />
      <Route
        path="/capacity"
        element={
          <DashboardRoutes>
            <CapacityDashboard />
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
            <TaskList />
          </DashboardRoutes>
        }
      />
      <Route
        path="/users"
        element={
          <DashboardRoutes>
            <TeamList />
          </DashboardRoutes>
        }
      />
      <Route
        path="/settings"
        element={
          <DashboardRoutes>
            <SettingsPage />
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
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
