import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface LessonProgress {
    completed: boolean;
    completedAt?: string;
}

interface ProjectSubmission {
    lessonId: string;
    classId: string;
    submittedAt: string;
    files: Array<{ name: string; size: number }>;
}

interface LectureProgressState {
    // Key format: "{classId}-{lessonId}"
    lessonProgress: Record<string, LessonProgress>;
    submissions: ProjectSubmission[];
}

interface LectureProgressContextType {
    lessonProgress: Record<string, LessonProgress>;
    submissions: ProjectSubmission[];
    markLessonComplete: (classId: string, lessonId: string) => void;
    isLessonComplete: (classId: string, lessonId: string) => boolean;
    submitProject: (classId: string, lessonId: string, files: Array<{ name: string; size: number }>) => void;
    getSubmission: (classId: string, lessonId: string) => ProjectSubmission | undefined;
    getTotalCompletedLessons: () => number;
}

const LectureProgressContext = createContext<LectureProgressContextType | undefined>(undefined);

const STORAGE_KEY = 'lecture-progress';

const loadProgressFromStorage = (): LectureProgressState => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error loading progress from localStorage:', error);
    }
    return { lessonProgress: {}, submissions: [] };
};

const saveProgressToStorage = (state: LectureProgressState) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.error('Error saving progress to localStorage:', error);
    }
};

export const LectureProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<LectureProgressState>(loadProgressFromStorage);

    // Save to localStorage whenever state changes
    useEffect(() => {
        saveProgressToStorage(state);
    }, [state]);

    const markLessonComplete = (classId: string, lessonId: string) => {
        const key = `${classId}-${lessonId}`;
        setState(prev => ({
            ...prev,
            lessonProgress: {
                ...prev.lessonProgress,
                [key]: {
                    completed: true,
                    completedAt: new Date().toISOString(),
                },
            },
        }));
    };

    const isLessonComplete = (classId: string, lessonId: string): boolean => {
        const key = `${classId}-${lessonId}`;
        return state.lessonProgress[key]?.completed || false;
    };

    const submitProject = (classId: string, lessonId: string, files: Array<{ name: string; size: number }>) => {
        const submission: ProjectSubmission = {
            classId,
            lessonId,
            submittedAt: new Date().toISOString(),
            files,
        };

        setState(prev => ({
            ...prev,
            submissions: [...prev.submissions, submission],
        }));

        // Also mark lesson as complete
        markLessonComplete(classId, lessonId);
    };

    const getSubmission = (classId: string, lessonId: string): ProjectSubmission | undefined => {
        return state.submissions.find(s => s.classId === classId && s.lessonId === lessonId);
    };

    const getTotalCompletedLessons = (): number => {
        return Object.values(state.lessonProgress).filter(p => p.completed).length;
    };

    const value: LectureProgressContextType = {
        lessonProgress: state.lessonProgress,
        submissions: state.submissions,
        markLessonComplete,
        isLessonComplete,
        submitProject,
        getSubmission,
        getTotalCompletedLessons,
    };

    return (
        <LectureProgressContext.Provider value={value}>
            {children}
        </LectureProgressContext.Provider>
    );
};

export const useLectureProgress = (): LectureProgressContextType => {
    const context = useContext(LectureProgressContext);
    if (!context) {
        throw new Error('useLectureProgress must be used within LectureProgressProvider');
    }
    return context;
};
