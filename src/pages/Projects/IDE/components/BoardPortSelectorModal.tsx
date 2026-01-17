import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Check, RefreshCw, Cpu, Usb, ChevronRight, Info } from 'lucide-react';

interface Board {
    name: string;
    fqbn: string;
}

interface Port {
    path: string;
    label?: string;
    manufacturer?: string;
    vendorId?: string;
    productId?: string;
}

interface BoardPortSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (board: Board | null, port: string | null, isProduct?: boolean) => void;
    initialBoard: Board | null;
    initialPort: string | null;
}

const BoardPortSelectorModal: React.FC<BoardPortSelectorModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    initialBoard,
    initialPort
}) => {
    const [boards, setBoards] = useState<Board[]>([]);
    const [ports, setPorts] = useState<Port[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBoard, setSelectedBoard] = useState<Board | null>(initialBoard);
    const [selectedPort, setSelectedPort] = useState<string | null>(initialPort);
    const [showAllPorts, setShowAllPorts] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const pollingInterval = useRef<any>(null);

    useEffect(() => {
        if (isOpen) {
            fetchBoards();
            fetchPorts();
            pollingInterval.current = setInterval(fetchPorts, 2000);
        } else {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        }
        return () => {
            if (pollingInterval.current) clearInterval(pollingInterval.current);
        };
    }, [isOpen]);

    const fetchBoards = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:3001/api/arduino/boards/listall');
            const data = await response.json();
            if (data.success && data.data.boards) {
                setBoards(data.data.boards.map((b: any) => ({
                    name: b.name,
                    fqbn: b.fqbn
                })));
            }
        } catch (error) {
            console.error('Failed to fetch boards:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPorts = async () => {
        try {
            const response = await fetch('http://localhost:3001/api/serial/ports');
            const data = await response.json();
            if (data.success) {
                const newPorts = data.ports.map((p: any) => ({
                    path: p.path,
                    label: p.friendlyName || p.path,
                    manufacturer: p.manufacturer,
                    vendorId: p.vendorId,
                    productId: p.productId
                }));
                setPorts(newPorts);
            }
        } catch (error) {
            console.error('Failed to fetch ports:', error);
        }
    };

    const filteredBoards = boards.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.fqbn.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleConfirm = () => {
        const selectedPortData = ports.find(p => p.path === selectedPort);
        const isProduct = selectedPortData ?
            parseInt(selectedPortData.vendorId || '', 16) === 12346 &&
            parseInt(selectedPortData.productId || '', 16) === 4097 : false;
        onSelect(selectedBoard, selectedPort, isProduct);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" style={styles.overlay} onClick={onClose}>
            <div className="modal-container" style={styles.container} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <div style={styles.headerLeft}>
                        <div style={styles.iconBox}>
                            <Cpu size={24} color="#2563eb" />
                        </div>
                        <div>
                            <h2 style={styles.title}>Select Board & Port</h2>
                            <p style={styles.subtitle}>
                                <Info size={14} style={{ marginRight: '6px' }} />
                                Configure your target hardware for compilation and upload.
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={styles.content}>
                    {/* Boards Section */}
                    <div style={styles.sectionLeft}>
                        <div style={styles.searchArea}>
                            <div style={styles.labelRow}>
                                <label style={styles.label}>Target Board</label>
                                {isLoading && <RefreshCw className="rotating-spin" size={14} color="#2563eb" />}
                            </div>
                            <div style={styles.searchWrapper}>
                                <Search size={18} style={styles.searchIcon} />
                                <input
                                    type="text"
                                    placeholder="Search board (e.g. Arduino Uno, ESP32...)"
                                    style={styles.searchInput}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="custom-scrollbar" style={styles.listArea}>
                            {filteredBoards.length > 0 ? (
                                filteredBoards.map(board => (
                                    <button
                                        key={board.fqbn}
                                        onClick={() => setSelectedBoard(board)}
                                        style={{
                                            ...styles.listItem,
                                            backgroundColor: selectedBoard?.fqbn === board.fqbn ? '#2563eb' : 'transparent',
                                            color: selectedBoard?.fqbn === board.fqbn ? '#fff' : '#374151'
                                        }}
                                    >
                                        <div style={{
                                            ...styles.listIconBox,
                                            backgroundColor: selectedBoard?.fqbn === board.fqbn ? 'rgba(255,255,255,0.2)' : '#f3f4f6'
                                        }}>
                                            <Cpu size={20} color={selectedBoard?.fqbn === board.fqbn ? '#fff' : '#6b7280'} />
                                        </div>
                                        <div style={styles.listText}>
                                            <div style={styles.itemName}>{board.name}</div>
                                            <div style={{
                                                ...styles.itemSub,
                                                color: selectedBoard?.fqbn === board.fqbn ? 'rgba(255,255,255,0.7)' : '#9ca3af'
                                            }}>
                                                {board.fqbn}
                                            </div>
                                        </div>
                                        {selectedBoard?.fqbn === board.fqbn ? (
                                            <Check size={18} color="#fff" />
                                        ) : (
                                            <ChevronRight size={16} color="#d1d5db" />
                                        )}
                                    </button>
                                ))
                            ) : !isLoading && (
                                <div style={styles.emptyState}>
                                    <Search size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p>No boards found matching "{searchQuery}"</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Ports Section */}
                    <div style={styles.sectionRight}>
                        <div style={styles.searchArea}>
                            <div style={styles.labelRow}>
                                <label style={styles.label}>Serial Port</label>
                                <div style={styles.liveBadge}>
                                    <div style={styles.liveDot} />
                                    <span style={styles.liveText}>Live</span>
                                </div>
                            </div>
                        </div>
                        <div className="custom-scrollbar" style={styles.listArea}>
                            {ports.length > 0 ? (
                                ports.map(port => {
                                    const isProduct = parseInt(port.vendorId || '', 16) === 12346 && parseInt(port.productId || '', 16) === 4097;
                                    return (
                                        <button
                                            key={port.path}
                                            onClick={() => {
                                                setSelectedPort(port.path);
                                                if (isProduct) {
                                                    setSelectedBoard({
                                                        name: 'IA Kit Pro',
                                                        fqbn: 'esp32:esp32:esp32s3:CDCOnBoot=cdc,USBMode=hwcdc,UploadMode=default,UploadSpeed=115200'
                                                    });
                                                }
                                            }}
                                            style={{
                                                ...styles.listItem,
                                                backgroundColor: selectedPort === port.path ? (isProduct ? '#2563eb' : '#0d9488') : '#fff',
                                                color: selectedPort === port.path ? '#fff' : '#374151',
                                                border: selectedPort === port.path ? 'none' : '1px solid #f3f4f6',
                                                boxShadow: selectedPort === port.path ? `0 4px 12px ${isProduct ? 'rgba(37,99,235,0.2)' : 'rgba(13,148,136,0.2)'}` : 'none',
                                                marginBottom: '8px'
                                            }}
                                        >
                                            <div style={{
                                                ...styles.listIconBox,
                                                backgroundColor: selectedPort === port.path ? 'rgba(255,255,255,0.2)' : (isProduct ? '#eff6ff' : '#f0fdfa')
                                            }}>
                                                {isProduct ? (
                                                    <Cpu size={20} color={selectedPort === port.path ? '#fff' : '#2563eb'} />
                                                ) : (
                                                    <Usb size={20} color={selectedPort === port.path ? '#fff' : '#0d9488'} />
                                                )}
                                            </div>
                                            <div style={styles.listText}>
                                                <div style={styles.itemName}>{isProduct ? 'IA Kit Pro' : port.path}</div>
                                                <div style={{
                                                    ...styles.itemSub,
                                                    color: selectedPort === port.path ? 'rgba(255,255,255,0.7)' : '#9ca3af'
                                                }}>
                                                    {isProduct ? port.path : (port.manufacturer || 'Generic Serial Device')}
                                                </div>
                                            </div>
                                            {selectedPort === port.path && <Check size={18} color="#fff" />}
                                        </button>
                                    );
                                })
                            ) : (
                                <div style={styles.emptyState}>
                                    <Usb size={40} style={{ opacity: 0.2, marginBottom: '12px' }} />
                                    <p style={{ fontWeight: 600 }}>No ports detected</p>
                                    <p style={{ fontSize: '12px', marginTop: '4px' }}>Connect your device via USB to see it here.</p>
                                </div>
                            )}
                        </div>
                        <div style={styles.footerOptions}>
                            <label style={styles.checkboxLabel}>
                                <input
                                    type="checkbox"
                                    checked={showAllPorts}
                                    onChange={(e) => setShowAllPorts(e.target.checked)}
                                    style={styles.checkbox}
                                />
                                <span style={styles.checkboxText}>Show all ports</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={styles.footer}>
                    <button onClick={onClose} style={styles.cancelBtn}>CANCEL</button>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedBoard || !selectedPort}
                        style={{
                            ...styles.confirmBtn,
                            backgroundColor: (!selectedBoard || !selectedPort) ? '#f3f4f6' : '#111827',
                            color: (!selectedBoard || !selectedPort) ? '#9ca3af' : '#fff',
                            cursor: (!selectedBoard || !selectedPort) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        CONFIRM SELECTION
                    </button>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
                .modal-overlay { animation: fadeIn 0.2s ease-out; }
                .modal-container { animation: zoomIn 0.2s ease-out; }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            `}</style>
        </div>
    );
};

const styles: { [key: string]: React.CSSProperties } = {
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(2px)',
    },
    container: {
        backgroundColor: '#fff',
        borderRadius: '16px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
        width: 'var(--modal-width-default)',
        maxWidth: 'var(--modal-max-width)',
        height: 'var(--modal-height-default)',
        maxHeight: 'var(--modal-max-height)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #f3f4f6',
    },
    header: {
        padding: '24px 32px',
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'between',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flex: 1,
    },
    iconBox: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        backgroundColor: '#eff6ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: '20px',
        fontWeight: 700,
        color: '#111827',
        margin: 0,
        letterSpacing: '-0.02em',
    },
    subtitle: {
        fontSize: '14px',
        color: '#6b7280',
        margin: '4px 0 0 0',
        display: 'flex',
        alignItems: 'center',
    },
    closeBtn: {
        padding: '10px',
        borderRadius: '10px',
        border: 'none',
        backgroundColor: 'transparent',
        color: '#9ca3af',
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    content: {
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: 'rgba(249, 250, 251, 0.3)',
    },
    sectionLeft: {
        flex: 1.2,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #f3f4f6',
        backgroundColor: '#fff',
    },
    sectionRight: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgba(249, 250, 251, 0.5)',
    },
    searchArea: {
        padding: '24px 24px 16px 24px',
    },
    labelRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px',
    },
    label: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
    },
    searchWrapper: {
        position: 'relative',
    },
    searchIcon: {
        position: 'absolute',
        left: '14px',
        top: '50%',
        transform: 'translateY(-50%)',
        color: '#9ca3af',
    },
    searchInput: {
        width: '100%',
        padding: '12px 16px 12px 44px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        fontSize: '14px',
        outline: 'none',
        transition: 'all 0.2s',
    },
    listArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '0 16px 24px 16px',
    },
    listItem: {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        padding: '14px 16px',
        borderRadius: '12px',
        textAlign: 'left',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s',
        marginBottom: '4px',
    },
    listIconBox: {
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '16px',
    },
    listText: {
        flex: 1,
        minWidth: 0,
    },
    itemName: {
        fontSize: '14px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    itemSub: {
        fontSize: '10px',
        fontFamily: 'monospace',
        marginTop: '2px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        color: '#9ca3af',
        textAlign: 'center',
    },
    liveBadge: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        backgroundColor: '#f0fdfa',
        borderRadius: '100px',
    },
    liveDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: '#14b8a6',
    },
    liveText: {
        fontSize: '10px',
        fontWeight: 700,
        color: '#0d9488',
        textTransform: 'uppercase',
    },
    footerOptions: {
        padding: '16px 24px',
        borderTop: '1px solid #f3f4f6',
    },
    checkboxLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        padding: '12px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #f3f4f6',
    },
    checkbox: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
    },
    checkboxText: {
        fontSize: '12px',
        fontWeight: 700,
        color: '#4b5563',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    footer: {
        padding: '24px 32px',
        borderTop: '1px solid #f3f4f6',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        backgroundColor: '#fff',
    },
    cancelBtn: {
        padding: '10px 24px',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
        backgroundColor: 'transparent',
        color: '#4b5563',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s',
    },
    confirmBtn: {
        padding: '10px 40px',
        borderRadius: '12px',
        border: 'none',
        fontSize: '14px',
        fontWeight: 700,
        transition: 'all 0.2s',
        boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
    }
};

export default BoardPortSelectorModal;
