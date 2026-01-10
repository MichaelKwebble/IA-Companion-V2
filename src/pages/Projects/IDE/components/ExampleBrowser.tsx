import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronRight, ChevronDown, FileCode, Search, RefreshCw } from 'lucide-react';

interface LibraryExamples {
    library: string;
    examples: string[];
}

interface ExampleBrowserProps {
    onOpenExample: (library: string, example: string) => void;
}

const ExampleBrowser: React.FC<ExampleBrowserProps> = ({ onOpenExample }) => {
    const [libraries, setLibraries] = useState<LibraryExamples[]>([]);
    const [expandedLibs, setExpandedLibs] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchExamples = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/arduino/libraries/examples');
            const data = await response.json();
            if (data.success) {
                setLibraries(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch examples:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchExamples();
    }, []);

    const toggleLib = (libName: string) => {
        const next = new Set(expandedLibs);
        if (next.has(libName)) {
            next.delete(libName);
        } else {
            next.add(libName);
        }
        setExpandedLibs(next);
    };

    const filteredLibraries = libraries.filter(lib =>
        lib.library.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lib.examples.some(ex => ex.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="example-browser">
            <div className="browser-search">
                <Search size={14} className="search-icon" />
                <input
                    type="text"
                    placeholder="Search examples..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button className="refresh-btn" onClick={fetchExamples} title="Refresh List">
                    <RefreshCw size={14} className={isLoading ? 'arduino-animate-spin' : ''} />
                </button>
            </div>

            <div className="browser-list">
                {isLoading ? (
                    <div className="browser-loading">
                        <RefreshCw size={20} className="arduino-animate-spin" />
                        <span>Loading examples...</span>
                    </div>
                ) : filteredLibraries.length === 0 ? (
                    <div className="browser-empty">
                        <BookOpen size={24} />
                        <p>{searchQuery ? 'No matches found' : 'No library examples found'}</p>
                    </div>
                ) : (
                    filteredLibraries.map(lib => (
                        <div key={lib.library} className="lib-group">
                            <div
                                className={`lib-header ${expandedLibs.has(lib.library) ? 'expanded' : ''}`}
                                onClick={() => toggleLib(lib.library)}
                            >
                                {expandedLibs.has(lib.library) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <BookOpen size={14} className="lib-icon" />
                                <span>{lib.library}</span>
                                <span className="example-count">{lib.examples.length}</span>
                            </div>
                            {expandedLibs.has(lib.library) && (
                                <div className="lib-examples">
                                    {lib.examples
                                        .filter(ex => !searchQuery || ex.toLowerCase().includes(searchQuery.toLowerCase()) || lib.library.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map(ex => (
                                            <div
                                                key={ex}
                                                className="example-item"
                                                onClick={() => onOpenExample(lib.library, ex)}
                                            >
                                                <FileCode size={12} />
                                                <span>{ex}</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <style>{`
                .example-browser {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: #f9fafb;
                }
                .browser-search {
                    padding: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    border-bottom: 1px solid #e5e7eb;
                    background: white;
                }
                .browser-search input {
                    flex: 1;
                    border: none;
                    outline: none;
                    font-size: 13px;
                    background: transparent;
                }
                .search-icon { color: #9ca3af; }
                .refresh-btn {
                    padding: 4px;
                    border-radius: 4px;
                    border: none;
                    background: transparent;
                    color: #6b7280;
                    cursor: pointer;
                }
                .refresh-btn:hover { background: #f3f4f6; }

                .browser-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px 0;
                }
                .browser-loading, .browser-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    color: #9ca3af;
                    text-align: center;
                    gap: 12px;
                }
                .browser-empty p { font-size: 13px; }

                .lib-header {
                    display: flex;
                    align-items: center;
                    padding: 6px 12px;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    color: #374151;
                    transition: background 0.2s;
                }
                .lib-header:hover { background: #f3f4f6; }
                .lib-header.expanded { color: #2563eb; }
                .lib-icon { color: #6b7280; }
                .example-count {
                    margin-left: auto;
                    font-size: 11px;
                    background: #e5e7eb;
                    padding: 1px 6px;
                    border-radius: 10px;
                    color: #6b7280;
                }

                .lib-examples {
                    padding: 2px 0 8px 0;
                }
                .example-item {
                    display: flex;
                    align-items: center;
                    padding: 6px 12px 6px 36px;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 13px;
                    color: #4b5563;
                    transition: all 0.2s;
                }
                .example-item:hover {
                    background: #eff6ff;
                    color: #2563eb;
                }
                .example-item svg { color: #9ca3af; }
                .example-item:hover svg { color: #2563eb; }
            `}</style>
        </div>
    );
};

export default ExampleBrowser;
