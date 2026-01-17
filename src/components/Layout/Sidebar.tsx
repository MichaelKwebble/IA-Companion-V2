import React from 'react';
import { NavLink } from 'react-router-dom';
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

  React.useEffect(() => {
    const handleOpenAdmin = () => {
      if (isAdmin) {
        setIsAdminOpen(true);
      } else {
        alert('Access Denied: You do not have administrator privileges.');
      }
    };
    window.addEventListener('open-admin-mode', handleOpenAdmin);
    return () => window.removeEventListener('open-admin-mode', handleOpenAdmin);
  }, [isAdmin]);

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">IA</div>
      </div>

      <nav className="nav-menu">
        {import.meta.env.VITE_APP_MODE !== 'production' && (
          <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Home">
            <Home size={20} />
          </NavLink>
        )}
        <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Projects">
          <FolderCode size={20} />
        </NavLink>
        {import.meta.env.VITE_APP_MODE !== 'production' && (
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
        <button className="nav-item" title="Search" onClick={() => setIsSearchOpen(true)}>
          <Search size={20} />
        </button>
        <button className="nav-item" title="Settings">
          <Settings size={20} />
        </button>
        <button className="nav-item logout-btn" title="Logout" onClick={handleLogout}>
          <LogOut size={20} />
        </button>
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
