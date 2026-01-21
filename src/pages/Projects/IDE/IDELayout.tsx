import React, { useState, useEffect } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Folder, FileCode, Box, MessageSquare, Terminal, Layers, Layout, Save, Undo, Redo, Play, Plus, Library, Cpu, Usb, ChevronRight } from 'lucide-react';
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
import ExtensionManagerModal from './components/ExtensionManagerModal';
import ExampleBrowser from './components/ExampleBrowser';
import BoardPortSelectorModal from './components/BoardPortSelectorModal';
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
        devices, connectToDevice, isConnected, connectedDevice,
        isFlashing, isConnecting, flashProgress, flashMessage,
        flashCode, cancelFlash, serialData, terminalLogs,
        sendCommand, runTerminalCommand,
        selectedBoard, selectedPort, setSelectedBoard, setSelectedPort,
        connectionMode, setConnectionMode,
        showDevicePicker, setShowDevicePicker,
        manualConnect,
        manualDisconnect
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
    const [isExtensionManagerOpen, setIsExtensionManagerOpen] = useState(false);
    const [isBoardSelectorOpen, setIsBoardSelectorOpen] = useState(false);
    const editorRef = React.useRef<CodeEditorHandle>(null);

    // Auto-connect/disconnect serial when switching to/from serial tab
    useEffect(() => {
        console.log('[IDELayout] Tab switch effect triggered:', {
            activeTerminalId,
            isTerminalOpen,
            connectionMode,
            isConnected,
            isConnecting,
            selectedPort,
            justDisconnected: justDisconnectedForTabSwitch.current
        });

        // In Auto Mode, we don't disconnect on tab switch (stay connected to product)
        if (connectionMode === 'auto') {
            console.log('[IDELayout] Auto mode - no tab switching logic');
            return;
        }

        // In Manual Mode, we connect on entry and disconnect on exit
        const handleManualSerial = async () => {
            if (activeTerminalId === 'serial' && isTerminalOpen) {
                console.log('[IDELayout] On serial tab - checking connection state');
                // Connect if we have a port but aren't connected OR if we just disconnected
                if (selectedPort && !isConnecting && (!isConnected || justDisconnectedForTabSwitch.current)) {
                    console.log('[IDELayout] Manual mode: Attempting to connect to port:', selectedPort);
                    justDisconnectedForTabSwitch.current = false; // Reset flag
                    try {
                        await manualConnect();
                        console.log('[IDELayout] Manual connect completed');
                    } catch (err) {
                        console.error('[IDELayout] Manual connect failed:', err);
                    }
                } else {
                    console.log('[IDELayout] Not connecting:', { isConnected, selectedPort, isConnecting });
                }
            } else {
                console.log('[IDELayout] Not on serial tab - checking if should disconnect');
                // Leaving serial tab in manual mode -> Disconnect
                if (isConnected) {
                    console.log('[IDELayout] Manual mode: Disconnecting on tab switch');
                    justDisconnectedForTabSwitch.current = true; // Mark that we disconnected
                    try {
                        await manualDisconnect();
                        console.log('[IDELayout] Manual disconnect completed');
                    } catch (err) {
                        console.error('[IDELayout] Manual disconnect failed:', err);
                    }
                }
            }
        };

        handleManualSerial();
    }, [activeTerminalId, isTerminalOpen, isConnected, isConnecting, selectedPort, manualConnect, manualDisconnect, connectionMode]);

    const [elements, setElements] = useState<UIElement[]>([
        { id: '1', type: 'rect', x: 100, y: 100, width: 375, height: 812, style: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '40px' }, name: 'iPhone 13 Frame' },
        { id: '2', type: 'text', x: 140, y: 160, width: 200, height: 40, content: 'Smart Home', style: { fontSize: '24px', fontWeight: 'bold', color: '#111827' }, name: 'Title' },
        { id: '3', type: 'button', x: 140, y: 700, width: 295, height: 50, content: 'Connect', style: { backgroundColor: '#3b82f6', color: 'white', borderRadius: '12px', border: 'none' }, name: 'Connect Button' },
    ]);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
    const [highlightedLines, setHighlightedLines] = useState<number[]>([]);

    const selectedDeviceSerial = connectedDevice?.usbSerial || '';
    const [serialInput, setSerialInput] = useState('');
    const [terminalInput, setTerminalInput] = useState('');

    // Track if we just disconnected for tab switching (to force reconnection)
    const justDisconnectedForTabSwitch = React.useRef(false);

    // Unsaved changes tracking
    // const [isDirty, setIsDirty] = useState(false); // Derived from code !== savedCode
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

    // Sync selectedDeviceSerial with connectedDevice (removed useEffect as it's now derived)

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

    const handleFileSelect = React.useCallback(async (filePath: string) => {
        console.log('[IDELayout] handleFileSelect called for:', filePath);
        try {
            isLoadingFile.current = true;
            const response = await fetch(`http://localhost:3001/api/files/read?filePath=${encodeURIComponent(filePath)}&projectId=${projectId || ''}`);
            const data = await response.json();
            if (data.success) {
                console.log('[IDELayout] File read success:', filePath);
                setCode(data.content);
                setSavedCode(data.content);
                setCurrentFilePath(filePath);
            } else {
                console.error('[IDELayout] File read failed:', data.error);
                alert(`Failed to open file: ${data.error}`);
            }
        } catch (error) {
            console.error('[IDELayout] Failed to read file error:', error);
            alert('Failed to open file');
        } finally {
            isLoadingFile.current = false;
        }
    }, [setCode, setSavedCode, setCurrentFilePath]);

    // Handle open-file event from Spotlight Search
    React.useEffect(() => {
        const handleOpenFile = (e: any) => {
            console.log('[IDELayout] Received open-file event:', e.detail);
            if (e.detail && e.detail.path) {
                handleFileSelect(e.detail.path);
            }
        };
        window.addEventListener('open-file', handleOpenFile);
        return () => window.removeEventListener('open-file', handleOpenFile);
    }, [handleFileSelect]);

    // Handle openFile query param from Spotlight Search navigation
    React.useEffect(() => {
        const openFilePath = searchParams.get('openFile');
        if (openFilePath) {
            console.log('[IDELayout] Opening file from query param:', openFilePath);
            handleFileSelect(openFilePath);
            // Clear the query param after opening to prevent re-opening on refresh
            const newParams = new URLSearchParams(searchParams);
            newParams.delete('openFile');
            navigate(`/projects/${projectId}?${newParams.toString()}`, { replace: true });
        }
    }, [searchParams, handleFileSelect, navigate, projectId]);

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

    // Track code changes for dirty state - DERIVED NOW
    // React.useEffect(() => {
    //     if (!isLoadingFile.current && currentFilePath) {
    //         setIsDirty(code !== savedCode);
    //     } else {
    //         setIsDirty(false);
    //     }
    // }, [code, savedCode, currentFilePath]);

    const isDirty = React.useMemo(() => {
        if (isLoadingFile.current || !currentFilePath) return false;
        return code !== savedCode;
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
                // setIsDirty(false); // New project, no unsaved changes -> handled by savedCode update?
                // For new project from example, we should set savedCode to the new code
                // But here we don't have the code content easily accessible unless we fetch it or the API returns it.
                // If not, loadFile will handle it when activeProjectId changes.
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
                // setIsDirty(false);
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
            // setIsDirty(false);
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
        const canFlash = connectionMode === 'manual' ? !!selectedPort : !!connectedDevice;
        if (!canFlash) {
            alert('Please select a device or port first.');
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

        const flashIdentifier = connectionMode === 'manual' ? undefined : connectedDevice?.usbSerial;
        const result = await flashCode(code, flashIdentifier, projectRoot || undefined, currentFilePath || undefined, activeProject?.readOnly);
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
        // setIsDirty(false); // isDirty is derived, no need to set manually
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
            // setIsDirty(false);
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
                            <button
                                className="device-selector-btn"
                                onClick={() => setIsBoardSelectorOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 14px',
                                    backgroundColor: '#f3f4f6',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    marginRight: '12px'
                                }}
                            >
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    backgroundColor: isConnected ? '#f0fdfa' : '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {connectionMode === 'manual' ? (
                                        <Cpu size={16} color={isConnected ? '#0d9488' : '#6b7280'} />
                                    ) : (
                                        <Usb size={16} color={isConnected ? '#0d9488' : '#6b7280'} />
                                    )}
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', lineHeight: 1 }}>
                                        {connectionMode === 'manual'
                                            ? (selectedBoard?.name || 'Select Board')
                                            : (connectedDevice?.deviceName || 'No Device')}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '2px', fontFamily: 'monospace' }}>
                                        {connectionMode === 'manual'
                                            ? (selectedPort || 'No Port')
                                            : (connectedDevice?.portPath || 'Auto-Detect')}
                                    </div>
                                </div>
                            </button>
                            <button
                                className="icon-btn"
                                onClick={() => setIsExtensionManagerOpen(true)}
                                title="Extension Manager"
                                style={{ marginRight: '8px' }}
                            >
                                <Box size={18} />
                            </button>
                            <UpdateLibraryButton />
                            <button
                                className="play-btn"
                                onClick={handleUpload}
                                disabled={isFlashing || (!selectedDeviceSerial && !selectedPort)}
                                style={{
                                    backgroundColor: isFlashing ? '#9ca3af' : '#3b82f6',
                                    color: 'white',
                                    padding: '8px 24px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: isFlashing || (!selectedDeviceSerial && !selectedPort) ? 'not-allowed' : 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.2s'
                                }}
                            >
                                {isFlashing ? (
                                    <>
                                        <div className="rotating-spin" style={{ width: '16px', height: '16px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
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
                    <Panel defaultSize={20} minSize={15} maxSize={45} className="left-panel">
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
                            {import.meta.env.VITE_APP_MODE !== 'production' && (
                                <button
                                    className={`panel-tab ${activeTab === 'ai' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('ai')}
                                >
                                    <MessageSquare size={16} /> AI
                                </button>
                            )}
                            <button
                                className={`panel-tab ${activeTab === 'examples' ? 'active' : ''}`}
                                onClick={() => setActiveTab('examples')}
                            >
                                <Library size={16} strokeWidth={2.5} /> Examples
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
                            {activeTab === 'ai' && <ChatWorkspace isDesignMode={isDesignMode} code={code} onHighlightLines={setHighlightedLines} />}
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
                                        <CodeEditor
                                            key={currentFilePath || 'empty'}
                                            ref={editorRef}
                                            code={code}
                                            onChange={setCode}
                                            readOnly={activeProject?.readOnly}
                                            highlightedLines={highlightedLines}
                                        />
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

            {/* Extension Manager Modal */}
            {isExtensionManagerOpen && (
                <ExtensionManagerModal
                    onClose={() => setIsExtensionManagerOpen(false)}
                    onOpenExample={(lib, ex) => {
                        handleOpenExample(lib, ex);
                        setIsExtensionManagerOpen(false);
                    }}
                />
            )}

            <BoardPortSelectorModal
                isOpen={isBoardSelectorOpen}
                onClose={() => setIsBoardSelectorOpen(false)}
                onSelect={async (board, port, isProduct) => {
                    console.log('[IDELayout] Board selector: selected', { board: board?.name, port, isProduct });

                    // Disconnect from current device first
                    if (isConnected) {
                        console.log('[IDELayout] Disconnecting from current device');
                        await manualDisconnect();
                    }

                    // Determine mode based on device type
                    const newMode = isProduct ? 'auto' : 'manual';
                    console.log('[IDELayout] Setting connection mode to:', newMode);

                    // Update state FIRST
                    setConnectionMode(newMode);
                    setSelectedBoard(board);
                    setSelectedPort(port);

                    // Connect directly to the new port/device
                    if (port) {
                        // Create device object with the selected port
                        const deviceObj: any = { portPath: port };

                        // If it's a product, add device name for UI display
                        if (isProduct) {
                            deviceObj.deviceName = 'IA Kit Pro';
                        }

                        console.log('[IDELayout] Connecting to:', deviceObj);

                        try {
                            await connectToDevice(deviceObj);
                        } catch (err) {
                            console.error('[IDELayout] Connection error:', err);
                        }
                    }
                }}
                initialBoard={selectedBoard}
                initialPort={selectedPort}
            />

            {/* Device Picker Modal for Multiple Products */}
            {showDevicePicker && (
                <div style={modalStyles.overlay} onClick={() => setShowDevicePicker(false)}>
                    <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
                        <div style={modalStyles.header}>
                            <Usb size={24} color="#2563eb" />
                            <h2 style={modalStyles.title}>Multiple Devices Detected</h2>
                        </div>
                        <p style={modalStyles.text}>Please select which IA Kit Pro you would like to connect to:</p>
                        <div style={modalStyles.list}>
                            {devices.map(device => (
                                <button
                                    key={device.usbSerial}
                                    onClick={() => {
                                        setConnectionMode('auto');
                                        connectToDevice(device);
                                        setShowDevicePicker(false);
                                    }}
                                    style={modalStyles.item}
                                >
                                    <div style={modalStyles.itemIcon}>
                                        <Usb size={20} color="#2563eb" />
                                    </div>
                                    <div style={modalStyles.itemText}>
                                        <div style={modalStyles.itemName}>{device.deviceName}</div>
                                        <div style={modalStyles.itemSub}>{device.portPath} ({device.usbSerial})</div>
                                    </div>
                                    <ChevronRight size={18} color="#d1d5db" />
                                </button>
                            ))}
                        </div>
                        <div style={modalStyles.footer}>
                            <button
                                onClick={() => setShowDevicePicker(false)}
                                style={modalStyles.cancelBtn}
                            >
                                DECIDE LATER
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const modalStyles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: '16px',
        width: 'var(--modal-width-default)',
        maxWidth: 'var(--modal-max-width)',
        height: 'auto',
        maxHeight: 'var(--modal-max-height)',
        padding: '32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflow: 'auto',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    title: {
        fontSize: '20px',
        fontWeight: 700,
        color: '#111827',
        margin: 0,
    },
    text: {
        fontSize: '14px',
        color: '#4b5563',
        margin: 0,
        lineHeight: 1.5,
    },
    list: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    item: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        textAlign: 'left',
    },
    itemIcon: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        backgroundColor: '#eff6ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        flex: 1,
    },
    itemName: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#111827',
    },
    itemSub: {
        fontSize: '11px',
        color: '#6b7280',
        fontFamily: 'monospace',
    },
    footer: {
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: '12px',
    },
    cancelBtn: {
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#6b7280',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
    }
};

export default IDELayout;
