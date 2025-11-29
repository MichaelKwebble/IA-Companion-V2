export type LessonType = 'video' | 'coding' | 'design' | 'project' | 'reading';

export interface LessonResource {
    id: string;
    name: string;
    type: 'pdf' | 'code' | 'image' | 'zip' | 'other';
    url: string;
    size?: string;
}

export interface Lesson {
    id: string;
    title: string;
    type: LessonType;
    duration?: number; // in minutes
    description: string;
    videoUrl?: string;
    resources?: LessonResource[];
    completed: boolean;
    locked?: boolean;
}

export interface LessonModule {
    id: string;
    title: string;
    lessons: Lesson[];
}

export interface Class {
    id: string;
    title: string;
    instructor: string;
    thumbnail: string;
    description: string;
    modules: LessonModule[];
    totalLessons: number;
    completedLessons: number;
    progressPercentage: number;
    category: string;
}

export interface UserProgress {
    lastStudiedClassId: string;
    lastStudiedLessonId: string;
    totalLessonsCompleted: number;
    totalStudyHours: number;
    currentStreak: number; // days
    completionRate: number; // percentage
}

export interface DashboardStats {
    lessonsCompleted: number;
    studyStreak: number;
    totalHours: number;
    completionRate: number;
}
