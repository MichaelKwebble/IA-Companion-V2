import React, { useState } from 'react';
import { Folder, FileCode, ChevronRight, ChevronDown } from 'lucide-react';
import './FileExplorer.css';

interface FileNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
}

const MOCK_FILES: FileNode[] = [
    {
        id: 'root',
        name: 'src',
        type: 'folder',
        children: [
            { id: '1', name: 'main.cpp', type: 'file' },
            { id: '2', name: 'utils.h', type: 'file' },
            { id: '3', name: 'utils.cpp', type: 'file' },
        ]
    },
    { id: '4', name: 'README.md', type: 'file' },
    { id: '5', name: 'library.properties', type: 'file' },
];

const FileItem: React.FC<{ node: FileNode; depth: number }> = ({ node, depth }) => {
    const [isOpen, setIsOpen] = useState(true);

    const handleToggle = () => {
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        }
    };

    return (
        <>
            <div
                className="explorer-item"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={handleToggle}
            >
                <span className="file-icon">
                    {node.type === 'folder' && (
                        isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </span>
                <span className="file-icon-type">
                    {node.type === 'folder' ? <Folder size={14} /> : <FileCode size={14} />}
                </span>
                <span className="file-name">{node.name}</span>
            </div>
            {node.type === 'folder' && isOpen && node.children && (
                <>
                    {node.children.map(child => (
                        <FileItem key={child.id} node={child} depth={depth + 1} />
                    ))}
                </>
            )}
        </>
    );
};

const FileExplorer: React.FC = () => {
    return (
        <div className="file-explorer">
            <div className="explorer-header">
                <span>PROJECT FILES</span>
            </div>
            <div className="explorer-content">
                {MOCK_FILES.map(node => (
                    <FileItem key={node.id} node={node} depth={0} />
                ))}
            </div>
        </div>
    );
};

export default FileExplorer;
