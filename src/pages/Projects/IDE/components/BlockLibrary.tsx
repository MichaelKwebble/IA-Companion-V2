import React, { useState } from 'react';
import { GitBranch, Repeat, Code, Layers } from 'lucide-react';
import './BlockLibrary.css';

type BlockCategory = 'logic' | 'loops' | 'math' | 'custom';

const BlockLibrary: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<BlockCategory>('logic');

    const handleDragStart = (e: React.DragEvent, snippet: string) => {
        e.dataTransfer.setData('application/x-code-snippet', snippet);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const renderBlocks = () => {
        switch (activeCategory) {
            case 'logic':
                return (
                    <div className="block-list">
                        <div className="block-item logic-block" draggable onDragStart={(e) => handleDragStart(e, 'if (condition) {\n  \n}')}>If ... Then</div>
                        <div className="block-item logic-block" draggable onDragStart={(e) => handleDragStart(e, 'if (condition) {\n  \n} else {\n  \n}')}>If ... Then ... Else</div>
                        <div className="block-item logic-block" draggable onDragStart={(e) => handleDragStart(e, '(a == b)')}>Comparison (==)</div>
                        <div className="block-item logic-block" draggable onDragStart={(e) => handleDragStart(e, '(a && b)')}>Boolean (AND)</div>
                    </div>
                );
            case 'loops':
                return (
                    <div className="block-list">
                        <div className="block-item loop-block" draggable onDragStart={(e) => handleDragStart(e, 'for (int i = 0; i < 10; i++) {\n  \n}')}>Repeat 10 times</div>
                        <div className="block-item loop-block" draggable onDragStart={(e) => handleDragStart(e, 'while (condition) {\n  \n}')}>While ... do</div>
                        <div className="block-item loop-block" draggable onDragStart={(e) => handleDragStart(e, 'for (int i = 0; i < 10; i++) {\n  \n}')}>For i = 0 to 10</div>
                        <div className="block-item loop-block" draggable onDragStart={(e) => handleDragStart(e, 'break;')}>Break</div>
                    </div>
                );
            case 'math':
                return (
                    <div className="block-list">
                        <div className="block-item math-block" draggable onDragStart={(e) => handleDragStart(e, '0')}>Number (0)</div>
                        <div className="block-item math-block" draggable onDragStart={(e) => handleDragStart(e, '(a + b)')}>Arithmetic (+)</div>
                        <div className="block-item math-block" draggable onDragStart={(e) => handleDragStart(e, 'random(1, 100)')}>Random (1 to 100)</div>
                        <div className="block-item math-block" draggable onDragStart={(e) => handleDragStart(e, 'map(value, fromLow, fromHigh, toLow, toHigh)')}>Map Range</div>
                    </div>
                );
            case 'custom':
                return (
                    <div className="block-list">
                        <div className="block-item custom-block" draggable onDragStart={(e) => handleDragStart(e, 'myFunction1();')}>My Function 1</div>
                        <div className="block-item custom-block" draggable onDragStart={(e) => handleDragStart(e, 'myFunction2();')}>My Function 2</div>
                        <div className="block-item custom-block">+ Create New Block</div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="block-library">
            <div className="library-sidebar">
                <button
                    className={`lib-tab ${activeCategory === 'logic' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('logic')}
                    title="Logic"
                >
                    <GitBranch size={20} />
                </button>
                <button
                    className={`lib-tab ${activeCategory === 'loops' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('loops')}
                    title="Loops"
                >
                    <Repeat size={20} />
                </button>
                <button
                    className={`lib-tab ${activeCategory === 'math' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('math')}
                    title="Math"
                >
                    <Code size={20} />
                </button>
                <button
                    className={`lib-tab ${activeCategory === 'custom' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('custom')}
                    title="My Blocks"
                >
                    <Layers size={20} />
                </button>
            </div>
            <div className="library-content">
                <div className="category-title">{activeCategory.toUpperCase()}</div>
                {renderBlocks()}
            </div>
        </div>
    );
};

export default BlockLibrary;
