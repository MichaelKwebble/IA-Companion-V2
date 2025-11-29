import React, { useState } from 'react';
import { CheckCircle, Circle, Lock, PlayCircle, FileText, Video, Code, PenTool, Folder } from 'lucide-react';
import type { Lesson, LessonModule } from '../../../types/lectureTypes';
import { useLectureProgress } from '../../../context/LectureProgressContext';
import './LessonSidebar.css';

interface LessonSidebarProps {
    modules: LessonModule[];
    currentLessonId: string;
    onLessonSelect: (lessonId: string) => void;
    classProgress: number;
    classId: string;
}

const LessonSidebar: React.FC<LessonSidebarProps> = ({
    modules,
    currentLessonId,
    onLessonSelect,
    classProgress,
    classId
}) => {
    const { isLessonComplete } = useLectureProgress();
    const [expandedModules, setExpandedModules] = useState<string[]>(
        modules.map(m => m.id) // All expanded by default
    );

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev =>
            prev.includes(moduleId)
                ? prev.filter(id => id !== moduleId)
                : [...prev, moduleId]
        );
    };

    const getLessonIcon = (lesson: Lesson) => {
        const isCompleted = isLessonComplete(classId, lesson.id);
        const isActive = lesson.id === currentLessonId;

        if (isActive) return <PlayCircle size={16} className="icon-active" />;
        if (isCompleted) return <CheckCircle size={16} className="icon-completed" />;
        if (lesson.locked) return <Lock size={16} className="icon-locked" />;

        return <Circle size={16} className="icon-incomplete" />;
    };

    const getLessonTypeIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video size={14} />;
            case 'coding': return <Code size={14} />;
            case 'design': return <PenTool size={14} />;
            case 'project': return <Folder size={14} />;
            default: return <FileText size={14} />;
        }
    };

    return (
        <div className="lesson-sidebar">
            <div className="sidebar-header">
                <div className="overall-progress">
                    <div className="progress-label">Course Progress</div>
                    <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${classProgress}%` }} />
                    </div>
                    <div className="progress-percentage">{classProgress}%</div>
                </div>
            </div>

            <div className="modules-list">
                {modules.map((module, moduleIndex) => (
                    <div key={module.id} className="module-item">
                        <div
                            className="module-header"
                            onClick={() => toggleModule(module.id)}
                        >
                            <span className="module-toggle">
                                {expandedModules.includes(module.id) ? '▼' : '▶'}
                            </span>
                            <span className="module-number">{moduleIndex + 1}</span>
                            <span className="module-title">{module.title}</span>
                        </div>

                        {expandedModules.includes(module.id) && (
                            <div className="lessons-list">
                                {module.lessons.map((lesson) => {
                                    const isCompleted = isLessonComplete(classId, lesson.id);
                                    return (
                                        <div
                                            key={lesson.id}
                                            className={`lesson-item ${lesson.id === currentLessonId ? 'active' : ''} ${lesson.locked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}`}
                                            onClick={() => !lesson.locked && onLessonSelect(lesson.id)}
                                        >
                                            <span className="lesson-status-icon">{getLessonIcon(lesson)}</span>
                                            <div className="lesson-info">
                                                <div className="lesson-title-row">
                                                    <span className="lesson-title">{lesson.title}</span>
                                                    <span className="lesson-type-icon">{getLessonTypeIcon(lesson.type)}</span>
                                                </div>
                                                {lesson.duration && (
                                                    <div className="lesson-duration">{lesson.duration} min</div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LessonSidebar;
