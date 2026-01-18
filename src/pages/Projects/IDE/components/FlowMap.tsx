import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import './FlowMap.css';

export interface FlowNode {
    id: string;
    label: string;
    type: 'start' | 'process' | 'decision' | 'end' | 'loop';
    x: number;
    y: number;
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
}

const FlowMap: React.FC<FlowMapProps> = ({ nodes = [], edges = [] }) => {
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

    // Calculate SVG viewBox based on nodes
    const viewBox = useMemo(() => {
        if (nodes.length === 0) return "0 0 400 300";

        const maxX = Math.max(...nodes.map(n => n.x)) + 150;
        const maxY = Math.max(...nodes.map(n => n.y)) + 100;
        return `0 0 ${Math.max(400, maxX)} ${Math.max(300, maxY)}`;
    }, [nodes]);

    // Simulate execution flow animation
    useEffect(() => {
        if (nodes.length === 0) return;

        const nodeIds = nodes.map(n => n.id);
        let i = 0;

        // Start with first node
        setActiveNodeId(nodeIds[0]);

        const interval = setInterval(() => {
            i = (i + 1) % nodeIds.length;
            setActiveNodeId(nodeIds[i]);
        }, 1500);

        return () => clearInterval(interval);
    }, [nodes]);

    // Get node shape based on type
    const getNodeShape = (node: FlowNode, isActive: boolean) => {
        const fill = isActive ? "#eff6ff" : "white";
        const stroke = isActive ? "#3b82f6" : "#e5e7eb";
        const strokeWidth = isActive ? 2 : 1;

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
                    />
                );
            case 'decision':
                return (
                    <polygon
                        points="60,0 120,20 60,40 0,20"
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
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
                    />
                );
        }
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
        <div className="flow-map-container">
            <svg className="flow-map-svg" width="100%" height="100%" viewBox={viewBox}>
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
                    const isLoopBack = toY <= fromY - 40;

                    let d: string;
                    if (isLoopBack) {
                        // Curved path for loop-back
                        const offset = fromX < toX ? -80 : 80;
                        d = `M ${fromX} ${fromY} C ${fromX + offset} ${fromY + 40}, ${toX + offset} ${toY - 20}, ${toX} ${toY}`;
                    } else {
                        // Straight or curved path
                        d = `M ${fromX} ${fromY} L ${toX} ${toY}`;
                    }

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
                                    fill={isActive ? "#1d4ed8" : "#374151"}
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {node.label.length > 18 ? node.label.substring(0, 15) + '...' : node.label}
                                </text>
                            </motion.g>
                        </g>
                    );
                })}
            </svg>

            <div className="flow-legend">
                <div className="legend-item">
                    <span className="dot active"></span> Running
                </div>
                <div className="legend-item">
                    <span className="dot"></span> Waiting
                </div>
            </div>
        </div>
    );
};

export default FlowMap;

