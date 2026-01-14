import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import Home from './pages/Home';
import ProjectDashboard from './pages/Projects/ProjectDashboard';
import IDELayout from './pages/Projects/IDE/IDELayout';
import LectureDashboard from './pages/Lectures/LectureDashboard';
import LectureViewer from './pages/Lectures/LectureViewer';
import Community from './pages/Community';
import { DeviceProvider } from './context/DeviceContext';

function App() {
  return (
    <DeviceProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={import.meta.env.VITE_APP_MODE === 'production' ? <Navigate to="/projects" replace /> : <Home />} />
            <Route path="projects">
              <Route index element={<ProjectDashboard />} />
              <Route path=":projectId" element={<IDELayout />} />
            </Route>
            <Route path="lectures">
              <Route index element={<LectureDashboard />} />
              <Route path=":classId/lesson/:lessonId" element={<LectureViewer />} />
            </Route>
            <Route path="community" element={<Community />} />
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </DeviceProvider>
  );
}

export default App;

