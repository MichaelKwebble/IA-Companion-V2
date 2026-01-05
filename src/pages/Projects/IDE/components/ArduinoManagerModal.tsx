import React, { useState, useEffect, useRef } from 'react';
import { X, Cpu, Library, Package, Terminal as TerminalIcon, ChevronDown, ChevronUp } from 'lucide-react';
import BoardsManager from './BoardsManager';
import LibraryManager from './LibraryManager';
import { useDevice } from '../../../../context/DeviceContext';
import './ArduinoManagerModal.css';

interface ArduinoManagerModalProps {
    onClose: () => void;
}

const ArduinoManagerModal: React.FC<ArduinoManagerModalProps> = ({ onClose }) => {
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
        <div className="arduino-manager-overlay">
            <div className="arduino-manager-modal">
                <div className="arduino-modal-header">
                    <div className="arduino-header-left">
                        <Package size={20} className="arduino-header-icon" />
                        <h2>Arduino Manager</h2>
                    </div>
                    <button className="arduino-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="arduino-modal-tabs">
                    <button
                        className={`arduino-modal-tab ${activeTab === 'boards' ? 'active' : ''}`}
                        onClick={() => setActiveTab('boards')}
                    >
                        <Cpu size={16} /> Boards Manager
                    </button>
                    <button
                        className={`arduino-modal-tab ${activeTab === 'libraries' ? 'active' : ''}`}
                        onClick={() => setActiveTab('libraries')}
                    >
                        <Library size={16} /> Library Manager
                    </button>
                </div>

                <div className="arduino-modal-content">
                    {activeTab === 'boards' ? <BoardsManager /> : <LibraryManager />}
                </div>

                <div className={`arduino-console-panel ${isConsoleOpen ? 'open' : ''}`}>
                    <div className="arduino-console-header" onClick={() => setIsConsoleOpen(!isConsoleOpen)}>
                        <div className="arduino-console-title">
                            <TerminalIcon size={14} />
                            <span>Output Console</span>
                        </div>
                        {isConsoleOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </div>
                    {isConsoleOpen && (
                        <div className="arduino-console-output" ref={consoleOutputRef}>
                            {arduinoLogs.length === 0 ? (
                                <div className="arduino-empty-logs">No output yet.</div>
                            ) : (
                                arduinoLogs.map((log, i) => (
                                    <div key={i} className={`arduino-log-line ${log.isError ? 'error' : ''}`}>
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

export default ArduinoManagerModal;
