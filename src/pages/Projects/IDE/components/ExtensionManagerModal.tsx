import React, { useState, useEffect, useRef } from 'react';
import { X, Cpu, Library, Package, Terminal as TerminalIcon, ChevronDown, ChevronUp } from 'lucide-react';
import BoardsManager from './BoardsManager';
import LibraryManager from './LibraryManager';
import { useDevice } from '../../../../context/DeviceContext';
import './ExtensionManagerModal.css';

interface ExtensionManagerModalProps {
    onClose: () => void;
    onOpenExample?: (library: string, example: string) => void;
}

const ExtensionManagerModal: React.FC<ExtensionManagerModalProps> = ({ onClose, onOpenExample }) => {
    const [activeTab, setActiveTab] = useState<'boards' | 'libraries'>('boards');
    const [isConsoleOpen, setIsConsoleOpen] = useState(false);
    const { arduinoLogs } = useDevice();
    const consoleOutputRef = useRef<HTMLDivElement>(null);

    // Auto-scroll console
    useEffect(() => {
        if (isConsoleOpen && consoleOutputRef.current) {
            consoleOutputRef.current.scrollTop = consoleOutputRef.current.scrollHeight;
        }
    }, [arduinoLogs, isConsoleOpen]);

    return (
        <div className="extension-manager-overlay" onClick={onClose}>
            <div className="extension-manager-modal" onClick={(e) => e.stopPropagation()}>
                <div className="extension-modal-header">
                    <div className="extension-header-left">
                        <Package size={20} className="extension-header-icon" />
                        <h2>Extension Manager</h2>
                    </div>
                    <button className="extension-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="extension-modal-tabs">
                    <button
                        className={`extension-modal-tab ${activeTab === 'boards' ? 'active' : ''}`}
                        onClick={() => setActiveTab('boards')}
                    >
                        <Cpu size={16} /> Boards Manager
                    </button>
                    <button
                        className={`extension-modal-tab ${activeTab === 'libraries' ? 'active' : ''}`}
                        onClick={() => setActiveTab('libraries')}
                    >
                        <Library size={16} /> Library Manager
                    </button>
                </div>

                <div className="extension-modal-content">
                    {activeTab === 'boards' ? <BoardsManager /> : <LibraryManager onOpenExample={onOpenExample} />}
                </div>

                <div className={`extension-console-panel ${isConsoleOpen ? 'open' : ''}`}>
                    <div className="extension-console-header" onClick={() => setIsConsoleOpen(!isConsoleOpen)}>
                        <div className="extension-console-title">
                            <TerminalIcon size={14} />
                            <span>Output Console</span>
                        </div>
                        {isConsoleOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                    {isConsoleOpen && (
                        <div className="extension-console-output" ref={consoleOutputRef}>
                            {arduinoLogs.length === 0 ? (
                                <div className="extension-empty-logs">No output yet.</div>
                            ) : (
                                arduinoLogs.map((log, i) => (
                                    <div key={i} className={`extension-log-line ${log.isError ? 'error' : ''}`}>
                                        {log.text}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExtensionManagerModal;
