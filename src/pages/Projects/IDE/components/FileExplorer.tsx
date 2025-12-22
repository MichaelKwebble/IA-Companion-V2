import React, { useState } from 'react';
import { Folder, FileCode, ChevronRight, ChevronDown, Plus } from 'lucide-react';
import './FileExplorer.css';

interface FileNode {
    id: string;
    name: string;
    type: 'file' | 'folder';
    children?: FileNode[];
}



const FileItem: React.FC<{ node: FileNode; depth: number; onFileSelect: (path: string) => void }> = ({ node, depth, onFileSelect }) => {
    const [isOpen, setIsOpen] = useState(true);

    const handleToggle = () => {
        if (node.type === 'folder') {
            setIsOpen(!isOpen);
        } else {
            onFileSelect(node.id);
        }
    };

    return (
        <>
            <div
                className={`explorer-item ${node.type === 'file' ? 'is-file' : ''}`}
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
                        <FileItem key={child.id} node={child} depth={depth + 1} onFileSelect={onFileSelect} />
                    ))}
                </>
            )}
        </>
    );
};

interface FileExplorerProps {
    onFileSelect: (path: string) => void;
    onCreateFile?: (name: string) => Promise<void>;
    isCreating?: boolean;
    setIsCreating?: (val: boolean) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, isCreating, setIsCreating }) => {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newFileName, setNewFileName] = useState('');

    const fetchFiles = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/files');
            const data = await response.json();
            if (data.success) {
                setFiles(data.files);
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchFiles();
    }, []);

    const handleAddFile = () => {
        if (setIsCreating) setIsCreating(true);
        setNewFileName('');
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFileName) {
            if (setIsCreating) setIsCreating(false);
            return;
        }

        try {
            const response = await fetch('http://localhost:3001/api/files/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: newFileName, content: '' })
            });
            const data = await response.json();
            if (data.success) {
                if (setIsCreating) setIsCreating(false);
                setNewFileName('');
                await fetchFiles();
            } else {
                alert(`Failed to create file: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to create file:', error);
            alert('Failed to create file');
        }
    };

    const handleCreateCancel = () => {
        if (setIsCreating) setIsCreating(false);
        setNewFileName('');
    };

    if (isLoading) {
        return <div className="file-explorer-loading">Loading files...</div>;
    }

    return (
        <div className="file-explorer">
            <div className="explorer-header">
                <span>PROJECT FILES</span>
                <button className="add-file-btn" onClick={handleAddFile} title="Add File">
                    <Plus size={14} />
                </button>
            </div>
            <div className="explorer-content">
                {isCreating && (
                    <form className="create-file-form" onSubmit={handleCreateSubmit}>
                        <FileCode size={14} className="text-secondary" />
                        <input
                            autoFocus
                            className="create-file-input"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onBlur={handleCreateCancel}
                            placeholder="filename.ino"
                        />
                    </form>
                )}
                {files.map(node => (
                    <FileItem key={node.id} node={node} depth={0} onFileSelect={onFileSelect} />
                ))}
            </div>
        </div>
    );
};

export default FileExplorer;
