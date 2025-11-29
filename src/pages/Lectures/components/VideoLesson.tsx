import React from 'react';
import type { LessonResource } from '../../../types/lectureTypes';
import './VideoLesson.css';

interface VideoLessonProps {
    title: string;
    description: string;
    videoUrl: string;
    resources?: LessonResource[];
}

const VideoLesson: React.FC<VideoLessonProps> = ({
    title,
    description,
    videoUrl,
    resources = []
}) => {
    const getFileIcon = (type: string) => {
        switch (type) {
            case 'pdf':
                return '📄';
            case 'code':
                return '💻';
            case 'image':
                return '🖼️';
            case 'zip':
                return '📦';
            default:
                return '📎';
        }
    };

    return (
        <div className="video-lesson">
            <div className="video-container">
                <video
                    controls
                    controlsList="nodownload"
                    className="video-player"
                    src={videoUrl}
                >
                    Your browser does not support the video tag.
                </video>
            </div>

            <div className="lesson-details">
                <h1>{title}</h1>
                <p className="lesson-description">{description}</p>

                {resources.length > 0 && (
                    <div className="resources-section">
                        <h3>📚 Resources</h3>
                        <div className="resources-list">
                            {resources.map(resource => (
                                <a
                                    key={resource.id}
                                    href={resource.url}
                                    className="resource-item"
                                    download
                                >
                                    <span className="resource-icon">{getFileIcon(resource.type)}</span>
                                    <div className="resource-info">
                                        <div className="resource-name">{resource.name}</div>
                                        {resource.size && (
                                            <div className="resource-size">{resource.size}</div>
                                        )}
                                    </div>
                                    <span className="download-icon">⬇️</span>
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoLesson;
