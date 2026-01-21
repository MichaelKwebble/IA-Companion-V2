import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize, Play, Pause, RefreshCw } from 'lucide-react';
import './FlowMap.css';

export interface FlowNode {
    id: string;
    label: string;
    type: 'start' | 'process' | 'decision' | 'end' | 'loop';
    x: number;
    y: number;
    depth: number;
    parentLoopId?: string;
    lineNumbers?: number[];
    loopInfo?: {
        variable: string;
        start: number;
        end: number;
        step: number;
        type: 'for' | 'while';
    };
}

export interface FlowEdge {
    id: string;
    from: string;
    to: string;
    label?: string;
}

interface FlowMapProps {
    nodes?: FlowNode[];
    edges?: FlowEdge[];
    arrays?: Record<string, any[]>;
    onHighlightLines?: (lines: number[]) => void;
    onRefresh?: () => void;
}

const FlowMap: React.FC<FlowMapProps> = ({ nodes = [], edges = [], arrays: initialArrays = {}, onHighlightLines, onRefresh }) => {
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [finishedNodeIds, setFinishedNodeIds] = useState<Set<string>>(new Set());

    // Panning state
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    // Zoom state
    const [zoom, setZoom] = useState(1);
    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 3;

    // Playback state
    const [isPlaying, setIsPlaying] = useState(false);
    const [simulatedValues, setSimulatedValues] = useState<Record<string, number>>({});
    const [trackedVariables, setTrackedVariables] = useState<string[]>([]);
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const [activeTab, setActiveTab] = useState<'vars' | 'arrays' | 'logs'>('vars');
    const [programLogs, setProgramLogs] = useState<{ msg: string, type: 'info' | 'success' | 'warn' }[]>([]);

    // Refs for simulation to avoid stale closures in setInterval
    const valuesRef = useRef<Record<string, number>>({});
    const iterationsRef = useRef<Record<string, number>>({});
    const logsRef = useRef<{ msg: string, type: 'info' | 'success' | 'warn' }[]>([]);
    const finishedRef = useRef<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // Static Analysis: Extract available variables from nodes
    const availableVariables = useMemo(() => {
        const vars = new Set<string>();
        nodes.forEach(node => {
            if (node.loopInfo?.variable) vars.add(node.loopInfo.variable);

            // 1. Match assignments: x = 5, int count = 0 (avoid ==). Handle "Declare x" pattern.
            const assignmentMatch = node.label.match(/(?:int|float|double|uint8_t|uint16_t|Declare)?\s*([a-zA-Z_]\w*)\s*=[^=]/);
            if (assignmentMatch) vars.add(assignmentMatch[1]);

            // 2. Variable only declarations: Declare x
            const declareOnlyMatch = node.label.match(/^Declare\s+([a-zA-Z_]\w*)$/);
            if (declareOnlyMatch) vars.add(declareOnlyMatch[1]);

            // 3. Match updates: a++, count--
            const updateMatch = node.label.match(/\b([a-zA-Z_]\w*)\s*(?:\+\+|--)/);
            if (updateMatch) vars.add(updateMatch[1]);

            // 4. Fallback for simple assignment at end of string or single '='
            if (!assignmentMatch && node.label.includes('=') && !node.label.includes('==')) {
                const parts = node.label.split('=');
                const nameMatch = parts[0].trim().match(/(?:int|float|double|uint8_t|uint16_t|Declare)?\s*([a-zA-Z_]\w*)$/);
                if (nameMatch) vars.add(nameMatch[1]);
            }
        });
        return Array.from(vars);
    }, [nodes]);

    const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
        const newLog = { msg, type };
        logsRef.current = [newLog, ...logsRef.current].slice(0, 50);
        setProgramLogs([...logsRef.current]);
    }, []);

    // Keep trackedVariables in sync with availableVariables to prevent "ghost" data
    useEffect(() => {
        setTrackedVariables(prev => {
            const filtered = prev.filter(v => availableVariables.includes(v));
            if (filtered.length !== prev.length) return filtered;
            return prev;
        });
    }, [availableVariables]);

    const resetSimulation = useCallback(() => {
        setIsPlaying(false);
        setActiveNodeId(null);
        setSimulatedValues({});
        setFinishedNodeIds(new Set());
        valuesRef.current = {};
        iterationsRef.current = {};
        finishedRef.current = new Set();
        logsRef.current = [];
        setProgramLogs([]);
        if (onHighlightLines) onHighlightLines([]);
        addLog("Simulation Reset. Ready to start.", "info");
    }, [onHighlightLines, addLog]);

    const handleManualRefresh = useCallback((e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        resetSimulation();
        if (onRefresh) onRefresh();
        addLog("Code re-traced and simulation reset.", "info");
    }, [resetSimulation, onRefresh, addLog]);

    // Calculate SVG viewBox dimensions based on nodes
    const dimensions = useMemo(() => {
        if (nodes.length === 0) return { width: 400, height: 300 };

        const maxX = Math.max(...nodes.map(n => n.x)) + 150;
        const maxY = Math.max(...nodes.map(n => n.y)) + 100;
        return {
            width: Math.max(400, maxX),
            height: Math.max(300, maxY)
        };
    }, [nodes]);

    // Panning handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left mouse button
        setIsPanning(true);
        setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }, [pan]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isPanning) return;
        setPan({
            x: e.clientX - startPan.x,
            y: e.clientY - startPan.y
        });
    }, [isPanning, startPan]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Helper to convert screen coordinates to SVG coordinates
    const getSVGPoint = useCallback((clientX: number, clientY: number) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const svg = svgRef.current;
        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;

        // We want the point relative to the SVG's viewBox units, 
        // but BEFORE the internal group transform (translate/scale)
        const CTM = svg.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };

        return pt.matrixTransform(CTM.inverse());
    }, []);

    // Helper to zoom toward a specific point
    const zoomTowardPoint = useCallback((pointX: number, pointY: number, factor: number) => {
        setZoom(prevZoom => {
            const newZoom = Math.min(Math.max(prevZoom * factor, MIN_ZOOM), MAX_ZOOM);
            const actualFactor = newZoom / prevZoom;

            setPan(prevPan => ({
                // Math: newPan = point - (point - oldPan) * actualFactor
                x: pointX - (pointX - prevPan.x) * actualFactor,
                y: pointY - (pointY - prevPan.y) * actualFactor
            }));

            return newZoom;
        });
    }, [MIN_ZOOM, MAX_ZOOM]);

    // Zoom handlers
    const handleZoomIn = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const svgPoint = getSVGPoint(centerX, centerY);
        zoomTowardPoint(svgPoint.x, svgPoint.y, 1.2);
    };

    const handleZoomOut = () => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const svgPoint = getSVGPoint(centerX, centerY);
        zoomTowardPoint(svgPoint.x, svgPoint.y, 0.8);
    };

    const handleResetZoom = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    // Use native event listener to avoid "passive event listener" preventDefault issue
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = -e.deltaY;
                const factor = Math.pow(1.1, delta / 100);

                const svgPoint = getSVGPoint(e.clientX, e.clientY);
                zoomTowardPoint(svgPoint.x, svgPoint.y, factor);
            }
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [getSVGPoint, zoomTowardPoint]);

    // Reset pan and zoom when nodes change significantly
    useEffect(() => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
        resetSimulation();
    }, [nodes, resetSimulation]); // Detect any change in nodes structure/content

    // Handle highlighted lines when activeNode changes
    useEffect(() => {
        if (onHighlightLines) {
            const activeNode = nodes.find(n => n.id === activeNodeId);
            if (activeNode && activeNode.lineNumbers) {
                // Adjust for 1-based indexing if the parser used 0-based
                // Looking at parser, it uses lines = code.split('\n') and i which starts at 0.
                // Monaco is 1-based.
                onHighlightLines(activeNode.lineNumbers.map(l => l + 1));
            } else {
                onHighlightLines([]);
            }
        }
    }, [activeNodeId, nodes, onHighlightLines]);



    // Playback animation
    useEffect(() => {
        if (!isPlaying || nodes.length === 0) {
            setActiveNodeId(null);
            // Don't clear simulatedValues here so user can see last values when paused
            setFinishedNodeIds(new Set());
            valuesRef.current = {};
            iterationsRef.current = {};
            finishedRef.current = new Set();
            logsRef.current = [];
            setProgramLogs([]);
            return;
        }

        // Find setup and loop start nodes
        const setupStartNode = nodes.find(n => n.label === "setup()");
        const loopStartNode = nodes.find(n => n.label === "loop()");

        let currentNodeId = setupStartNode ? setupStartNode.id : nodes[0].id;
        setActiveNodeId(currentNodeId);
        addLog("Starting Execution...", "info");

        const runStep = () => {
            const currentNode = nodes.find(n => n.id === currentNodeId);
            if (!currentNode) return;

            // Mark current node as visited/finished for "grey out" logic
            // Rule: If node is inside a loop, it's not "permanently" finished until the loop is done.
            if (!currentNode.parentLoopId) {
                finishedRef.current.add(currentNode.id);
                setFinishedNodeIds(new Set(finishedRef.current));
            }

            // Find possible next edges
            const outgoingEdges = edges.filter(e => e.from === currentNodeId);

            if (outgoingEdges.length === 0) {
                // End of a function block
                if (currentNode.label.includes("End setup") && loopStartNode) {
                    addLog("Setup block finished. Entering loop...", "success");
                    currentNodeId = loopStartNode.id;
                } else if (currentNode.label.includes("End loop")) {
                    // REACHED THE REAL END. User requested we stay here and not just reset.
                    addLog("Reached end of main loop. No more actions to perform.", "warn");
                    // Optionally pause or just stay on this node
                    return;
                } else {
                    addLog("Execution terminal state reached.", "info");
                    return;
                }
                setActiveNodeId(currentNodeId);
                return;
            }

            let nextNodeId: string | null = null;

            if (currentNode.type === 'loop' && currentNode.loopInfo) {
                const info = currentNode.loopInfo;
                const currentVal = valuesRef.current[info.variable] ?? info.start;

                // EVALUATE TERMINATION: x < 9
                // (Note: Parser currently extracts end value, we simulate the comparison)
                // We show the value reaching the end limit to show the ENGINEER why it exits
                const shouldContinue = info.step > 0 ? currentVal < info.end : currentVal > info.end;

                if (shouldContinue) {
                    // Stay in loop
                    const trueEdge = outgoingEdges.find(e => e.label === 'True' || !e.label);
                    nextNodeId = trueEdge?.to || outgoingEdges[0].to;

                    // Update refs for logic
                    const newVal = currentVal + info.step;
                    valuesRef.current[info.variable] = newVal;
                    iterationsRef.current[currentNode.id] = (iterationsRef.current[currentNode.id] ?? 0) + 1;

                    // Sync to state for display
                    setSimulatedValues({ ...valuesRef.current });
                } else {
                    // Exit loop
                    addLog(`Loop condition [${info.variable} < ${info.end}] is FALSE. Exiting loop.`, "info");

                    // Engineering Rule: Now that the loop is TRULY finished, grey out all its contents
                    nodes.forEach(n => {
                        if (n.parentLoopId === currentNode.id) {
                            finishedRef.current.add(n.id);
                        }
                    });
                    finishedRef.current.add(currentNode.id);
                    setFinishedNodeIds(new Set(finishedRef.current));

                    const exitEdge = outgoingEdges.find(e => e.label === 'False' || (outgoingEdges.length > 1 && e.to !== outgoingEdges[0].to));
                    nextNodeId = exitEdge?.to || outgoingEdges[outgoingEdges.length - 1].to;

                    // Reset current loop iteration count for next pass
                    iterationsRef.current[currentNode.id] = 0;
                }
            } else if (currentNode.type === 'decision') {
                // DETERMINISTIC DECISION: e.g. x % 2 == 0
                const condition = currentNode.label.replace(/\s/g, '');
                let result = true;

                // Simple parser for common engineering patterns
                const modMatch = condition.match(/(\w+)%(\d+)==(\d+)/);
                if (modMatch) {
                    const varName = modMatch[1];
                    const divisor = parseInt(modMatch[2]);
                    const expected = parseInt(modMatch[3]);
                    const currentVal = valuesRef.current[varName] ?? 0;
                    result = (currentVal % divisor) === expected;
                    addLog(`Evaluating ${varName}(${currentVal}) % ${divisor} == ${expected} -> ${result}`, "info");
                } else {
                    // Fallback to toggle to show path exists
                    const currentIter = iterationsRef.current[currentNode.id] ?? 0;
                    result = currentIter % 2 === 0;
                }

                if (result) {
                    const yesEdge = outgoingEdges.find(e => e.label === 'Yes' || e.label === 'True');
                    nextNodeId = yesEdge?.to || outgoingEdges[0].to;
                } else {
                    const noEdge = outgoingEdges.find(e => e.label === 'No' || e.label === 'False');
                    nextNodeId = noEdge?.to || outgoingEdges[outgoingEdges.length - 1].to;
                }

                iterationsRef.current[currentNode.id] = (iterationsRef.current[currentNode.id] ?? 0) + 1;
            } else {
                // Sequential logic nodes (Process, Start, End)
                const label = currentNode.label.replace(/\s/g, '');

                // match simple assignment: x=5 or int x=5
                const assignMatch = label.match(/([a-zA-Z_]\w*)=(.+)/);
                if (assignMatch && !label.includes('==')) {
                    const varName = assignMatch[1];
                    let rawVal = assignMatch[2].replace(';', '');

                    // Simple evaluation (handles literals and basic addition/subtraction)
                    let finalVal = 0;
                    if (rawVal.includes('+')) {
                        const parts = rawVal.split('+');
                        const v1 = valuesRef.current[parts[0]] ?? parseInt(parts[0]);
                        const v2 = valuesRef.current[parts[1]] ?? parseInt(parts[1]);
                        finalVal = (isNaN(Number(v1)) ? 0 : Number(v1)) + (isNaN(Number(v2)) ? 0 : Number(v2));
                    } else if (rawVal.includes('-')) {
                        const parts = rawVal.split('-');
                        const v1 = valuesRef.current[parts[0]] ?? parseInt(parts[0]);
                        const v2 = valuesRef.current[parts[1]] ?? parseInt(parts[1]);
                        finalVal = (isNaN(Number(v1)) ? 0 : Number(v1)) - (isNaN(Number(v2)) ? 0 : Number(v2));
                    } else {
                        finalVal = Number(valuesRef.current[rawVal] ?? parseInt(rawVal));
                        if (isNaN(finalVal)) finalVal = 0;
                    }

                    valuesRef.current[varName] = finalVal;
                    setSimulatedValues({ ...valuesRef.current });
                }

                // match increment/decrement: a++, a--
                const incMatch = label.match(/([a-zA-Z_]\w*)(\+\+|--)/);
                if (incMatch) {
                    const varName = incMatch[1];
                    const op = incMatch[2];
                    const currentVal = valuesRef.current[varName] ?? 0;
                    valuesRef.current[varName] = op === '++' ? currentVal + 1 : currentVal - 1;
                    setSimulatedValues({ ...valuesRef.current });
                }

                // LOG PRINT STATEMENTS
                if (currentNode.label.toLowerCase().includes("serial.print")) {
                    const msg = currentNode.label.match(/"([^"]+)"/)?.[1] || "Data printed";
                    addLog(`Serial Output: ${msg}`, 'success');
                }

                // Sequential flow: Go to the first outgoing edge
                nextNodeId = outgoingEdges[0]?.to || null;
            }

            if (nextNodeId) {
                currentNodeId = nextNodeId;
                setActiveNodeId(nextNodeId);
            }
        };

        const interval = setInterval(runStep, 800);

        return () => {
            clearInterval(interval);
        };
    }, [isPlaying, nodes, edges]);

    const togglePlay = () => setIsPlaying(!isPlaying);

    // Get node shape based on type
    const getNodeShape = (node: FlowNode, isActive: boolean) => {
        const isFinished = finishedNodeIds.has(node.id) && !isActive;
        const fill = isActive ? "#eff6ff" : (isFinished ? "#f3f4f6" : "white");
        const stroke = isActive ? "#3b82f6" : (isFinished ? "#d1d5db" : "#e5e7eb");
        const strokeWidth = isActive ? 2 : 1;
        const opacity = isFinished ? 0.6 : 1;

        switch (node.type) {
            case 'start':
            case 'end':
                return (
                    <ellipse
                        cx="60"
                        cy="20"
                        rx="55"
                        ry="18"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        style={{ opacity }}
                    />
                );
            case 'decision':
                return (
                    <polygon
                        points="60,0 120,20 60,40 0,20"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        style={{ opacity }}
                    />
                );
            case 'loop':
                return (
                    <rect
                        width="120"
                        height="40"
                        rx="20"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        style={{ opacity }}
                    />
                );
            default:
                return (
                    <rect
                        width="120"
                        height="40"
                        rx="4"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        style={{ opacity }}
                    />
                );
        }
    };

    // Helper to generate 90-degree orthogonal path
    const getOrthogonalPath = (fromX: number, fromY: number, toX: number, toY: number, isLoopBack: boolean, depth: number, fromNodeX: number) => {
        if (isLoopBack) {
            // Loop back path: Exit bottom, go right, go up, go left, enter top
            const offset = 80 + depth * 30; // Further out to avoid body
            const bendY = fromY + 20;
            const upY = toY - 30;

            return `M ${fromX} ${fromY} 
                    V ${bendY} 
                    H ${fromNodeX + 120 + offset} 
                    V ${upY} 
                    H ${toX} 
                    V ${toY}`;
        }

        if (Math.abs(fromX - toX) < 5) {
            // Straight vertical
            return `M ${fromX} ${fromY} L ${toX} ${toY}`;
        }

        // Stepped path: Halfway down, sideways, then rest of way down
        const midY = (fromY + toY) / 2;
        return `M ${fromX} ${fromY} 
                V ${midY} 
                H ${toX} 
                V ${toY}`;
    };

    // Empty state
    if (nodes.length === 0) {
        return (
            <div className="flow-map-container">
                <div className="flow-map-empty">
                    <div className="empty-icon">📊</div>
                    <h3>No Flow to Display</h3>
                    <p>Write some code in the editor to see the flow diagram.</p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`flow-map-container ${isPanning ? 'panning' : ''}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >


            <svg
                ref={svgRef}
                className="flow-map-svg"
                width="100%"
                height="100%"
                viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                        </marker>
                        <marker id="arrowhead-active" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                    </defs>

                    {/* Edges */}
                    {edges.map(edge => {
                        const fromNode = nodes.find(n => n.id === edge.from);
                        const toNode = nodes.find(n => n.id === edge.to);
                        if (!fromNode || !toNode) return null;

                        // Calculate path
                        const fromX = fromNode.x + 60;
                        const fromY = fromNode.y + 40;
                        const toX = toNode.x + 60;
                        const toY = toNode.y;

                        // Check if it's a loop-back edge (going up)
                        const isLoopBack = toY < fromY;
                        const d = getOrthogonalPath(fromX, fromY, toX, toY, isLoopBack, fromNode.depth, fromNode.x);

                        const isActive = activeNodeId === edge.from;

                        return (
                            <g key={edge.id}>
                                <path
                                    d={d}
                                    stroke="#e5e7eb"
                                    strokeWidth="2"
                                    fill="none"
                                    markerEnd="url(#arrowhead)"
                                />
                                {/* Animated path when active */}
                                {isActive && (
                                    <motion.path
                                        d={d}
                                        stroke="#3b82f6"
                                        strokeWidth="2"
                                        fill="none"
                                        markerEnd="url(#arrowhead-active)"
                                        initial={{ pathLength: 0, opacity: 0 }}
                                        animate={{ pathLength: 1, opacity: 1 }}
                                        transition={{ duration: 0.8, ease: "easeInOut" }}
                                    />
                                )}
                                {/* Edge label */}
                                {edge.label && (
                                    <text
                                        x={(fromX + toX) / 2 + 10}
                                        y={(fromY + toY) / 2}
                                        fontSize="10"
                                        fill="#6b7280"
                                    >
                                        {edge.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {nodes.map(node => {
                        const isActive = activeNodeId === node.id;

                        return (
                            <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                                <motion.g
                                    animate={{
                                        scale: isActive ? 1.02 : 1
                                    }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {getNodeShape(node, isActive)}
                                    <text
                                        x="60"
                                        y="25"
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill={isActive ? "#1d4ed8" : (finishedNodeIds.has(node.id) ? "#9ca3af" : "#374151")}
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {node.label.length > 18 ? node.label.substring(0, 15) + '...' : node.label}
                                    </text>
                                    {node.loopInfo && simulatedValues[node.loopInfo.variable] !== undefined && (
                                        <motion.text
                                            initial={{ opacity: 0, y: 35 }}
                                            animate={{ opacity: 1, y: 45 }}
                                            x="60"
                                            textAnchor="middle"
                                            fontSize="10"
                                            fontWeight="bold"
                                            fill="#ef4444"
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            {node.loopInfo.variable} = {simulatedValues[node.loopInfo.variable]}
                                        </motion.text>
                                    )}
                                </motion.g>
                            </g>
                        );
                    })}
                </g>
            </svg>





            <div className="flow-legend">
                <div className="legend-item">
                    <span className="dot active"></span> Running
                </div>
                <div className="legend-item">
                    <span className="dot"></span> Waiting
                </div>
            </div>

            {/* Info Panel Overhaul */}
            <motion.div
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                dragElastic={0.2}
                dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className={`flow-info-panel ${showInfoPanel ? 'open' : 'closed'}`}
                style={{
                    bottom: '24px',
                    right: '24px'
                }}
            >
                <div className="info-panel-header">
                    <div className="header-controls">
                        <button
                            className={`flow-control-btn play-btn ${isPlaying ? 'playing' : ''}`}
                            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                            title={isPlaying ? "Pause Flow" : "Play Flow"}
                        >
                            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        </button>
                        <button
                            className="flow-control-btn"
                            onClick={handleManualRefresh}
                            title="Reset Simulation & Re-trace Code"
                        >
                            <RefreshCw size={14} />
                        </button>
                        <div className="control-group">
                            <button className="flow-control-btn" onClick={(e) => { e.stopPropagation(); handleZoomIn(); }} title="Zoom In">
                                <ZoomIn size={14} />
                            </button>
                            <button className="flow-control-btn" onClick={(e) => { e.stopPropagation(); handleZoomOut(); }} title="Zoom Out">
                                <ZoomOut size={14} />
                            </button>
                            <button className="flow-control-btn" onClick={(e) => { e.stopPropagation(); handleResetZoom(); }} title="Reset View">
                                <Maximize size={14} />
                            </button>
                        </div>
                        <div className="flow-zoom-level">
                            {Math.round(zoom * 100)}%
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="minimize-btn" onClick={(e) => {
                            e.stopPropagation();
                            setShowInfoPanel(!showInfoPanel);
                        }}>
                            {showInfoPanel ? '−' : '+'}
                        </button>
                    </div>
                </div>

                {showInfoPanel && (
                    <div className="info-panel-content">
                        {/* Tabs */}
                        <div className="info-tabs">
                            <button
                                className={`info-tab ${activeTab === 'vars' ? 'active' : ''}`}
                                onClick={() => setActiveTab('vars')}
                            >
                                Variables
                            </button>
                            <button
                                className={`info-tab ${activeTab === 'arrays' ? 'active' : ''}`}
                                onClick={() => setActiveTab('arrays')}
                            >
                                Arrays
                            </button>
                            <button
                                className={`info-tab ${activeTab === 'logs' ? 'active' : ''}`}
                                onClick={() => setActiveTab('logs')}
                            >
                                Console Logs
                            </button>
                        </div>

                        {/* Variables Tab */}
                        {activeTab === 'vars' && (
                            <div className="tab-pane">
                                <div className="var-selector">
                                    <div className="small-label">SELECT VARIABLES TO MONITOR</div>
                                    {availableVariables.length === 0 ? (
                                        <div className="empty-state-mini">No variables detected in program</div>
                                    ) : (
                                        <div className="pill-row">
                                            {availableVariables.map(v => (
                                                <button
                                                    key={v}
                                                    className={`ux-pill ${trackedVariables.includes(v) ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        if (trackedVariables.includes(v)) {
                                                            setTrackedVariables(trackedVariables.filter(t => t !== v));
                                                        } else {
                                                            setTrackedVariables([...trackedVariables, v]);
                                                        }
                                                    }}
                                                >
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="active-monitor-grid">
                                    {trackedVariables.map(v => (
                                        <div key={v} className="monitor-card">
                                            <div className="monitor-name">{v}</div>
                                            <motion.div
                                                key={simulatedValues[v]}
                                                initial={{ scale: 1.2, color: '#3b82f6' }}
                                                animate={{ scale: 1, color: '#1f2937' }}
                                                className="monitor-value"
                                            >
                                                {simulatedValues[v] ?? '0'}
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Arrays Tab */}
                        {activeTab === 'arrays' && (
                            <div className="tab-pane">
                                {Object.keys(initialArrays).length === 0 ? (
                                    <div className="empty-state">No arrays detected in program</div>
                                ) : (
                                    <div className="array-visualization-list">
                                        {Object.entries(initialArrays).map(([name, vals]) => (
                                            <div key={name} className="array-viz-item">
                                                <div className="array-label">{name}[{(vals as any[]).length}]</div>
                                                <div className="array-blocks">
                                                    {(vals as any[]).map((v, idx) => (
                                                        <div key={idx} className="array-block">
                                                            <div className="block-index">{idx}</div>
                                                            <div className="block-val">{v}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Logs Tab */}
                        {activeTab === 'logs' && (
                            <div className="tab-pane logs-pane">
                                {programLogs.length === 0 ? (
                                    <div className="empty-state">Execution log is empty. Press Play to start.</div>
                                ) : (
                                    programLogs.map((log, i) => (
                                        <div key={i} className={`log-entry ${log.type}`}>
                                            <span className="log-msg">{log.msg}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default FlowMap;


