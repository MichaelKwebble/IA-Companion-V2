import React, { useState } from 'react';
import { X, Book, Plus, Save, Trash2, ChevronRight } from 'lucide-react';
import { mockClasses } from '../../data/mockLectureData';
import './AdminManager.css';

interface AdminManagerProps {
    onClose: () => void;
}

const AdminManager: React.FC<AdminManagerProps> = ({ onClose }) => {
    const [classes, setClasses] = useState(mockClasses);
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    const selectedClass = classes.find(c => c.id === selectedClassId);

    // Get all lessons from all modules
    const allLessons = selectedClass?.modules.flatMap(m => m.lessons) || [];

    const getCategoryColor = (category: string) => {
        const colors: Record<string, string> = {
            'Microcontrollers': '#3b82f6',
            'IoT': '#10b981',
            'UI/UX': '#f59e0b',
            'Advanced': '#ef4444'
        };
        return colors[category] || '#6b7280';
    };

    return (
        <div className="admin-manager-overlay">
            <div className="admin-manager-container">
                <div className="admin-header">
                    <div className="title-group">
                        <Book className="admin-icon" />
                        <h1>Course Content Manager</h1>
                        <span className="badge">Admin Mode</span>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                <div className="admin-content">
                    <div className="admin-sidebar">
                        <div className="sidebar-header">
                            <h2>Classes</h2>
                            <button className="add-btn" onClick={() => setClasses([...classes])}><Plus size={16} /></button>
                        </div>
                        <div className="class-list">
                            {classes.map(c => (
                                <div
                                    key={c.id}
                                    className={`class-item ${selectedClassId === c.id ? 'active' : ''}`}
                                    onClick={() => setSelectedClassId(c.id)}
                                >
                                    <div className="class-icon" style={{ backgroundColor: getCategoryColor(c.category) }}>
                                        {c.title.charAt(0)}
                                    </div>
                                    <div className="class-info">
                                        <span className="class-title">{c.title}</span>
                                        <span className="class-meta">{c.modules.reduce((acc, m) => acc + m.lessons.length, 0)} Lessons</span>
                                    </div>
                                    <ChevronRight size={16} className="arrow" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="admin-main">
                        {selectedClass ? (
                            <div className="class-editor">
                                <div className="editor-header">
                                    <input
                                        type="text"
                                        value={selectedClass.title}
                                        className="title-input"
                                        onChange={() => { }} // Handle change
                                    />
                                    <div className="actions">
                                        <button className="btn-secondary"><Trash2 size={16} /> Delete</button>
                                        <button className="btn-primary"><Save size={16} /> Save Changes</button>
                                    </div>
                                </div>

                                <div className="lessons-section">
                                    <h3>Lessons</h3>
                                    <div className="lessons-grid">
                                        {allLessons.map(lesson => (
                                            <div key={lesson.id} className="lesson-editor-card">
                                                <div className="lesson-header">
                                                    <span className="lesson-type">{lesson.type}</span>
                                                    <h4>{lesson.title}</h4>
                                                </div>
                                                <p>{lesson.description}</p>
                                                <div className="lesson-footer">
                                                    <span>{lesson.duration} mins</span>
                                                    <button className="edit-link">Edit Content</button>
                                                </div>
                                            </div>
                                        ))}
                                        <button className="add-lesson-card">
                                            <Plus size={24} />
                                            <span>Add New Lesson</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <Book size={48} />
                                <h3>Select a class to manage content</h3>
                                <p>You can edit lessons, add new modules, and update course descriptions.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminManager;
