import React, { useState, useEffect } from 'react';
import { GitBranch, Repeat, Code, Layers, Cpu } from 'lucide-react';
import './BlockLibrary.css';

type BlockCategory = 'logic' | 'loops' | 'math' | 'custom' | 'ia-firmware';

const BlockLibrary: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<BlockCategory>('logic');
    const [hasFirmware, setHasFirmware] = useState(false);

    useEffect(() => {
        const checkFirmware = async () => {
            try {
                const response = await fetch('http://localhost:3001/api/arduino/firmware/status');
                const data = await response.json();
                if (data.success && data.exists) {
                    setHasFirmware(true);
                }
            } catch (error) {
                console.error('Failed to check firmware status:', error);
            }
        };

        checkFirmware();

        // Listen for real-time updates from other components
        window.addEventListener('firmware-updated', checkFirmware);
        return () => window.removeEventListener('firmware-updated', checkFirmware);
    }, []);

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
            case 'ia-firmware':
                return (
                    <div className="block-list">
                        <div className="block-item ia-block" draggable onDragStart={(e) => handleDragStart(e, 'incipe.getLightIntensity();')}>Get Light Intensity</div>
                        <div className="block-item ia-block" draggable onDragStart={(e) => handleDragStart(e, 'incipe.getPPM();')}>Get PPM</div>
                        <div className="block-item ia-block" draggable onDragStart={(e) => handleDragStart(e, 'incipe.getDistance();')}>Get Distance</div>
                        <div className="block-item ia-block" draggable onDragStart={(e) => handleDragStart(e, 'incipe.onscreen("#position", "thing to show");')}>On Screen Display</div>
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
                {hasFirmware && (
                    <button
                        className={`lib-tab ${activeCategory === 'ia-firmware' ? 'active' : ''}`}
                        onClick={() => setActiveCategory('ia-firmware')}
                        title="IA Firmware"
                    >
                        <Cpu size={20} />
                    </button>
                )}
                <button
                    className={`lib-tab ${activeCategory === 'custom' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('custom')}
                    title="My Blocks"
                >
                    <Layers size={20} />
                </button>
            </div>
            <div className="library-content">
                <div className="category-title">{activeCategory === 'ia-firmware' ? 'IA FIRMWARE' : activeCategory.toUpperCase()}</div>
                {renderBlocks()}
            </div>
        </div>
    );
};

export default BlockLibrary;
