import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Class } from '../../../types/lectureTypes';
import './ContinueLearning.css';

interface ContinueLearningProps {
    currentClass: Class;
    currentLessonId: string;
}

const ContinueLearning: React.FC<ContinueLearningProps> = ({ currentClass, currentLessonId }) => {
    const navigate = useNavigate();

    // Find the current lesson
    let currentLesson = null;
    for (const module of currentClass.modules) {
        const lesson = module.lessons.find(l => l.id === currentLessonId);
        if (lesson) {
            currentLesson = lesson;
            break;
        }
    }

    const handleContinue = () => {
        navigate(`/lectures/${currentClass.id}/lesson/${currentLessonId}`);
    };

    if (!currentLesson) return null;

    return (
        <div className="continue-learning">
            <div className="continue-header">
                <h3>Continue Learning</h3>
                <div className="continue-progress">{currentClass.progressPercentage}% Complete</div>
            </div>

            <div className="continue-content">
                <div className="continue-thumbnail">
                    <img src={currentClass.thumbnail} alt={currentClass.title} />
                    <div className="play-overlay">
                        <div className="play-icon">▶</div>
                    </div>
                </div>

                <div className="continue-info">
                    <h2>{currentClass.title}</h2>
                    <p className="continue-instructor">with {currentClass.instructor}</p>
                    <p className="continue-lesson">
                        <span className="lesson-type-badge">{currentLesson.type}</span>
                        {currentLesson.title}
                    </p>
                    <button className="btn-continue" onClick={handleContinue}>
                        Continue Learning →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContinueLearning;
