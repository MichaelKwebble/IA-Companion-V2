import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Code, PenTool } from 'lucide-react';
import './ProjectDashboard.css';

interface Project {
    id: string;
    name: string;
    type: 'code' | 'design';
    lastModified: string;
}

const MOCK_PROJECTS: Project[] = [
    { id: '1', name: 'Blink LED', type: 'code', lastModified: '2 mins ago' },
    { id: '2', name: 'Smart Home UI', type: 'design', lastModified: '1 hour ago' },
    { id: '3', name: 'Sensor Logger', type: 'code', lastModified: '2 days ago' },
];

import NewProjectModal from './NewProjectModal';

const ProjectDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleCreateProject = (type: 'code' | 'design') => {
        if (type === 'code') {
            setIsModalOpen(true);
        } else {
            // Design project flow (mock)
            const newId = Math.random().toString(36).substr(2, 9);
            navigate(`/projects/${newId}?type=${type}`);
        }
    };

    const handleModalSubmit = (data: any) => {
        console.log('Creating project:', data);
        const newId = Math.random().toString(36).substr(2, 9);
        navigate(`/projects/${newId}?type=code&name=${encodeURIComponent(data.projectName)}`);
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
                    <button className="btn-secondary flex items-center gap-sm" onClick={() => handleCreateProject('design')}>
                        <PenTool size={16} /> New Design Project
                    </button>
                </div>
            </div>

            <div className="project-grid">
                {MOCK_PROJECTS.map((project) => (
                    <div key={project.id} className="project-card panel" onClick={() => navigate(`/projects/${project.id}?type=${project.type}`)}>
                        <div className="card-preview">
                            {project.type === 'code' ? <Code size={48} className="text-secondary" /> : <PenTool size={48} className="text-secondary" />}
                        </div>
                        <div className="card-info">
                            <h3>{project.name}</h3>
                            <span className="text-sm text-secondary">{project.type === 'code' ? 'Arduino Project' : 'UI Design'} • {project.lastModified}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProjectDashboard;
