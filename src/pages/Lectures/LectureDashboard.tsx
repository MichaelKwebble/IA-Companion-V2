import React from 'react';
import { mockClasses, mockUserProgress } from '../../data/mockLectureData';
import DashboardStats from './components/DashboardStats';
import ContinueLearning from './components/ContinueLearning';
import ClassCard from './components/ClassCard';
import './LectureDashboard.css';

const LectureDashboard: React.FC = () => {
    // Find the current class
    const currentClass = mockClasses.find(c => c.id === mockUserProgress.lastStudiedClassId);

    return (
        <div className="lecture-dashboard">
            <div className="dashboard-header">
                <h1>My Learning</h1>
                <p className="dashboard-subtitle">Continue your embedded systems journey</p>
            </div>

            <DashboardStats
                lessonsCompleted={mockUserProgress.totalLessonsCompleted}
                studyStreak={mockUserProgress.currentStreak}
                totalHours={mockUserProgress.totalStudyHours}
                completionRate={mockUserProgress.completionRate}
            />

            {currentClass && (
                <ContinueLearning
                    currentClass={currentClass}
                    currentLessonId={mockUserProgress.lastStudiedLessonId}
                />
            )}

            <div className="classes-section">
                <h2>My Classes</h2>
                <div className="classes-grid">
                    {mockClasses.map(classData => (
                        <ClassCard key={classData.id} classData={classData} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default LectureDashboard;
