import React from 'react';
import { NavLink } from 'react-router-dom';
import { FolderCode, BookOpen, Users, Settings, Home } from 'lucide-react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="logo-container">
        <div className="logo-icon">IA</div>
      </div>
      
      <nav className="nav-menu">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Home">
          <Home size={20} />
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Projects">
          <FolderCode size={20} />
        </NavLink>
        <NavLink to="/lectures" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Lectures">
          <BookOpen size={20} />
        </NavLink>
        <NavLink to="/community" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} title="Community">
          <Users size={20} />
        </NavLink>
      </nav>

      <div className="bottom-menu">
        <button className="nav-item" title="Settings">
          <Settings size={20} />
        </button>
        <div className="avatar-placeholder">M</div>
      </div>
    </aside>
  );
};

export default Sidebar;
