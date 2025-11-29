import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Class } from '../../../types/lectureTypes';
import './ClassCard.css';

interface ClassCardProps {
    classData: Class;
}

const ClassCard: React.FC<ClassCardProps> = ({ classData }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        // Navigate to first lesson of first module
        const firstLesson = classData.modules[0]?.lessons[0];
        if (firstLesson) {
            navigate(`/lectures/${classData.id}/lesson/${firstLesson.id}`);
        }
    };

    return (
        <div className="class-card" onClick={handleClick}>
            <div className="class-thumbnail">
                <img src={classData.thumbnail} alt={classData.title} />
                <div className="class-category">{classData.category}</div>
                {classData.progressPercentage > 0 && (
                    <div className="class-in-progress">In Progress</div>
                )}
            </div>

            <div className="class-body">
                <h3 className="class-title">{classData.title}</h3>
                <p className="class-instructor">{classData.instructor}</p>

                <div className="class-meta">
                    <span className="lesson-count">
                        {classData.completedLessons} / {classData.totalLessons} lessons
                    </span>
                </div>

                <div className="progress-container">
                    <div className="progress-bar-bg">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${classData.progressPercentage}%` }}
                        />
                    </div>
                    <span className="progress-text">{classData.progressPercentage}%</span>
                </div>
            </div>
        </div>
    );
};

export default ClassCard;
