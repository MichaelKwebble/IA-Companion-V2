import React, { useState, useEffect } from 'react';
import { X, Folder } from 'lucide-react';
import './NewProjectModal.css';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: any) => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [projectName, setProjectName] = useState('');
    const [location, setLocation] = useState('');

    useEffect(() => {
        const fetchDesktopPath = async () => {
            // @ts-ignore
            if (window.electron && window.electron.project && window.electron.project.getDesktopPath) {
                try {
                    // @ts-ignore
                    const path = await window.electron.project.getDesktopPath();
                    if (path) setLocation(path);
                } catch (e) {
                    console.error('Failed to get desktop path', e);
                }
            }
        };

        if (isOpen) {
            fetchDesktopPath();
        }
    }, [isOpen]);

    const [enableAI, setEnableAI] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    if (!isOpen) return null;

    const handleSelectDirectory = async () => {
        // @ts-ignore
        if (window.electron && window.electron.project) {
            // @ts-ignore
            const selectedPath = await window.electron.project.selectDirectory();
            if (selectedPath) {
                setLocation(selectedPath);
            }
        }
    };

    const validateName = (name: string) => {
        const nameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!nameRegex.test(name)) {
            return 'Project name can only contain letters, numbers, underscores, and hyphens (no spaces).';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const nameError = validateName(projectName);
        if (nameError) {
            setError(nameError);
            return;
        }

        setIsCreating(true);
        try {
            const response = await fetch('http://localhost:3001/api/projects/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: projectName, location })
            });

            const result = await response.json();
            if (result.success) {
                onCreate(result.project);
                onClose();
            } else {
                setError(result.error);
            }
        } catch (err: any) {
            setError('Failed to create project: ' + err.message);
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Create New Project</h2>
                    <button onClick={onClose} className="close-btn"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    <div className="form-group">
                        <label>Project Name</label>
                        <input
                            type="text"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="My Awesome Project"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Location</label>
                        <div className="input-with-icon">
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                readOnly
                            />
                            <button type="button" className="icon-action" onClick={handleSelectDirectory}>
                                <Folder size={16} />
                            </button>
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group checkbox-group">
                        <label className="flex items-center gap-sm cursor-pointer">
                            <input
                                type="checkbox"
                                checked={enableAI}
                                onChange={(e) => setEnableAI(e.target.checked)}
                            />
                            <span>Create AI Chatbot for this project</span>
                        </label>
                        <p className="help-text">Creates a dedicated AI context aware of this project's files.</p>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={isCreating}>Cancel</button>
                        <button type="submit" className="btn-primary" disabled={isCreating}>
                            {isCreating ? 'Creating...' : 'Create Project'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewProjectModal;
