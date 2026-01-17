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
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<FileItem[]>([]);
    const [isAdminModeRequested, setIsAdminModeRequested] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
            setQuery('');
            setResults([]);
            setIsAdminModeRequested(false);
        }
    }, [isOpen]);

    const handleSearch = async (val: string) => {
        setQuery(val);
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
            // In a real app, this might be a dedicated search API or a filtered file list
            const response = await fetch('http://localhost:3001/api/files');
            const data = await response.json();
            if (data.success) {
                const allFiles: FileItem[] = [];
                const flatten = (items: any[]) => {
                    items.forEach(item => {
                        if (item.type === 'file') {
                            allFiles.push({
                                id: item.id,
                                name: item.name,
                                type: 'file',
                                path: item.id
                            });
                        }
                        if (item.children) {
                            flatten(item.children);
                        }
                    });
                };
                flatten(data.files);

                const filtered = allFiles.filter(f =>
                    f.name.toLowerCase().includes(val.toLowerCase())
                ).slice(0, 10);
                setResults(filtered);
            }
        } catch (error) {
            console.error('Failed to search files:', error);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
        if (e.key === 'Enter' && isAdminModeRequested) {
            // Trigger admin mode - we'll handle this in IDELayout or a global way if needed
            // For now, let's just log it or use an event
            window.dispatchEvent(new CustomEvent('open-admin-mode'));
            onClose();
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
                            results.map(file => (
                                <div key={file.id} className="search-result-item" onClick={() => {
                                    // Handle file selection - would need to navigate to project + file
                                    console.log('Selected file:', file);
                                    onClose();
                                }}>
                                    <File size={16} className="file-icon" />
                                    <div className="file-info">
                                        <span className="file-name">{file.name}</span>
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
