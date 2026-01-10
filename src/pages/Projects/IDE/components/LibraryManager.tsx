import React, { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, Trash2, FileArchive, CheckCircle2, AlertCircle, Loader2, BookOpen, ChevronDown, ChevronRight } from 'lucide-react';
import { useDevice } from '../../../../context/DeviceContext';
import './Managers.css';

interface Library {
    name: string;
    author: string;
    description: string;
    version: string;
    latest_version?: string;
    installed_version?: string;
    category?: string;
    website?: string;
}

interface LibraryManagerProps {
    onOpenExample?: (library: string, example: string) => void;
}

const LibraryManager: React.FC<LibraryManagerProps> = ({ onOpenExample }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [libraries, setLibraries] = useState<Library[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [filter, setFilter] = useState<'all' | 'installed' | 'updatable'>('all');
    const [isLimited, setIsLimited] = useState(false);
    const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
    const [expandedExamples, setExpandedExamples] = useState<string | null>(null);
    const [libExamples, setLibExamples] = useState<Record<string, string[]>>({});
    const [loadingExamples, setLoadingExamples] = useState<string | null>(null);
    const { arduinoStatus } = useDevice();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchLibraries = async (query = '') => {
        setIsLoading(true);
        try {
            const endpoint = query ? `search?query=${encodeURIComponent(query)}` : (filter === 'all' ? 'search' : `list${filter === 'updatable' ? '?updatable=true' : ''}`);
            const response = await fetch(`http://localhost:3001/api/arduino/libraries/${endpoint}`);
            const data = await response.json();

            if (data.success) {
                let results = [];
                if (data.data.libraries) {
                    // Search results
                    results = data.data.libraries.map((lib: any) => ({
                        name: lib.name,
                        author: lib.latest.author,
                        description: lib.latest.sentence,
                        version: lib.latest.version,
                        latest_version: lib.latest.version,
                        category: lib.latest.category,
                        website: lib.latest.website
                    }));
                    setIsLimited(data.data.libraries.length >= 100);
                } else if (data.data.installed_libraries) {
                    // List results
                    results = data.data.installed_libraries.map((item: any) => ({
                        name: item.library.name,
                        author: item.library.author,
                        description: item.library.sentence,
                        version: item.library.version,
                        latest_version: item.release?.version || item.library.version,
                        installed_version: item.library.version,
                        category: item.library.category,
                        website: item.library.website
                    }));
                }

                // Fetch installed libraries to merge status if we are searching or showing all
                if (query || filter === 'all') {
                    const installedRes = await fetch('http://localhost:3001/api/arduino/libraries/list');
                    const installedData = await installedRes.json();
                    if (installedData.success) {
                        const installed = installedData.data.installed_libraries || [];
                        const installedMap = new Map(installed.map((item: any) => [item.library.name, item.library.version]));

                        setLibraries(results.map((lib: any) => ({
                            ...lib,
                            installed_version: installedMap.get(lib.name)
                        })));
                    } else {
                        setLibraries(results);
                    }
                } else {
                    setLibraries(results);
                }
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

    useEffect(() => {
        if (arduinoStatus && (arduinoStatus.status === 'success' || arduinoStatus.status === 'error')) {
            setInstallingIds(prev => {
                const next = new Set(prev);
                if (arduinoStatus.id) next.delete(arduinoStatus.id);
                return next;
            });
            // Refresh list on success
            if (arduinoStatus.status === 'success') {
                fetchLibraries(searchQuery);
            }
        }
    }, [arduinoStatus]);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetch('http://localhost:3001/api/arduino/libraries/index/update', { method: 'POST' });
            await fetchLibraries(searchQuery);
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleInstall = async (name: string, version?: string) => {
        setInstallingIds(prev => new Set(prev).add(name));
        try {
            const response = await fetch('http://localhost:3001/api/arduino/libraries/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, version })
            });
            const data = await response.json();
            if (!data.success) {
                setInstallingIds(prev => {
                    const next = new Set(prev);
                    next.delete(name);
                    return next;
                });
            }
        } catch (error) {
            console.error('Install failed:', error);
            setInstallingIds(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
        }
    };

    const handleUninstall = async (name: string) => {
        if (!confirm(`Are you sure you want to uninstall ${name}?`)) return;
        setInstallingIds(prev => new Set(prev).add(name));
        try {
            const response = await fetch('http://localhost:3001/api/arduino/libraries/uninstall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            if (!data.success) {
                setInstallingIds(prev => {
                    const next = new Set(prev);
                    next.delete(name);
                    return next;
                });
            }
        } catch (error) {
            console.error('Uninstall failed:', error);
            setInstallingIds(prev => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
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
                alert('Library installed successfully from ZIP!');
                fetchLibraries(searchQuery);
            } else {
                alert('Failed to install library: ' + data.error);
            }
        } catch (error) {
            console.error('ZIP upload failed:', error);
            alert('Failed to upload ZIP file');
        }
    };

    const handleFetchExamples = async (libName: string) => {
        if (expandedExamples === libName) {
            setExpandedExamples(null);
            return;
        }

        if (libExamples[libName]) {
            setExpandedExamples(libName);
            return;
        }

        setLoadingExamples(libName);
        try {
            const response = await fetch(`http://localhost:3001/api/arduino/libraries/examples`);
            const data = await response.json();
            if (data.success) {
                const lib = data.data.find((l: any) => l.library === libName);
                if (lib) {
                    setLibExamples(prev => ({ ...prev, [libName]: lib.examples }));
                    setExpandedExamples(libName);
                } else {
                    alert('No examples found for this library.');
                }
            }
        } catch (error) {
            console.error('Failed to fetch examples:', error);
        } finally {
            setLoadingExamples(null);
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
                    <Search size={18} className="arduino-search-icon" />
                    <input
                        type="text"
                        placeholder="Search libraries..."
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
                        <RefreshCw size={16} className={isRefreshing ? 'arduino-animate-spin' : ''} />
                        Refresh
                    </button>
                    <button className="arduino-action-btn" onClick={() => fileInputRef.current?.click()}>
                        <FileArchive size={16} />
                        Install ZIP
                    </button>
                    <button className="arduino-action-btn" onClick={async () => {
                        if (confirm('Are you sure you want to clear the unused download cache? This will remove cached ZIP files for libraries that are NOT currently installed.')) {
                            try {
                                const response = await fetch('http://localhost:3001/api/arduino/cache/clear', { method: 'POST' });
                                const data = await response.json();
                                alert(`Cache cleared successfully! Removed ${data.removedCount || 0} unused items.`);
                            } catch (e) {
                                alert('Failed to clear cache');
                            }
                        }
                    }}>
                        <Trash2 size={16} />
                        Clear Unused Cache
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
                        <RefreshCw size={24} className="arduino-animate-spin" />
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
                                    {installingIds.has(lib.name) ? (
                                        <div className="arduino-installing-state">
                                            <Loader2 size={16} className="arduino-animate-spin" />
                                            <span>Processing...</span>
                                        </div>
                                    ) : lib.installed_version ? (
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
                                                <button className="arduino-btn-examples" onClick={() => handleFetchExamples(lib.name)}>
                                                    {loadingExamples === lib.name ? <Loader2 size={14} className="arduino-animate-spin" /> : expandedExamples === lib.name ? <ChevronDown size={14} /> : <BookOpen size={14} />}
                                                    Examples
                                                </button>
                                                <button className="arduino-btn-remove" onClick={() => handleUninstall(lib.name)}>
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button className="arduino-btn-install" onClick={() => handleInstall(lib.name)}>
                                            Install
                                        </button>
                                    )}
                                </div>
                                {expandedExamples === lib.name && libExamples[lib.name] && (
                                    <div className="arduino-item-examples-list">
                                        {libExamples[lib.name].map(ex => (
                                            <div key={ex} className="arduino-example-row" onClick={() => onOpenExample?.(lib.name, ex)}>
                                                <BookOpen size={12} />
                                                <span>{ex}</span>
                                                <ChevronRight size={12} className="arrow" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
};

export default LibraryManager;
