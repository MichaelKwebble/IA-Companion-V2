import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Settings, Trash2, Download, CheckCircle2, AlertCircle, ExternalLink, X } from 'lucide-react';
import './Managers.css';


interface BoardPlatform {
    id: string;
    name: string;
    architecture: string;
    vendor: string;
    installed_version?: string;
    latest_version?: string;
    versions?: string[];
    help_url?: string;
}

const BoardsManager: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [platforms, setPlatforms] = useState<BoardPlatform[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [additionalUrls, setAdditionalUrls] = useState<string[]>([]);
    const [newUrl, setNewUrl] = useState('');

    const fetchPlatforms = async (query = '') => {
        setIsLoading(true);
        try {
            const response = await fetch(`http://localhost:3001/api/arduino/boards/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.success) {
                const results = data.data.platforms || (Array.isArray(data.data) ? data.data : []);
                setPlatforms(results.map((p: any) => {
                    const id = p.id || `${p.package}:${p.architecture}`;
                    const parts = id.split(':');
                    const architecture = p.architecture || (parts.length > 1 ? parts[1] : '');

                    // For search results, latest version is the highest in releases
                    // For list results, it's latest_version
                    let latest_version = p.latest_version || p.latest;
                    if (!latest_version && p.releases) {
                        const versions = Object.keys(p.releases).sort((a, b) => {
                            return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
                        });
                        latest_version = versions[0];
                    }

                    return {
                        id,
                        name: p.name || (p.releases && p.releases[latest_version] ? p.releases[latest_version].name : id),
                        architecture,
                        vendor: p.maintainer || p.vendor,
                        installed_version: p.installed_version || p.installed,
                        latest_version,
                        versions: p.versions || (p.releases ? Object.keys(p.releases) : []),
                        help_url: p.help_url || (p.releases && p.releases[latest_version]?.help?.online)
                    };
                }));
            }
        } catch (error) {
            console.error('Failed to fetch boards:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPlatforms();
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await fetch('http://localhost:3001/api/arduino/boards/update-index', { method: 'POST' });
            await fetchPlatforms(searchQuery);
        } catch (error) {
            console.error('Refresh failed:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleInstall = async (id: string, version?: string) => {
        try {
            const response = await fetch('http://localhost:3001/api/arduino/boards/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fqbn: version ? `${id}@${version}` : id })
            });
            const data = await response.json();
            if (data.success) {
                // Status will be updated via WebSocket logs
            }
        } catch (error) {
            console.error('Install failed:', error);
        }
    };

    const handleUninstall = async (id: string) => {
        if (!confirm(`Are you sure you want to uninstall ${id}?`)) return;
        try {
            const response = await fetch('http://localhost:3001/api/arduino/boards/uninstall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fqbn: id })
            });
            const data = await response.json();
            if (data.success) {
                fetchPlatforms(searchQuery);
            }
        } catch (error) {
            console.error('Uninstall failed:', error);
        }
    };

    const handleSaveUrls = async () => {
        try {
            await fetch('http://localhost:3001/api/arduino/boards/config/urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: additionalUrls })
            });
            setShowSettings(false);
            handleRefresh();
        } catch (error) {
            console.error('Failed to save URLs:', error);
        }
    };

    return (
        <div className="arduino-manager-container">
            <div className="arduino-manager-toolbar">
                <div className="arduino-search-box">
                    <Search size={16} className="arduino-search-icon" />
                    <input
                        type="text"
                        placeholder="Search boards (e.g. esp32, samd)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchPlatforms(searchQuery)}
                    />
                </div>
                <div className="arduino-toolbar-actions">
                    <button className="arduino-action-btn" onClick={handleRefresh} disabled={isRefreshing} title="Update Index">
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button className="arduino-action-btn" onClick={() => setShowSettings(true)} title="Additional URLs">
                        <Settings size={16} />
                        Settings
                    </button>
                </div>
            </div>

            <div className="arduino-items-list">
                {isLoading ? (
                    <div className="arduino-loading-state">
                        <RefreshCw size={24} className="animate-spin" />
                        <p>Searching for boards...</p>
                    </div>
                ) : platforms.length === 0 ? (
                    <div className="arduino-empty-state">
                        <AlertCircle size={32} />
                        <p>No boards found. Try refreshing the index.</p>
                    </div>
                ) : (
                    platforms.map(platform => (
                        <div key={platform.id} className="arduino-item-card">
                            <div className="arduino-item-info">
                                <div className="arduino-item-header">
                                    <h3>{platform.name}</h3>
                                    <span className="arduino-vendor-tag">by {platform.vendor}</span>
                                </div>
                                <div className="arduino-item-meta-row">
                                    <p className="arduino-item-meta">Architecture: {platform.architecture}</p>
                                    {platform.latest_version && (
                                        <p className="arduino-item-meta">Version: {platform.latest_version}</p>
                                    )}
                                </div>
                                {platform.help_url && (
                                    <a href={platform.help_url} target="_blank" rel="noreferrer" className="arduino-help-link">
                                        More info <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>
                            <div className="arduino-item-actions">
                                {platform.installed_version ? (
                                    <div className="arduino-installed-status">
                                        <div className="arduino-status-info">
                                            <CheckCircle2 size={14} className="arduino-success-icon" />
                                            <span>Version {platform.installed_version} installed</span>
                                        </div>
                                        <div className="arduino-btn-group">
                                            {platform.latest_version && platform.latest_version !== platform.installed_version && (
                                                <button className="arduino-btn-update" onClick={() => handleInstall(platform.id, platform.latest_version)}>
                                                    Update to {platform.latest_version}
                                                </button>
                                            )}
                                            <button className="arduino-btn-remove" onClick={() => handleUninstall(platform.id)}>
                                                <Trash2 size={14} /> Remove
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="arduino-btn-install" onClick={() => handleInstall(platform.id)}>
                                        <Download size={14} /> Install
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showSettings && (
                <div className="arduino-settings-modal-overlay">
                    <div className="arduino-settings-modal">
                        <div className="arduino-settings-header">
                            <h3>Additional Boards Manager URLs</h3>
                            <button onClick={() => setShowSettings(false)}><X size={18} /></button>
                        </div>
                        <div className="arduino-settings-body">
                            <p className="arduino-settings-hint">Enter one URL per line for additional board packages (e.g. ESP32, ESP8266).</p>
                            <div className="arduino-url-list">
                                {additionalUrls.map((url, i) => (
                                    <div key={i} className="arduino-url-item">
                                        <span>{url}</span>
                                        <button onClick={() => setAdditionalUrls(additionalUrls.filter((_, idx) => idx !== i))}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="arduino-add-url-box">
                                <input
                                    type="text"
                                    placeholder="https://..."
                                    value={newUrl}
                                    onChange={(e) => setNewUrl(e.target.value)}
                                />
                                <button onClick={() => {
                                    if (newUrl) {
                                        setAdditionalUrls([...additionalUrls, newUrl]);
                                        setNewUrl('');
                                    }
                                }}>Add</button>
                            </div>
                        </div>
                        <div className="arduino-settings-footer">
                            <button className="arduino-btn-danger-outline" onClick={async () => {
                                if (confirm('Clear Arduino downloads cache? This will free up space but future installs may take longer.')) {
                                    await fetch('http://localhost:3001/api/arduino/cache/clear', { method: 'POST' });
                                    alert('Cache cleared');
                                }
                            }}>Clear Cache</button>
                            <div className="arduino-footer-right">
                                <button className="arduino-btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                                <button className="arduino-btn-primary" onClick={handleSaveUrls}>Save & Refresh</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BoardsManager;
