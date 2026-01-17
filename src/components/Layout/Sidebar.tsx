import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FolderCode, BookOpen, Users, Settings, Home, Search, LogOut } from 'lucide-react';
import SearchOverlay from '../Search/SearchOverlay';
import AdminManager from '../Admin/AdminManager';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isAdminOpen, setIsAdminOpen] = React.useState(false);
  const { user, isAdmin } = useAuth();
  const isProduction = import.meta.env.VITE_APP_MODE === 'production';

  const navigate = useNavigate();

  React.useEffect(() => {
    const handleOpenAdmin = () => {
      if (isAdmin) {
        setIsAdminOpen(true);
      } else {
        alert('Access Denied: You do not have administrator privileges.');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search on "/" if not in an input/textarea
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };

    const handleOpenFile = (e: any) => {
      console.log('[Sidebar] Received open-file event:', e.detail);
      if (e.detail && e.detail.path) {
        const projectId = e.detail.projectId || '1';
        // Navigate to the correct project with file query param
        navigate(`/projects/${projectId}?openFile=${encodeURIComponent(e.detail.path)}`);
      }
    };

    window.addEventListener('open-admin-mode', handleOpenAdmin);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open-file', handleOpenFile);
    return () => {
      window.removeEventListener('open-admin-mode', handleOpenAdmin);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open-file', handleOpenFile);
    };
  }, [isAdmin, navigate]);

  const handleLogout = () => {
    if (auth && typeof auth.signOut === 'function') {
      auth.signOut();
    }
  };

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">IA</div>
      </div>

      <nav className="nav-menu">
        {!isProduction && (
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Home">
            <Home size={20} />
          </NavLink>
        )}
        <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Projects">
          <FolderCode size={20} />
        </NavLink>
        {!isProduction && (
          <>
            <NavLink to="/lectures" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Lectures">
              <BookOpen size={20} />
            </NavLink>
            <NavLink to="/community" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Community">
              <Users size={20} />
            </NavLink>
          </>
        )}
      </nav>

      <div className="bottom-menu">
        <button className="nav-item" title="Search /" onClick={() => setIsSearchOpen(true)}>
          <Search size={20} />
        </button>
        <button className="nav-item" title="Settings">
          <Settings size={20} />
        </button>
        {!isProduction && (
          <button className="nav-item logout-btn" title="Logout" onClick={handleLogout}>
            <LogOut size={20} />
          </button>
        )}
        <div className="avatar-placeholder" title={user?.email || 'User'}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="Avatar" className="avatar-img" />
          ) : (
            user?.email?.charAt(0).toUpperCase() || 'U'
          )}
        </div>
      </div>

      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* Admin Manager will be rendered here if open */}
      {isAdminOpen && <AdminManager onClose={() => setIsAdminOpen(false)} />}
    </aside>
  );
};

export default Sidebar;
