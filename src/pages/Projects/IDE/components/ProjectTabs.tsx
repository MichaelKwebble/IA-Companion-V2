import React from 'react';
import { X, Plus } from 'lucide-react';
import './ProjectTabs.css';

export interface ProjectTab {
    id: string;
    name: string;
    type: 'code' | 'design';
}

interface ProjectTabsProps {
    projects: ProjectTab[];
    activeId: string;
    onSwitch: (id: string) => void;
    onClose: (id: string) => void;
    onNew: () => void;
}

const ProjectTabs: React.FC<ProjectTabsProps> = ({ projects, activeId, onSwitch, onClose, onNew }) => {
    return (
        <div className="project-tabs-bar">
            <div className="tabs-list">
                {projects.map(project => (
                    <div
                        key={project.id}
                        className={`project-tab ${project.id === activeId ? 'active' : ''}`}
                        onClick={() => onSwitch(project.id)}
                    >
                        <span className="tab-name">{project.name}</span>
                        <button
                            className="tab-close"
                            onClick={(e) => {
                                e.stopPropagation();
                                onClose(project.id);
                            }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
            <button className="new-tab-btn" onClick={onNew}>
                <Plus size={16} />
            </button>
        </div>
    );
};

export default ProjectTabs;
