import React, { useState } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Folder, FileCode, Box, MessageSquare, Terminal, Layers, Layout, Save, Undo, Redo, Play, Plus } from 'lucide-react';
import './IDELayout.css';
import FileExplorer from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';
import BlockLibrary from './components/BlockLibrary';
import ChatWorkspace from './components/ChatWorkspace';
import ProjectTabs from './components/ProjectTabs';
import DesignCanvas, { type UIElement } from './components/DesignCanvas';
import LayerManager from './components/LayerManager';
import ComponentLibrary from './components/ComponentLibrary';
import PropertiesPanel from './components/PropertiesPanel';
import LessonToolbar from './components/LessonToolbar';
import { useDevice } from '../../../context/DeviceContext';

interface Project {
    id: string;
    name: string;
    type: 'code' | 'design';
    path?: string;
}

const MOCK_PROJECTS: Project[] = [
    { id: '1', name: 'Blink LED', type: 'code', path: '/Users/michaelcheng/Desktop/Test/Blink LED' },
    { id: '2', name: 'Smart Home UI', type: 'design' },
    { id: '3', name: 'Sensor Logger', type: 'code' },
];

const IDELayout: React.FC = () => {
    const [searchParams] = useSearchParams();
    const lessonId = searchParams.get('lessonId');
    const classId = searchParams.get('classId');
    const isLessonMode = !!(lessonId && classId);

    // Use global device context
    const { isConnected, serialData, devices, connectedDevice, isFlashing, flashCode } = useDevice();

    const { projectId } = useParams();
    const [activeProjectId, setActiveProjectId] = useState(projectId || '1');
    const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
    const [activeTab, setActiveTab] = useState<'files' | 'blocks' | 'ai'>('files');
    const [isTerminalOpen, setIsTerminalOpen] = useState(true);
    const [activeTerminalId, setActiveTerminalId] = useState('1');
    const [terminals, setTerminals] = useState([{ id: '1', name: 'Terminal 1', type: 'terminal' }]);
    const [code, setCode] = useState('// Arduino Setup\nvoid setup() {\n  // put your setup code here, to run once:\n}\n\nvoid loop() {\n  // put your main code here, to run repeatedly:\n}');
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [projectRoot, setProjectRoot] = useState<string | null>(null);
    const [isCreatingFile, setIsCreatingFile] = useState(false);

    const [elements, setElements] = useState<UIElement[]>([
        { id: '1', type: 'rect', x: 100, y: 100, width: 375, height: 812, style: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '40px' }, name: 'iPhone 13 Frame' },
        { id: '2', type: 'text', x: 140, y: 160, width: 200, height: 40, content: 'Smart Home', style: { fontSize: '24px', fontWeight: 'bold', color: '#111827' }, name: 'Title' },
        { id: '3', type: 'button', x: 140, y: 700, width: 295, height: 50, content: 'Connect', style: { backgroundColor: '#3b82f6', color: 'white', borderRadius: '12px', border: 'none' }, name: 'Connect Button' },
    ]);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    const [selectedDeviceSerial, setSelectedDeviceSerial] = useState<string>(connectedDevice?.usbSerial || '');

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
                        body: JSON.stringify({ rootPath: rootPath || '/Users/michaelcheng/Desktop/IA Companion V2' }) // Fallback to default
                    });
                    const data = await response.json();
                    if (data.success) {
                        setProjectRoot(data.root);
                        // Clear current file when switching projects
                        setCurrentFilePath(null);
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

    const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];
    const isDesignMode = activeProject.type === 'design';

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
            const response = await fetch(`http://localhost:3001/api/files/read?filePath=${encodeURIComponent(filePath)}`);
            const data = await response.json();
            if (data.success) {
                setCode(data.content);
                setCurrentFilePath(filePath);
            }
        } catch (error) {
            console.error('Failed to read file:', error);
            alert('Failed to open file');
        }
    };

    const handleSave = async () => {
        if (!currentFilePath) {
            alert('No file selected to save.');
            return;
        }

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
        } catch (error) {
            console.error('Failed to save file:', error);
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
        if (currentFilePath) {
            const saved = await handleSave();
            if (!saved) return;
        }

        setIsTerminalOpen(true);
        setActiveTerminalId('serial');

        const result = await flashCode(code, selectedDeviceSerial, projectRoot || undefined, currentFilePath || undefined);
        if (!result.success) {
            alert(`Upload failed: ${result.error}`);
        }
    };

    const handleCloseProject = (id: string) => {
        const newProjects = projects.filter(p => p.id !== id);
        setProjects(newProjects);
        if (activeProjectId === id && newProjects.length > 0) {
            setActiveProjectId(newProjects[0].id);
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
                    projects={projects}
                    activeId={activeProjectId}
                    onSwitch={setActiveProjectId}
                    onClose={handleCloseProject}
                    onNew={() => console.log('New Project')}
                />
            )}

            {/* Main Toolbar */}
            <div className="ide-toolbar">
                <div className="toolbar-left">
                    <button className="icon-btn" onClick={handleSave} title="Save File"><Save size={18} /></button>
                    <div className="divider" />
                    <button className="icon-btn"><Undo size={18} /></button>
                    <button className="icon-btn"><Redo size={18} /></button>
                </div>
                <div className="toolbar-center">
                    <span className="project-name">{activeProject.name}</span>
                </div>
                <div className="toolbar-right">
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
                                />
                            ))}
                            {activeTab === 'blocks' && (isDesignMode ? <ComponentLibrary /> : <BlockLibrary />)}
                            {activeTab === 'ai' && <ChatWorkspace isDesignMode={isDesignMode} />}
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
                                        <CodeEditor code={code} onChange={setCode} />
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
                                                    <div className="terminal-output">
                                                        {isConnected ? (
                                                            serialData.length > 0 ? (
                                                                serialData.map((line, index) => (
                                                                    <React.Fragment key={index}>
                                                                        <span className={line.includes('ERROR') ? 'error' : line.includes('>') ? 'info' : 'output'}>
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
                                                ) : (
                                                    <div className="terminal-output">
                                                        <span className="prompt">user@ia-companion:~$</span> npm run dev<br />
                                                        <span className="success">Build completed successfully.</span><br />
                                                        <span className="info">Listening on port 3000...</span>
                                                    </div>
                                                )}
                                            </div>
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
        </div>
    );
};

export default IDELayout;
