import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockClasses } from '../../data/mockLectureData';
import type { Lesson } from '../../types/lectureTypes';
import LessonSidebar from './components/LessonSidebar';
import LessonContent from './components/LessonContent';
import './LectureViewer.css';

const LectureViewer: React.FC = () => {
    const { classId, lessonId } = useParams<{ classId: string; lessonId: string }>();
    const navigate = useNavigate();

    const currentClass = mockClasses.find(c => c.id === classId);
    const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);

    useEffect(() => {
        if (currentClass && lessonId) {
            // Find the lesson
            for (const module of currentClass.modules) {
                const lesson = module.lessons.find(l => l.id === lessonId);
                if (lesson) {
                    setCurrentLesson(lesson);
                    break;
                }
            }
        }
    }, [currentClass, lessonId]);

    if (!currentClass || !currentLesson) {
        return (
            <div className="lecture-viewer-error">
                <h2>Lesson not found</h2>
                <button onClick={() => navigate('/lectures')}>Return to Dashboard</button>
            </div>
        );
    }

    const getAllLessons = (): Lesson[] => {
        return currentClass.modules.flatMap(m => m.lessons);
    };

    const allLessons = getAllLessons();
    const currentIndex = allLessons.findIndex(l => l.id === currentLesson.id);
    const hasNext = currentIndex < allLessons.length - 1;
    const hasPrevious = currentIndex > 0;

    const handleLessonSelect = (newLessonId: string) => {
        navigate(`/lectures/${classId}/lesson/${newLessonId}`);
    };

    const handleNext = () => {
        if (hasNext) {
            const nextLesson = allLessons[currentIndex + 1];
            handleLessonSelect(nextLesson.id);
        }
    };

    const handlePrevious = () => {
        if (hasPrevious) {
            const prevLesson = allLessons[currentIndex - 1];
            handleLessonSelect(prevLesson.id);
        }
    };

    const handleComplete = () => {
        // Auto-navigate to next lesson after a short delay
        if (hasNext) {
            setTimeout(() => {
                handleNext();
            }, 1500);
        }
    };

    return (
        <div className="lecture-viewer">
            <LessonSidebar
                modules={currentClass.modules}
                currentLessonId={currentLesson.id}
                onLessonSelect={handleLessonSelect}
                classProgress={currentClass.progressPercentage}
                classId={classId!}
            />

            <LessonContent
                lesson={currentLesson}
                classId={classId!}
                onComplete={handleComplete}
                onNext={handleNext}
                onPrevious={handlePrevious}
                hasNext={hasNext}
                hasPrevious={hasPrevious}
            />
        </div>
    );
};

export default LectureViewer;
