import React, { useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Folder, FileCode, Box, MessageSquare, Terminal, Layers, Layout, Save, Undo, Redo, Play, Plus, BookOpen } from 'lucide-react';
import './IDELayout.css';
import FileExplorer from './components/FileExplorer';
import CodeEditor, { type CodeEditorHandle } from './components/CodeEditor';
import BlockLibrary from './components/BlockLibrary';
import ChatWorkspace from './components/ChatWorkspace';
import ProjectTabs from './components/ProjectTabs';
import DesignCanvas, { type UIElement } from './components/DesignCanvas';
import LayerManager from './components/LayerManager';
import ComponentLibrary from './components/ComponentLibrary';
import PropertiesPanel from './components/PropertiesPanel';
import LessonToolbar from './components/LessonToolbar';
import UpdateLibraryButton from './components/UpdateLibraryButton';
import ArduinoManagerModal from './components/ArduinoManagerModal';
import ExampleBrowser from './components/ExampleBrowser';
import { useDevice } from '../../../context/DeviceContext';

interface Project {
    id: string;
    name: string;
    type: 'code' | 'design';
    path?: string;
    readOnly?: boolean;
}

const IDELayout: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const lessonId = searchParams.get('lessonId');
    const classId = searchParams.get('classId');
    const isLessonMode = !!(lessonId && classId);

    // Use global device context
    const {
        devices, isConnected, connectedDevice,
        isFlashing, flashProgress, flashMessage,
        arduinoLogs, arduinoStatus, clearLog,
        flashCode, cancelFlash, serialData, terminalLogs,
        sendCommand, runTerminalCommand
    } = useDevice();

    const { projectId } = useParams();
    const [activeProjectId, setActiveProjectId] = useState(projectId || '1');
    const [projects, setProjects] = useState<Project[]>([]);
    const [openProjects, setOpenProjects] = useState<Project[]>([]);

    const fetchProjects = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/projects');
            const data = await response.json();
            if (data.success) {
                setProjects(data.projects);
            }
        } catch (error) {
            console.error('Failed to fetch projects:', error);
        }
    };

    React.useEffect(() => {
        fetchProjects();
    }, []);

    // Initialize openProjects from localStorage or active project
    React.useEffect(() => {
        if (projects.length > 0 && openProjects.length === 0) {
            const savedIdsStr = localStorage.getItem('arduino_ide_open_projects');
            let initialOpenProjects: Project[] = [];

            if (savedIdsStr) {
                const savedIds = JSON.parse(savedIdsStr) as string[];
                initialOpenProjects = projects.filter(p => savedIds.includes(p.id));
            }

            // Ensure active project is always included
            const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
            if (activeProject && !initialOpenProjects.find(p => p.id === activeProject.id)) {
                initialOpenProjects.push(activeProject);
            }

            if (initialOpenProjects.length > 0) {
                setOpenProjects(initialOpenProjects);
                localStorage.setItem('arduino_ide_open_projects', JSON.stringify(initialOpenProjects.map(p => p.id)));
                if (!initialOpenProjects.find(p => p.id === activeProjectId)) {
                    setActiveProjectId(initialOpenProjects[0].id);
                }
            }
        }
    }, [projects]);
    const [activeTab, setActiveTab] = useState<'files' | 'blocks' | 'ai' | 'examples'>('files');
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [activeTerminalId, setActiveTerminalId] = useState('1');
    const [terminals, setTerminals] = useState([{ id: '1', name: 'Terminal 1', type: 'terminal' }]);
    const [code, setCode] = useState('// Arduino Setup\nvoid setup() {\n  // put your setup code here, to run once:\n}\n\nvoid loop() {\n  // put your main code here, to run repeatedly:\n}');
    const [savedCode, setSavedCode] = useState(code);
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [projectRoot, setProjectRoot] = useState<string | null>(null);
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [isArduinoManagerOpen, setIsArduinoManagerOpen] = useState(false);
    const editorRef = React.useRef<CodeEditorHandle>(null);

    const [elements, setElements] = useState<UIElement[]>([
        { id: '1', type: 'rect', x: 100, y: 100, width: 375, height: 812, style: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '40px' }, name: 'iPhone 13 Frame' },
        { id: '2', type: 'text', x: 140, y: 160, width: 200, height: 40, content: 'Smart Home', style: { fontSize: '24px', fontWeight: 'bold', color: '#111827' }, name: 'Title' },
        { id: '3', type: 'button', x: 140, y: 700, width: 295, height: 50, content: 'Connect', style: { backgroundColor: '#3b82f6', color: 'white', borderRadius: '12px', border: 'none' }, name: 'Connect Button' },
    ]);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [selectedDeviceSerial, setSelectedDeviceSerial] = useState<string>(connectedDevice?.usbSerial || '');
    const [serialInput, setSerialInput] = useState('');
    const [terminalInput, setTerminalInput] = useState('');

    // Unsaved changes tracking
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const isLoadingFile = React.useRef(false);

    // Ref for serial monitor auto-scroll optimization
    const serialOutputRef = React.useRef<HTMLDivElement>(null);
    const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

    // Optimize serial monitor auto-scroll
    React.useEffect(() => {
        if (shouldAutoScroll && serialOutputRef.current) {
            serialOutputRef.current.scrollTop = serialOutputRef.current.scrollHeight;
        }
    }, [serialData, shouldAutoScroll]);

    // Detect if user has scrolled up (disable auto-scroll)
    const handleSerialScroll = React.useCallback(() => {
        if (!serialOutputRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = serialOutputRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
        setShouldAutoScroll(isAtBottom);
    }, []);

    // Update active project when URL changes
    React.useEffect(() => {
        if (projectId) {
            setActiveProjectId(projectId);
        }
    }, [projectId]);

    // Update selected device when connected device changes
    React.useEffect(() => {
        if (connectedDevice && !selectedDeviceSerial) {
            setSelectedDeviceSerial(connectedDevice.usbSerial);
        }
    }, [connectedDevice, selectedDeviceSerial]);

    // Sync project root with backend
    React.useEffect(() => {
        const syncRoot = async () => {
            console.log(`[IDE] Syncing root for project ID: ${activeProjectId}`);
            const project = projects.find(p => p.id === activeProjectId);
            if (project) {
                const rootPath = project.path || ''; // Empty means default
                console.log(`[IDE] Project found: ${project.name}, path: ${rootPath}`);
                try {
                    const response = await fetch('http://localhost:3001/api/config/project-root', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ rootPath: rootPath || '' }) // Empty means default/skipped
                    });
                    const data = await response.json();
                    if (data.success) {
                        setProjectRoot(data.root);
                        // Clear current file when switching projects
                        setCurrentFilePath(null);

                        // Automatically open the .ino file if no file is open
                        try {
                            const filesResponse = await fetch('http://localhost:3001/api/files');
                            const filesData = await filesResponse.json();
                            if (filesData.success && filesData.files.length > 0) {
                                // Find the first .ino file
                                const findInoFile = (nodes: any[]): string | null => {
                                    for (const node of nodes) {
                                        if (node.type === 'file' && node.name.endsWith('.ino')) {
                                            return node.id;
                                        }
                                        if (node.type === 'folder' && node.children) {
                                            const found = findInoFile(node.children);
                                            if (found) return found;
                                        }
                                    }
                                    return null;
                                };

                                const inoPath = findInoFile(filesData.files);
                                if (inoPath) {
                                    handleFileSelect(inoPath);
                                }
                            }
                        } catch (err) {
                            console.error('Failed to auto-open .ino file:', err);
                        }
                    }
                } catch (error) {
                    console.error('Failed to sync project root:', error);
                }
            }
        };
        syncRoot();
    }, [activeProjectId, projects]);

    // Handle Ctrl+S / Cmd+S hotkey
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentFilePath, code]); // Need code in deps to save latest version

    // Track code changes for dirty state
    React.useEffect(() => {
        if (!isLoadingFile.current && currentFilePath) {
            setIsDirty(code !== savedCode);
        } else {
            setIsDirty(false);
        }
    }, [code, savedCode, currentFilePath]);

    // Clear save status after a delay
    React.useEffect(() => {
        if (saveStatus === 'saved' || saveStatus === 'error') {
            const timer = setTimeout(() => setSaveStatus('idle'), 3000);
            return () => clearTimeout(timer);
        }
    }, [saveStatus]);

    const activeProject = projects.find(p => p.id === activeProjectId);
    const isDesignMode = activeProject?.type === 'design';

    // Handle fallback if active project not found
    React.useEffect(() => {
        if (projects.length > 0 && !activeProject) {
            const fallback = projects[0];
            if (fallback) {
                setActiveProjectId(fallback.id);
            }
        }
    }, [projects, activeProject]);

    const handleOpenExample = async (library: string, example: string) => {
        try {
            const response = await fetch('http://localhost:3001/api/arduino/libraries/examples/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ library, example, mode: 'preview' })
            });
            const data = await response.json();
            if (data.success) {
                const newProject = data.project;
                // If it's already in projects, just switch to it
                const existing = projects.find(p => p.id === newProject.id);
                if (!existing) {
                    setProjects(prev => [...prev, newProject]);
                }
                // Add to open projects if not already there
                setOpenProjects(prev => {
                    if (prev.find(p => p.id === newProject.id)) return prev;
                    const next = [...prev, newProject];
                    localStorage.setItem('arduino_ide_open_projects', JSON.stringify(next.map(p => p.id)));
                    return next;
                });
                setActiveProjectId(newProject.id);
                setActiveTab('files'); // Switch to files view to see the example
                setIsDirty(false); // New project, no unsaved changes
            }
        } catch (error) {
            console.error('Failed to open example:', error);
        }
    };

    const handleCloneExample = async () => {
        if (!activeProject || !activeProject.readOnly) return;

        // Extract library and example from ID if it's a preview ID
        const parts = activeProject.id.split('-');
        if (parts[0] !== 'preview') return;

        const library = parts[1];
        const example = parts[2];

        try {
            setSaveStatus('saving');
            const response = await fetch('http://localhost:3001/api/arduino/libraries/examples/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ library, example, mode: 'clone' })
            });
            const data = await response.json();
            if (data.success) {
                const newProject = data.project;
                // Replace preview project with cloned project in openProjects
                setOpenProjects(prev => {
                    const filtered = prev.filter(p => p.id !== activeProject.id);
                    const next = [...filtered, newProject];
                    localStorage.setItem('arduino_ide_open_projects', JSON.stringify(next.map(p => p.id)));
                    return next;
                });

                // Update projects list
                setProjects(prev => [...prev, newProject]);
                setActiveProjectId(newProject.id);
                setIsDirty(false);
                setSaveStatus('saved');
            } else {
                setSaveStatus('error');
                alert('Failed to clone example: ' + data.error);
            }
        } catch (error) {
            console.error('Failed to clone example:', error);
            setSaveStatus('error');
        }
    };

    if (projects.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading projects...</p>
                </div>
            </div>
        );
    }

    if (!activeProject) return null;

    const handleCheckCode = () => {
        // Simple code validation
        const hasSetup = code.includes('setup()');
        const hasLoop = code.includes('loop()');

        if (!hasSetup || !hasLoop) {
            alert('❌ Your code is missing required functions.\n\nMake sure your Arduino sketch includes:\n• void setup()\n• void loop()');
        } else {
            alert('✅ Great! Your code structure looks good!\n\nYou have all the required functions.');
        }
    };

    const handleFileSelect = async (filePath: string) => {
        try {
            isLoadingFile.current = true;
            const response = await fetch(`http://localhost:3001/api/files/read?filePath=${encodeURIComponent(filePath)}`);
            const data = await response.json();
            if (data.success) {
                setCode(data.content);
                setSavedCode(data.content);
                setCurrentFilePath(filePath);
                setIsDirty(false);
            }
        } catch (error) {
            console.error('Failed to read file:', error);
            alert('Failed to open file');
        } finally {
            isLoadingFile.current = false;
        }
    };

    const handleSave = async () => {
        if (!currentFilePath) {
            alert('No file selected to save.');
            return;
        }

        setSaveStatus('saving');
        try {
            const response = await fetch('http://localhost:3001/api/files/write', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: currentFilePath, content: code })
            });
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error);
            }
            setSavedCode(code);
            setIsDirty(false);
            setSaveStatus('saved');
        } catch (error) {
            console.error('Failed to save file:', error);
            setSaveStatus('error');
            alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
        return true;
    };

    const handleUpload = async () => {
        if (!selectedDeviceSerial) {
            alert('Please select a device first.');
            return;
        }

        // Save file before uploading if one is open
        if (currentFilePath && !activeProject?.readOnly) { // Only save if not read-only
            const saved = await handleSave();
            if (!saved) return;
        }

        setIsTerminalOpen(true);
        setActiveTerminalId('serial'); // Or '1' for terminal? User said "compiling/flashing should be seen in terminal"
        // Let's switch to a terminal tab for flashing
        setActiveTerminalId('1');

        const result = await flashCode(code, selectedDeviceSerial, projectRoot || undefined, currentFilePath || undefined, activeProject?.readOnly);
        if (!result.success) {
            alert(`Upload failed: ${result.error}`);
        }
    };

    const handleSerialSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (serialInput.trim()) {
            sendCommand(serialInput.trim());
            setSerialInput('');
        }
    };

    const handleTerminalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (terminalInput.trim()) {
            runTerminalCommand(terminalInput.trim());
            setTerminalInput('');
        }
    };

    const handleSwitchProject = (id: string) => {
        if (isDirty && activeProjectId !== id) {
            if (!confirm('You have unsaved changes. Are you sure you want to switch projects? Your changes will be lost.')) {
                return;
            }
        }

        const project = projects.find(p => p.id === id);
        if (project) {
            setOpenProjects(prev => {
                if (prev.find(p => p.id === id)) return prev;
                const next = [...prev, project];
                localStorage.setItem('arduino_ide_open_projects', JSON.stringify(next.map(p => p.id)));
                return next;
            });
        }

        setActiveProjectId(id);
        setIsDirty(false);
    };

    const handleCloseProject = (id: string) => {
        if (isDirty && activeProjectId === id) {
            if (!confirm('You have unsaved changes. Are you sure you want to close this project? Your changes will be lost.')) {
                return;
            }
        }
        const newOpenProjects = openProjects.filter(p => p.id !== id);
        setOpenProjects(newOpenProjects);
        localStorage.setItem('arduino_ide_open_projects', JSON.stringify(newOpenProjects.map(p => p.id)));

        if (newOpenProjects.length === 0) {
            navigate('/projects');
            return;
        }

        if (activeProjectId === id) {
            setActiveProjectId(newOpenProjects[newOpenProjects.length - 1].id);
            setIsDirty(false);
        }
    };

    const handleCloseTerminal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (terminals.length <= 1) return; // Prevent closing last terminal

        const newTerminals = terminals.filter(t => t.id !== id);
        setTerminals(newTerminals);
        if (activeTerminalId === id) {
            setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
        }
    };

    const handleAddTerminal = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        setTerminals([...terminals, { id: newId, name: `Terminal ${terminals.length + 1}`, type: 'terminal' }]);
        setActiveTerminalId(newId);
    };

    const handleUndo = () => editorRef.current?.undo();
    const handleRedo = () => editorRef.current?.redo();

    return (
        <div className="ide-container">
            {/* Lesson Toolbar - only shown when accessed from lesson */}
            {isLessonMode && (
                <LessonToolbar
                    classId={classId!}
                    lessonId={lessonId!}
                    onCheckCode={!isDesignMode ? handleCheckCode : undefined}
                />
            )}

            {/* Top Project Tabs - hidden in lesson mode */}
            {!isLessonMode && (
                <ProjectTabs
                    projects={openProjects.map(p => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        isDirty: p.id === activeProjectId ? isDirty : false
                    }))}
                    activeId={activeProjectId}
                    onSwitch={handleSwitchProject}
                    onClose={handleCloseProject}
                    onNew={() => console.log('New Project')}
                />
            )}

            {/* Main Toolbar */}
            <div className="ide-toolbar">
                <div className="toolbar-left">
                    <button className="icon-btn" onClick={handleSave} title="Save File">
                        <Save size={18} />
                        {isDirty && <div className="save-dot" />}
                    </button>
                    <div className="divider" />
                    <button className="icon-btn" onClick={handleUndo} title="Undo"><Undo size={18} /></button>
                    <button className="icon-btn" onClick={handleRedo} title="Redo"><Redo size={18} /></button>
                </div>
                <div className="toolbar-center">
                    <span className="project-name">{activeProject?.name}</span>
                </div>
                <div className="toolbar-right">
                    {saveStatus !== 'idle' && (
                        <div className={`save-notification ${saveStatus}`}>
                            {saveStatus === 'saving' && 'Saving...'}
                            {saveStatus === 'saved' && 'Save complete'}
                            {saveStatus === 'error' && 'Save failed'}
                        </div>
                    )}
                    {!isDesignMode && (
                        <>
                            <select
                                className="device-selector"
                                value={selectedDeviceSerial}
                                onChange={(e) => setSelectedDeviceSerial(e.target.value)}
                                style={{ cursor: 'pointer', marginRight: '12px' }}
                            >
                                <option value="" disabled>Select Device</option>
                                {devices.map(device => (
                                    <option key={device.usbSerial} value={device.usbSerial}>
                                        {device.deviceName} ({device.usbSerial})
                                    </option>
                                ))}
                                {devices.length === 0 && <option value="" disabled>No devices found</option>}
                            </select>
                            <button
                                className="icon-btn"
                                onClick={() => setIsArduinoManagerOpen(true)}
                                title="Arduino Boards & Library Manager"
                                style={{ marginRight: '8px' }}
                            >
                                <Box size={18} />
                            </button>
                            <UpdateLibraryButton />
                            <button
                                className="play-btn"
                                onClick={handleUpload}
                                disabled={isFlashing || !selectedDeviceSerial}
                                style={{
                                    backgroundColor: isFlashing ? '#9ca3af' : '#3b82f6',
                                    color: 'white',
                                    padding: '8px 24px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: isFlashing || !selectedDeviceSerial ? 'not-allowed' : 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isFlashing ? (
                                    <>
                                        <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Play size={16} /> Upload
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {activeProject.readOnly && (
                <div className="preview-banner">
                    <div className="preview-info">
                        <Layers size={16} />
                        <span><strong>Preview Mode:</strong> You are viewing a library example. Save it to your projects to make changes.</span>
                    </div>
                    <button className="clone-btn" onClick={handleCloneExample}>
                        <Save size={14} />
                        Save to My Projects
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="ide-content">
                <PanelGroup direction="horizontal">
                    {/* Left Sidebar */}
                    <Panel defaultSize={20} minSize={15} maxSize={30} className="left-panel">
                        <div className="left-panel-tabs">
                            {isDesignMode ? (
                                <>
                                    <button
                                        className={`panel-tab ${activeTab === 'files' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('files')}
                                    >
                                        <Layers size={16} /> Layers
                                    </button>
                                    <button
                                        className={`panel-tab ${activeTab === 'blocks' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('blocks')}
                                    >
                                        <Layout size={16} /> Components
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        className={`panel-tab ${activeTab === 'files' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('files')}
                                    >
                                        <Folder size={16} /> Files
                                    </button>
                                    <button
                                        className={`panel-tab ${activeTab === 'blocks' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('blocks')}
                                    >
                                        <Box size={16} /> Blocks
                                    </button>
                                </>
                            )}
                            <button
                                className={`panel-tab ${activeTab === 'ai' ? 'active' : ''}`}
                                onClick={() => setActiveTab('ai')}
                            >
                                <MessageSquare size={16} /> AI
                            </button>
                            <button
                                className={`panel-tab ${activeTab === 'examples' ? 'active' : ''}`}
                                onClick={() => setActiveTab('examples')}
                            >
                                <BookOpen size={16} /> Examples
                            </button>
                        </div>

                        <div className="left-panel-content">
                            {activeTab === 'files' && (isDesignMode ? (
                                <LayerManager layers={elements} selectedId={selectedElementId} onSelect={setSelectedElementId} />
                            ) : (
                                <FileExplorer
                                    onFileSelect={handleFileSelect}
                                    key={projectRoot}
                                    isCreating={isCreatingFile}
                                    setIsCreating={setIsCreatingFile}
                                    activeFilePath={currentFilePath}
                                />
                            ))}
                            {activeTab === 'blocks' && (isDesignMode ? <ComponentLibrary /> : <BlockLibrary />)}
                            {activeTab === 'ai' && <ChatWorkspace isDesignMode={isDesignMode} />}
                            {activeTab === 'examples' && <ExampleBrowser onOpenExample={handleOpenExample} />}
                        </div>
                    </Panel>

                    <PanelResizeHandle className="resize-handle" />

                    {/* Center Editor Area */}
                    <Panel className="center-panel">
                        {isDesignMode ? (
                            <DesignCanvas
                                elements={elements}
                                setElements={setElements}
                                selectedId={selectedElementId}
                                setSelectedId={setSelectedElementId}
                            />
                        ) : (
                            <PanelGroup direction="vertical">
                                <Panel className="editor-panel">
                                    {currentFilePath ? (
                                        <CodeEditor ref={editorRef} code={code} onChange={setCode} readOnly={activeProject?.readOnly} />
                                    ) : (
                                        <div className="editor-empty-state">
                                            <div className="empty-state-content">
                                                <FileCode size={48} className="empty-icon" />
                                                <h2>No file open</h2>
                                                <p>Select a file from the sidebar or create a new one to begin coding.</p>
                                                <button
                                                    className="btn-primary mt-md"
                                                    onClick={() => setIsCreatingFile(true)}
                                                >
                                                    <Plus size={16} /> Create New File
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </Panel>

                                {isTerminalOpen ? (
                                    <>
                                        <PanelResizeHandle className="resize-handle vertical" />
                                        <Panel defaultSize={30} minSize={10} className="terminal-panel">
                                            <div className="terminal-header">
                                                <div className="terminal-tabs">
                                                    <button
                                                        className={`term-tab ${activeTerminalId === 'serial' ? 'active' : ''}`}
                                                        onClick={() => setActiveTerminalId('serial')}
                                                    >
                                                        Serial Monitor
                                                    </button>
                                                    {terminals.map(term => (
                                                        <div
                                                            key={term.id}
                                                            className={`term-tab ${activeTerminalId === term.id ? 'active' : ''}`}
                                                            onClick={() => setActiveTerminalId(term.id)}
                                                        >
                                                            <Terminal size={12} /> {term.name}
                                                            <button className="term-close-btn" onClick={(e) => handleCloseTerminal(term.id, e)}>×</button>
                                                        </div>
                                                    ))}
                                                    <button className="term-add-btn" onClick={handleAddTerminal}>+</button>
                                                </div>
                                                <button className="icon-btn-small" onClick={() => setIsTerminalOpen(false)}>×</button>
                                            </div>
                                            <div className="terminal-content">
                                                {activeTerminalId === 'serial' ? (
                                                    <div className="terminal-wrapper">
                                                        <div
                                                            className="terminal-output"
                                                            ref={serialOutputRef}
                                                            onScroll={handleSerialScroll}
                                                        >
                                                            {isConnected ? (
                                                                serialData.length > 0 ? (
                                                                    serialData.map((line, index) => (
                                                                        <React.Fragment key={index}>
                                                                            <span className={line.includes('ERROR') ? 'error' : line.includes('[TX]') ? 'info' : 'output'}>
                                                                                {line}
                                                                            </span>
                                                                            <br />
                                                                        </React.Fragment>
                                                                    ))
                                                                ) : (
                                                                    <span className="info">&gt; Waiting for serial data...</span>
                                                                )
                                                            ) : (
                                                                <span className="info">&gt; Serial monitor not connected. Connect a device from the Home page.</span>
                                                            )}
                                                        </div>
                                                        <form className="terminal-input-area" onSubmit={handleSerialSubmit}>
                                                            <span className="prompt">&gt;</span>
                                                            <input
                                                                type="text"
                                                                value={serialInput}
                                                                onChange={(e) => setSerialInput(e.target.value)}
                                                                placeholder="Send serial command..."
                                                                disabled={!isConnected}
                                                            />
                                                        </form>
                                                    </div>
                                                ) : (
                                                    <div className="terminal-wrapper">
                                                        <div className="terminal-output">
                                                            {terminalLogs.length > 0 ? (
                                                                terminalLogs.map((log, index) => (
                                                                    <div key={index} className="terminal-line">
                                                                        {log.startsWith('user@ia-companion') ? (
                                                                            <span className="prompt">{log}</span>
                                                                        ) : log.includes('Error') || log.includes('stderr') ? (
                                                                            <span className="error">{log}</span>
                                                                        ) : (
                                                                            <span>{log}</span>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span className="info">Terminal ready.</span>
                                                            )}
                                                        </div>
                                                        <form className="terminal-input-area" onSubmit={handleTerminalSubmit}>
                                                            <span className="prompt">user@ia-companion:~$</span>
                                                            <input
                                                                type="text"
                                                                value={terminalInput}
                                                                onChange={(e) => setTerminalInput(e.target.value)}
                                                                placeholder="Run terminal command..."
                                                            />
                                                        </form>
                                                    </div>
                                                )}
                                            </div>
                                            {isFlashing && (
                                                <div className="flash-progress-overlay">
                                                    <div className="flash-progress-container">
                                                        <div className="flash-progress-header">
                                                            <span>{flashMessage}</span>
                                                            <span>{flashProgress}%</span>
                                                        </div>
                                                        <div className="flash-progress-bar-bg">
                                                            <div
                                                                className="flash-progress-bar-fill"
                                                                style={{ width: `${flashProgress}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-end" style={{ marginTop: '10px' }}>
                                                            <button
                                                                onClick={() => cancelFlash()}
                                                                style={{
                                                                    backgroundColor: 'transparent',
                                                                    color: 'white',
                                                                    padding: '8px 24px',
                                                                    borderRadius: '6px',
                                                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                                                    cursor: 'pointer',
                                                                    fontWeight: 500,
                                                                    transition: 'all 0.2s',
                                                                    fontSize: '14px'
                                                                }}
                                                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)')}
                                                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </Panel>
                                    </>
                                ) : (
                                    <div className="status-bar">
                                        <button
                                            className="flex items-center gap-2 text-xs transition-colors"
                                            style={{ color: 'white', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                            onClick={() => setIsTerminalOpen(true)}
                                        >
                                            <Terminal size={12} /> Toggle Terminal
                                        </button>
                                    </div>
                                )}
                            </PanelGroup>
                        )}
                    </Panel>

                    {/* Right Panel (Properties) for Design Mode */}
                    {isDesignMode && (
                        <>
                            <PanelResizeHandle className="resize-handle" />
                            <Panel defaultSize={20} minSize={15} maxSize={25} className="right-panel">
                                <PropertiesPanel />
                            </Panel>
                        </>
                    )}
                </PanelGroup>
            </div>

            {/* Arduino Manager Modal */}
            {isArduinoManagerOpen && (
                <ArduinoManagerModal
                    onClose={() => setIsArduinoManagerOpen(false)}
                    onOpenExample={(lib, ex) => {
                        handleOpenExample(lib, ex);
                        setIsArduinoManagerOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default IDELayout;
