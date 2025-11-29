import React from 'react';
import './DashboardStats.css';

interface DashboardStatsProps {
    lessonsCompleted: number;
    studyStreak: number;
    totalHours: number;
    completionRate: number;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
    lessonsCompleted,
    studyStreak,
    totalHours,
    completionRate
}) => {
    return (
        <div className="dashboard-stats">
            <div className="stat-card stat-card-primary">
                <div className="stat-icon">📚</div>
                <div className="stat-content">
                    <div className="stat-value">{lessonsCompleted}</div>
                    <div className="stat-label">Lessons Completed</div>
                </div>
            </div>

            <div className="stat-card stat-card-success">
                <div className="stat-icon">🔥</div>
                <div className="stat-content">
                    <div className="stat-value">{studyStreak}</div>
                    <div className="stat-label">Day Streak</div>
                </div>
            </div>

            <div className="stat-card stat-card-warning">
                <div className="stat-icon">⏱️</div>
                <div className="stat-content">
                    <div className="stat-value">{totalHours.toFixed(1)}</div>
                    <div className="stat-label">Study Hours</div>
                </div>
            </div>

            <div className="stat-card stat-card-info">
                <div className="stat-icon">📊</div>
                <div className="stat-content">
                    <div className="stat-value">{completionRate}%</div>
                    <div className="stat-label">Completion Rate</div>
                </div>
            </div>
        </div>
    );
};

export default DashboardStats;
