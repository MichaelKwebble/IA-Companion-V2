import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Code, PenTool, Trash2 } from 'lucide-react';
import './ProjectDashboard.css';

interface Project {
    id: string;
    name: string;
    type: 'code' | 'design';
    path?: string;
    lastModified: string;
}

import NewProjectModal from './NewProjectModal';

const ProjectDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);

    React.useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/projects');
                const data = await response.json();
                if (data.success) {
                    setProjects(data.projects);
                }
            } catch (error) {
                console.error('Failed to fetch projects:', error);
            }
        };
        fetchProjects();
    }, []);

    const handleCreateProject = (type: 'code' | 'design') => {
        if (type === 'code') {
            setIsModalOpen(true);
        } else {
            // Design project flow (mock)
            const newId = Math.random().toString(36).substr(2, 9);
            navigate(`/projects/${newId}?type=${type}`);
        }
    };

    const handleModalSubmit = (project: Project) => {
        console.log('Project created:', project);
        setProjects(prev => [project, ...prev]);
        navigate(`/projects/${project.id}?type=code&name=${encodeURIComponent(project.name)}`);
    };

    const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
        e.stopPropagation(); // Prevent card click
        if (!confirm(`Are you sure you want to delete project "${project.name}"? This will permanently delete the files from disk.`)) {
            return;
        }

        try {
            const response = await fetch(`http://localhost:3001/api/projects/${project.id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                setProjects(prev => prev.filter(p => p.id !== project.id));
            } else {
                alert('Failed to delete project: ' + data.error);
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
            alert('Failed to delete project');
        }
    };

    return (
        <div className="project-dashboard p-md">
            <NewProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreate={handleModalSubmit}
            />
            <div className="dashboard-header">
                <h1>Projects</h1>
                <div className="action-buttons">
                    <button className="btn-primary flex items-center gap-sm" onClick={() => handleCreateProject('code')}>
                        <Plus size={16} /> New Code Project
                    </button>
                    {import.meta.env.VITE_APP_MODE !== 'production' && (
                        <button className="btn-secondary flex items-center gap-sm" onClick={() => handleCreateProject('design')}>
                            <PenTool size={16} /> New Design Project
                        </button>
                    )}
                </div>
            </div>

            <div className="project-grid">
                {projects.map((project) => (
                    <div key={project.id} className="project-card panel" onClick={() => navigate(`/projects/${project.id}?type=${project.type}`)}>
                        <div className="card-preview">
                            {project.type === 'code' ? <Code size={48} className="text-secondary" /> : <PenTool size={48} className="text-secondary" />}
                        </div>
                        <div className="card-info">
                            <h3>{project.name}</h3>
                            <span className="text-sm text-secondary">{project.type === 'code' ? 'Arduino Project' : 'UI Design'} • {project.lastModified}</span>
                        </div>
                        <button
                            className="delete-project-btn"
                            onClick={(e) => handleDeleteProject(e, project)}
                            title="Delete Project"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectDashboard;
