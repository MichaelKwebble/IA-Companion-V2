import React, { useState } from 'react';
import { useLectureProgress } from '../../../context/LectureProgressContext';
import './ProjectSubmission.css';

interface ProjectSubmissionProps {
    title: string;
    description: string;
    classId: string;
    lessonId: string;
}

const ProjectSubmission: React.FC<ProjectSubmissionProps> = ({
    title,
    description,
    classId,
    lessonId
}) => {
    const { submitProject, getSubmission } = useLectureProgress();
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const existingSubmission = getSubmission(classId, lessonId);

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setSelectedFiles(Array.from(event.target.files));
        }
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
        if (event.dataTransfer.files) {
            setSelectedFiles(Array.from(event.dataTransfer.files));
        }
    };

    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        if (selectedFiles.length === 0) {
            alert('Please select files to submit');
            return;
        }

        // Prepare file metadata
        const fileMetadata = selectedFiles.map(f => ({
            name: f.name,
            size: f.size
        }));

        // Submit to context
        submitProject(classId, lessonId, fileMetadata);

        // Show success notification
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);

        // Clear selected files
        setSelectedFiles([]);
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="project-submission">
            {showSuccess && (
                <div className="success-notification">
                    ✓ Project submitted successfully!
                </div>
            )}

            <div className="submission-header">
                <div className="project-badge">📁 Project Submission</div>
                <h1>{title}</h1>
                <p className="project-description">{description}</p>

                {existingSubmission && (
                    <div className="submission-status">
                        <div className="status-icon">✓</div>
                        <div className="status-text">
                            <strong>Submitted</strong>
                            <span>{new Date(existingSubmission.submittedAt).toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="submission-content">
                {!existingSubmission ? (
                    <>
                        <div
                            className={`upload-area ${isDragging ? 'dragging' : ''}`}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                        >
                            <div className="upload-icon">📤</div>
                            <h3>Drag and drop your files here</h3>
                            <p>or</p>
                            <label className="btn-select-files">
                                Browse Files
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />
                            </label>
                            <p className="upload-hint">Support for multiple files</p>
                        </div>

                        {selectedFiles.length > 0 && (
                            <div className="files-preview">
                                <h3>Selected Files ({selectedFiles.length})</h3>
                                <div className="files-list">
                                    {selectedFiles.map((file, index) => (
                                        <div key={index} className="file-item">
                                            <span className="file-icon">📄</span>
                                            <div className="file-info">
                                                <div className="file-name">{file.name}</div>
                                                <div className="file-size">{formatFileSize(file.size)}</div>
                                            </div>
                                            <button
                                                className="btn-remove-file"
                                                onClick={() => removeFile(index)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <button className="btn-submit" onClick={handleSubmit}>
                                    Submit Project →
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="submitted-files">
                        <h3>Submitted Files</h3>
                        <div className="files-list">
                            {existingSubmission.files.map((file, index) => (
                                <div key={index} className="file-item">
                                    <span className="file-icon">📄</span>
                                    <div className="file-info">
                                        <div className="file-name">{file.name}</div>
                                        <div className="file-size">{formatFileSize(file.size)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectSubmission;
