import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import './LessonToolbar.css';

interface LessonToolbarProps {
    classId: string;
    lessonId: string;
    onCheckCode?: () => void;
}

const LessonToolbar: React.FC<LessonToolbarProps> = ({ classId, lessonId, onCheckCode }) => {
    const navigate = useNavigate();

    const handleBackToLesson = () => {
        navigate(`/lectures/${classId}/lesson/${lessonId}`);
    };

    return (
        <div className="lesson-toolbar">
            <div className="lesson-toolbar-content">
                <div className="lesson-indicator">
                    <span className="lesson-badge">📚 Lesson Exercise</span>
                </div>

                <div className="lesson-actions">
                    {onCheckCode && (
                        <button className="btn-check-code" onClick={onCheckCode}>
                            <CheckCircle size={16} />
                            Check Code
                        </button>
                    )}

                    <button className="btn-back-to-lesson" onClick={handleBackToLesson}>
                        <ArrowLeft size={16} />
                        Back to Lesson
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LessonToolbar;
