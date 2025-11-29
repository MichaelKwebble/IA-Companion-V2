import React from 'react';
import { Type, Square, Circle, Image, Box, MousePointerClick } from 'lucide-react';
import './ComponentLibrary.css';

const COMPONENTS = [
    { type: 'rect', label: 'Frame', icon: <Square size={20} /> },
    { type: 'text', label: 'Text', icon: <Type size={20} /> },
    { type: 'button', label: 'Button', icon: <MousePointerClick size={20} /> },
    { type: 'image', label: 'Image', icon: <Image size={20} /> },
    { type: 'circle', label: 'Ellipse', icon: <Circle size={20} /> },
    { type: 'input', label: 'Input', icon: <Box size={20} /> },
];

const ComponentLibrary: React.FC = () => {
    const handleDragStart = (e: React.DragEvent, type: string) => {
        e.dataTransfer.setData('application/ui-component', type);
    };

    return (
        <div className="component-library">
            <div className="library-header">Components</div>
            <div className="component-grid">
                {COMPONENTS.map(comp => (
                    <div
                        key={comp.type}
                        className="component-item"
                        draggable
                        onDragStart={(e) => handleDragStart(e, comp.type)}
                    >
                        <div className="component-icon">{comp.icon}</div>
                        <span className="component-label">{comp.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ComponentLibrary;
