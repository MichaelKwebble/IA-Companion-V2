import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Trash2, Download, CheckCircle2, AlertCircle, FileArchive } from 'lucide-react';
import './Managers.css';


interface Library {
    name: string;
    author: string;
    description: string;
    installed_version?: string;
    latest_version?: string;
    versions?: string[];
    website?: string;
    category?: string;
}

const LibraryManager: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'installed' | 'updatable'>('all');
    const [isLimited, setIsLimited] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchLibraries = async (query = '') => {
        setIsLoading(true);
        try {
            // If no query and filter is 'all', use search with empty query to get all libraries
            // Otherwise use 'list' for installed libraries if no query
            const endpoint = query ? `search?query=${encodeURIComponent(query)}` : (filter === 'all' ? 'search' : 'list');
            const response = await fetch(`http://localhost:3001/api/arduino/libraries/${endpoint}`);
            const data = await response.json();
            if (data.success) {
                setIsLimited(!!data.data.limited);
                const results = data.data.libraries || (Array.isArray(data.data) ? data.data : []);
                setLibraries(results.map((l: any) => {
                    // Normalize search vs list format
                    const libData = l.library || l.latest || l;
                    return {
                        name: l.name || libData.name,
                        author: libData.author,
                        description: libData.sentence || libData.description,
                        installed_version: l.library ? libData.version : l.installed,
                        latest_version: l.release ? l.release.version : (l.latest ? l.latest.version : l.latest),
                        versions: libData.versions || l.available_versions,
                        website: libData.website,
                        category: libData.category
                    };
                }));
            }
        } catch (error) {
            console.error('Failed to fetch libraries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLibraries(searchQuery);
    }, [filter]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetch('http://localhost:3001/api/arduino/libraries/update-index', { method: 'POST' });
            await fetchLibraries(searchQuery);
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleInstall = async (name: string, version?: string) => {
        try {
            await fetch('http://localhost:3001/api/arduino/libraries/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, version })
            });
        } catch (error) {
            console.error('Install failed:', error);
        }
    };

    const handleUninstall = async (name: string) => {
        if (!confirm(`Are you sure you want to uninstall ${name}?`)) return;
        try {
            const response = await fetch('http://localhost:3001/api/arduino/libraries/uninstall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (data.success) {
                fetchLibraries(searchQuery);
            }
        } catch (error) {
            console.error('Uninstall failed:', error);
        }
    };

    const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('http://localhost:3001/api/arduino/libraries/install-zip', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                alert('Library installed from ZIP successfully!');
                fetchLibraries(searchQuery);
            } else {
                alert(`Failed to install ZIP: ${data.error}`);
            }
        } catch (error) {
            console.error('ZIP upload failed:', error);
        }
    };

    const filteredLibraries = libraries.filter(lib => {
        if (filter === 'installed') return !!lib.installed_version;
        if (filter === 'updatable') return lib.installed_version && lib.latest_version && lib.installed_version !== lib.latest_version;
        return true;
    });

    return (
        <div className="arduino-manager-container">
            <div className="arduino-manager-toolbar">
                <div className="arduino-search-box">
                    <Search size={16} className="arduino-search-icon" />
                    <input
                        type="text"
                        placeholder="Search libraries (e.g. ArduinoJson, WiFi)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchLibraries(searchQuery)}
                    />
                </div>
                <div className="arduino-toolbar-actions">
                    <div className="arduino-filter-group">
                        <button
                            className={`arduino-filter-btn ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >All</button>
                        <button
                            className={`arduino-filter-btn ${filter === 'installed' ? 'active' : ''}`}
                            onClick={() => setFilter('installed')}
                        >Installed</button>
                        <button
                            className={`arduino-filter-btn ${filter === 'updatable' ? 'active' : ''}`}
                            onClick={() => setFilter('updatable')}
                        >Updatable</button>
                    </div>
                    <button className="arduino-action-btn" onClick={handleRefresh} disabled={isRefreshing}>
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button className="arduino-action-btn" onClick={() => fileInputRef.current?.click()}>
                        <FileArchive size={16} />
                        Install ZIP
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept=".zip"
                        onChange={handleZipUpload}
                    />
                </div>
            </div>

            <div className="arduino-items-list">
                {isLoading ? (
                    <div className="arduino-loading-state">
                        <RefreshCw size={24} className="animate-spin" />
                        <p>Searching for libraries...</p>
                    </div>
                ) : filteredLibraries.length === 0 ? (
                    <div className="arduino-empty-state">
                        <AlertCircle size={32} />
                        <p>No libraries found matching your criteria.</p>
                    </div>
                ) : (
                    <>
                        {isLimited && (
                            <div className="arduino-info-banner">
                                <AlertCircle size={16} />
                                <p>Showing first 100 libraries. Use search to find specific ones.</p>
                            </div>
                        )}
                        {filteredLibraries.map(lib => (
                            <div key={lib.name} className="arduino-item-card">
                                <div className="arduino-item-info">
                                    <div className="arduino-item-header">
                                        <h3>{lib.name}</h3>
                                        <span className="arduino-author-tag">by {lib.author}</span>
                                    </div>
                                    <p className="arduino-item-description">{lib.description}</p>
                                    <div className="arduino-item-meta-row">
                                        {lib.category && <span className="arduino-category-tag">{lib.category}</span>}
                                        {lib.website && (
                                            <a href={lib.website} target="_blank" rel="noreferrer" className="arduino-website-link">
                                                Website
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="arduino-item-actions">
                                    {lib.installed_version ? (
                                        <div className="arduino-installed-status">
                                            <div className="arduino-status-info">
                                                <CheckCircle2 size={14} className="arduino-success-icon" />
                                                <span>Version {lib.installed_version} installed</span>
                                            </div>
                                            <div className="arduino-btn-group">
                                                {lib.latest_version && lib.latest_version !== lib.installed_version && (
                                                    <button className="arduino-btn-update" onClick={() => handleInstall(lib.name, lib.latest_version)}>
                                                        Update to {lib.latest_version}
                                                    </button>
                                                )}
                                                <button className="arduino-btn-remove" onClick={() => handleUninstall(lib.name)}>
                                                    <Trash2 size={14} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="arduino-btn-install" onClick={() => handleInstall(lib.name)}>
                                            <Download size={14} /> Install
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default LibraryManager;
