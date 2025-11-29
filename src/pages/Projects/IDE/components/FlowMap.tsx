import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import './FlowMap.css';

interface Node {
    id: string;
    label: string;
    type: 'start' | 'process' | 'decision' | 'end';
    x: number;
    y: number;
}

interface Edge {
    id: string;
    from: string;
    to: string;
}

const MOCK_NODES: Node[] = [
    { id: '1', label: 'Setup()', type: 'start', x: 150, y: 50 },
    { id: '2', label: 'Initialize Serial', type: 'process', x: 150, y: 150 },
    { id: '3', label: 'Loop()', type: 'process', x: 150, y: 250 },
    { id: '4', label: 'Read Sensor', type: 'process', x: 150, y: 350 },
    { id: '5', label: 'Value > 500?', type: 'decision', x: 150, y: 450 },
    { id: '6', label: 'LED ON', type: 'process', x: 50, y: 550 },
    { id: '7', label: 'LED OFF', type: 'process', x: 250, y: 550 },
];

const MOCK_EDGES: Edge[] = [
    { id: 'e1', from: '1', to: '2' },
    { id: 'e2', from: '2', to: '3' },
    { id: 'e3', from: '3', to: '4' },
    { id: 'e4', from: '4', to: '5' },
    { id: 'e5', from: '5', to: '6' },
    { id: 'e6', from: '5', to: '7' },
    { id: 'e7', from: '6', to: '3' }, // Loop back
    { id: 'e8', from: '7', to: '3' }, // Loop back
];

const FlowMap: React.FC = () => {
    const [activeNodeId, setActiveNodeId] = useState<string>('1');

    useEffect(() => {
        // Simulate execution flow
        const sequence = ['1', '2', '3', '4', '5', '6', '3', '4', '5', '7', '3'];
        let i = 0;
        const interval = setInterval(() => {
            setActiveNodeId(sequence[i % sequence.length]);
            i++;
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flow-map-container">
            <svg className="flow-map-svg" width="100%" height="100%" viewBox="0 0 400 700">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
                    </marker>
                </defs>

                {/* Edges */}
                {MOCK_EDGES.map(edge => {
                    const fromNode = MOCK_NODES.find(n => n.id === edge.from);
                    const toNode = MOCK_NODES.find(n => n.id === edge.to);
                    if (!fromNode || !toNode) return null;

                    // Simple straight lines for now, specialized logic for loops would be needed for curves
                    let d = `M ${fromNode.x + 50} ${fromNode.y + 40} L ${toNode.x + 50} ${toNode.y}`;

                    // Custom path for loop back
                    if (edge.to === '3' && (edge.from === '6' || edge.from === '7')) {
                        const offset = edge.from === '6' ? -60 : 60;
                        d = `M ${fromNode.x + 50} ${fromNode.y + 40} C ${fromNode.x + 50 + offset} ${fromNode.y + 80}, ${toNode.x + 50 + offset} ${toNode.y + 40}, ${toNode.x + 50} ${toNode.y + 40}`;
                    }

                    return (
                        <g key={edge.id}>
                            <path
                                d={d}
                                stroke="#e5e7eb"
                                strokeWidth="2"
                                fill="none"
                                markerEnd="url(#arrowhead)"
                            />
                            {/* Glowing Path Animation */}
                            {(activeNodeId === edge.from) && (
                                <motion.path
                                    d={d}
                                    stroke="#3b82f6"
                                    strokeWidth="2"
                                    fill="none"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 1 }}
                                    transition={{ duration: 0.8, ease: "easeInOut" }}
                                />
                            )}
                        </g>
                    );
                })}

                {/* Nodes */}
                {MOCK_NODES.map(node => (
                    <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                        <motion.rect
                            width="100"
                            height="40"
                            rx="8"
                            fill={activeNodeId === node.id ? "#eff6ff" : "white"}
                            stroke={activeNodeId === node.id ? "#3b82f6" : "#e5e7eb"}
                            strokeWidth={activeNodeId === node.id ? "2" : "1"}
                            animate={{
                                boxShadow: activeNodeId === node.id ? "0 0 15px rgba(59, 130, 246, 0.5)" : "none"
                            }}
                        />
                        <text
                            x="50"
                            y="25"
                            textAnchor="middle"
                            fontSize="12"
                            fill={activeNodeId === node.id ? "#1d4ed8" : "#374151"}
                            style={{ pointerEvents: 'none' }}
                        >
                            {node.label}
                        </text>
                    </g>
                ))}
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
