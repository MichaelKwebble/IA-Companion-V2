import React from 'react';
import { useNavigate } from 'react-router-dom';
import './ExerciseLesson.css';

interface ExerciseLessonProps {
    title: string;
    description: string;
    exerciseType: 'coding' | 'design';
    classId: string;
    lessonId: string;
}

const ExerciseLesson: React.FC<ExerciseLessonProps> = ({
    title,
    description,
    exerciseType,
    classId,
    lessonId
}) => {
    const navigate = useNavigate();

    const handleStartExercise = () => {
        // Navigate to IDE with course project ID and exercise context
        const projectId = `course-${classId}`;
        const type = exerciseType === 'coding' ? 'code' : 'design';
        navigate(`/projects/${projectId}?type=${type}&lessonId=${lessonId}&classId=${classId}`);
    };

    return (
        <div className="exercise-lesson">
            <div className="exercise-header">
                <div className="exercise-type-badge">
                    {exerciseType === 'coding' ? '💻 Coding Exercise' : '🎨 Design Exercise'}
                </div>
                <h1>{title}</h1>
                <p className="exercise-description">{description}</p>
            </div>

            <div className="exercise-content">
                <div className="exercise-info-card">
                    <h3>🎯 What you'll build</h3>
                    <p>
                        {exerciseType === 'coding'
                            ? 'Apply your knowledge by writing code to solve real-world embedded systems challenges. Your code will run directly on the target hardware.'
                            : 'Create a user interface design for an embedded display. Use the design tools to build an intuitive and visually appealing interface.'}
                    </p>
                </div>

                <div className="exercise-info-card">
                    <h3>📝 Instructions</h3>
                    <ul>
                        {exerciseType === 'coding' ? (
                            <>
                                <li>Click the button below to open the coding environment</li>
                                <li>Write your code following the requirements</li>
                                <li>Test your solution using the built-in simulator</li>
                                <li>Submit when you're ready</li>
                            </>
                        ) : (
                            <>
                                <li>Click the button below to open the design canvas</li>
                                <li>Drag and drop UI elements to create your interface</li>
                                <li>Customize colors, sizes, and positions</li>
                                <li>Preview your design on different screen sizes</li>
                            </>
                        )}
                    </ul>
                </div>

                <button className="btn-start-exercise" onClick={handleStartExercise}>
                    {exerciseType === 'coding' ? '💻 Start Coding' : '🎨 Start Designing'} →
                </button>
            </div>
        </div>
    );
};

export default ExerciseLesson;
