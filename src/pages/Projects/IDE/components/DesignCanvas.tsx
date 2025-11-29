import React, { useState, useRef } from 'react';
import './DesignCanvas.css';

export interface UIElement {
    id: string;
    type: 'rect' | 'text' | 'button';
    x: number;
    y: number;
    width: number;
    height: number;
    content?: string;
    style?: React.CSSProperties;
    name?: string;
}



interface DesignCanvasProps {
    elements: UIElement[];
    setElements: (elements: UIElement[]) => void;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
}

const DesignCanvas: React.FC<DesignCanvasProps> = ({ elements, setElements, selectedId, setSelectedId }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [initialElementState, setInitialElementState] = useState<UIElement | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/ui-component');
        if (!type || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newElement: UIElement = {
            id: Math.random().toString(36).substr(2, 9),
            type: type as any,
            x,
            y,
            width: type === 'button' ? 120 : 200,
            height: type === 'button' ? 40 : 100,
            content: type === 'text' ? 'New Text' : type === 'button' ? 'Button' : undefined,
            style: type === 'rect' ? { backgroundColor: '#f3f4f6' } : undefined,
            name: type === 'text' ? 'Text Layer' : type === 'button' ? 'Button Layer' : 'Rectangle'
        };

        setElements([...elements, newElement]);
        setSelectedId(newElement.id);
    };

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedId(id);
        const element = elements.find(el => el.id === id);
        if (element) {
            setIsDragging(true);
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialElementState({ ...element });
        }
    };

    const handleResizeStart = (e: React.MouseEvent, handle: string, id: string) => {
        e.stopPropagation();
        const element = elements.find(el => el.id === id);
        if (element) {
            setIsResizing(true);
            setResizeHandle(handle);
            setDragStart({ x: e.clientX, y: e.clientY });
            setInitialElementState({ ...element });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && initialElementState) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            setElements(elements.map(el =>
                el.id === initialElementState.id
                    ? { ...el, x: initialElementState.x + dx, y: initialElementState.y + dy }
                    : el
            ));
        } else if (isResizing && initialElementState && resizeHandle) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            let newWidth = initialElementState.width;
            let newHeight = initialElementState.height;
            let newX = initialElementState.x;
            let newY = initialElementState.y;

            if (resizeHandle.includes('r')) newWidth += dx;
            if (resizeHandle.includes('l')) {
                newWidth -= dx;
                newX += dx;
            }
            if (resizeHandle.includes('b')) newHeight += dy;
            if (resizeHandle.includes('t')) {
                newHeight -= dy;
                newY += dy;
            }

            setElements(elements.map(el =>
                el.id === initialElementState.id
                    ? { ...el, x: newX, y: newY, width: Math.max(10, newWidth), height: Math.max(10, newHeight) }
                    : el
            ));
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
        setInitialElementState(null);
    };

    return (
        <div
            className="design-canvas"
            ref={canvasRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => setSelectedId(null)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {elements.map(el => (
                <div
                    key={el.id}
                    className={`canvas-element ${selectedId === el.id ? 'selected' : ''}`}
                    style={{
                        left: el.x,
                        top: el.y,
                        width: el.width,
                        height: el.height,
                        ...el.style
                    }}
                    onMouseDown={(e) => handleMouseDown(e, el.id)}
                    onClick={(e) => e.stopPropagation()}
                >
                    {el.type === 'text' && el.content}
                    {el.type === 'button' && <button style={{ width: '100%', height: '100%', ...el.style }}>{el.content}</button>}

                    {/* Selection Handles */}
                    {selectedId === el.id && (
                        <>
                            <div className="handle tl" onMouseDown={(e) => handleResizeStart(e, 'tl', el.id)} />
                            <div className="handle tr" onMouseDown={(e) => handleResizeStart(e, 'tr', el.id)} />
                            <div className="handle bl" onMouseDown={(e) => handleResizeStart(e, 'bl', el.id)} />
                            <div className="handle br" onMouseDown={(e) => handleResizeStart(e, 'br', el.id)} />
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

export default DesignCanvas;
