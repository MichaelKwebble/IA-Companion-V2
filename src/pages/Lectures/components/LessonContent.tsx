import React from 'react';
import type { Lesson } from '../../../types/lectureTypes';
import { useLectureProgress } from '../../../context/LectureProgressContext';
import VideoLesson from './VideoLesson';
import ExerciseLesson from './ExerciseLesson';
import ProjectSubmission from './ProjectSubmission';
import './LessonContent.css';

interface LessonContentProps {
    lesson: Lesson;
    classId: string;
    onComplete: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
    hasNext: boolean;
    hasPrevious: boolean;
}

const LessonContent: React.FC<LessonContentProps> = ({
    lesson,
    classId,
    onComplete,
    onNext,
    onPrevious,
    hasNext,
    hasPrevious
}) => {
    const { markLessonComplete, isLessonComplete } = useLectureProgress();
    const isCompleted = isLessonComplete(classId, lesson.id);
    const renderLessonContent = () => {
        switch (lesson.type) {
            case 'video':
                return (
                    <VideoLesson
                        title={lesson.title}
                        description={lesson.description}
                        videoUrl={lesson.videoUrl || ''}
                        resources={lesson.resources}
                    />
                );

            case 'coding':
            case 'design':
                return (
                    <ExerciseLesson
                        title={lesson.title}
                        description={lesson.description}
                        exerciseType={lesson.type}
                        classId={classId}
                        lessonId={lesson.id}
                    />
                );

            case 'project':
                return (
                    <ProjectSubmission
                        title={lesson.title}
                        description={lesson.description}
                        classId={classId}
                        lessonId={lesson.id}
                    />
                );

            default:
                return (
                    <div className="lesson-placeholder">
                        <h1>{lesson.title}</h1>
                        <p>{lesson.description}</p>
                    </div>
                );
        }
    };

    const [showToast, setShowToast] = React.useState(false);

    const handleComplete = () => {
        markLessonComplete(classId, lesson.id);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        onComplete();
    };

    return (
        <div className="lesson-content-container">
            {showToast && (
                <div className="completion-toast">
                    <div className="toast-icon">✅</div>
                    <div className="toast-message">Lesson Completed!</div>
                </div>
            )}
            <div className="lesson-content-scroll">
                {renderLessonContent()}
            </div>

            <div className="lesson-navigation">
                <div className="nav-buttons">
                    <button
                        className="btn-nav"
                        onClick={onPrevious}
                        disabled={!hasPrevious}
                    >
                        ← Previous
                    </button>

                    {!isCompleted && (
                        <button
                            className="btn-complete"
                            onClick={handleComplete}
                        >
                            ✓ Mark as Complete
                        </button>
                    )}

                    {isCompleted && (
                        <div className="completion-badge">✓ Completed</div>
                    )}
                    <button
                        className="btn-nav btn-nav-primary"
                        onClick={onNext}
                        disabled={!hasNext}
                    >
                        Next →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LessonContent;
