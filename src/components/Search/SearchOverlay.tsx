import React, { useState, useEffect, useRef } from 'react';
import { Search, File, X, ShieldAlert } from 'lucide-react';
import './SearchOverlay.css';

interface SearchOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FileItem {
    id: string;
    name: string;
    type: 'file' | 'folder';
    path: string;
    projectName?: string;
    projectId?: string;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FileItem[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isAdminModeRequested, setIsAdminModeRequested] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery('');
            setResults([]);
            setSelectedIndex(0);
            setIsAdminModeRequested(false);
        }
    }, [isOpen]);

    const handleSearch = async (val: string) => {
        setQuery(val);
        setSelectedIndex(0);
        if (val.toLowerCase() === 'adminmode') {
            setIsAdminModeRequested(true);
            return;
        } else {
            setIsAdminModeRequested(false);
        }

        if (val.length < 1) {
            setResults([]);
            return;
        }

        try {
            // Fetch from global search endpoint
            const response = await fetch('http://localhost:3001/api/search/global');
            const data = await response.json();
            if (data.success) {
                // Filter matches by name across all files in all projects
                const filtered = data.files.filter((f: FileItem) =>
                    f.name.toLowerCase().includes(val.toLowerCase())
                ).slice(0, 50); // Show more results
                setResults(filtered);
            }
        } catch (error) {
            console.error('Failed to search files:', error);
        }
    };

    const handleFileOpen = (file: FileItem) => {
        console.log('[SearchOverlay] Dispatching open-file event for:', file.path, 'in project:', file.projectId);
        window.dispatchEvent(new CustomEvent('open-file', {
            detail: {
                path: file.path,
                projectId: file.projectId
            }
        }));
        console.log('[SearchOverlay] Calling onClose');
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % (results.length || 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + (results.length || 1)) % (results.length || 1));
        }

        if (e.key === 'Enter') {
            if (isAdminModeRequested) {
                window.dispatchEvent(new CustomEvent('open-admin-mode'));
                onClose();
            } else if (results.length > 0) {
                handleFileOpen(results[selectedIndex]);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="search-overlay-container" onClick={onClose}>
            <div className="search-modal" onClick={e => e.stopPropagation()}>
                <div className="search-input-wrapper">
                    <Search className="search-icon" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search files or type magic code..."
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button className="close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="search-results">
                    {isAdminModeRequested ? (
                        <div className="admin-magic-link" onClick={() => {
                            window.dispatchEvent(new CustomEvent('open-admin-mode'));
                            onClose();
                        }}>
                            <ShieldAlert size={24} className="admin-icon" />
                            <div className="admin-text">
                                <span className="title">Secret Admin Mode Detected</span>
                                <span className="subtitle">Press Enter or Click to Enter Backend Manager</span>
                            </div>
                        </div>
                    ) : (
                        results.length > 0 ? (
                            results.map((file, index) => (
                                <div
                                    key={file.id}
                                    className={`search-result-item ${index === selectedIndex ? 'selected' : ''}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        console.log('[SearchOverlay] Click on file:', file.name);
                                        handleFileOpen(file);
                                    }}
                                >
                                    <File size={16} className="file-icon" />
                                    <div className="file-info">
                                        <div className="file-name-row">
                                            <span className="file-name">{file.name}</span>
                                            {file.projectName && <span className="project-tag">{file.projectName}</span>}
                                        </div>
                                        <span className="file-path">{file.path}</span>
                                    </div>
                                </div>
                            ))
                        ) : query && (
                            <div className="no-results">No matching files found</div>
                        )
                    )}
                </div>

                <div className="search-footer">
                    <span>↑↓ to navigate</span>
                    <span>↵ to open</span>
                    <span>esc to close</span>
                </div>
            </div>
        </div>
    );
};

export default SearchOverlay;
