import React, { useState } from 'react';
import { X, Folder } from 'lucide-react';
import './NewProjectModal.css';

interface NewProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: any) => void;
}

const NewProjectModal: React.FC<NewProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
    const [projectName, setProjectName] = useState('');
    const [location, setLocation] = useState('/Users/michaelcheng/Desktop/Projects');
    const [enableAI, setEnableAI] = useState(true);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreate({ projectName, location, enableAI });
        onClose();
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
                            />
                            <button type="button" className="icon-action"><Folder size={16} /></button>
                        </div>
                    </div>

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
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn-primary">Create Project</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewProjectModal;
