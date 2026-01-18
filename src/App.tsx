import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Home from './pages/Home';
import ProjectDashboard from './pages/Projects/ProjectDashboard';
import IDELayout from './pages/Projects/IDE/IDELayout';
import LectureDashboard from './pages/Lectures/LectureDashboard';
import LectureViewer from './pages/Lectures/LectureViewer';
import Community from './pages/Community';
import { DeviceProvider } from './context/DeviceContext';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

const LoginPage = React.lazy(() => import('./pages/Auth/LoginPage'));
const SettingsPage = React.lazy(() => import('./pages/Auth/SettingsPage'));
const UILibrary = React.lazy(() => import('./pages/UILibrary/UILibrary'));

const isProduction = import.meta.env.VITE_APP_MODE === 'production';

function App() {
  return (
    <DeviceProvider>
      <AuthProvider>
        <Router>
          <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>}>
            <Routes>
              {!isProduction && <Route path="/login" element={<LoginPage />} />}

              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route index element={isProduction ? <Navigate to="/projects" replace /> : <Home />} />
                <Route path="projects">
                  <Route index element={<ProjectDashboard />} />
                  <Route path=":projectId" element={<IDELayout />} />
                </Route>
                <Route path="lectures">
                  <Route index element={<LectureDashboard />} />
                  <Route path=":classId/lesson/:lessonId" element={<LectureViewer />} />
                </Route>
                <Route path="community" element={<Community />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="ui-library" element={<UILibrary />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </DeviceProvider>
  );
}

export default App;

