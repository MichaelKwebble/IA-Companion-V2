import React from 'react';
import { Layers, Eye, Lock, ChevronDown } from 'lucide-react';
import './LayerManager.css';


const LayerItem = ({ layer, depth = 0 }: { layer: any, depth?: number }) => {
    return (
        <div className="layer-item-container">
            <div className="layer-row" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
                <div className="layer-controls">
                    {layer.children ? <ChevronDown size={12} /> : <div style={{ width: 12 }} />}
                    <Layers size={12} className="layer-icon" />
                </div>
                <span className="layer-name">{layer.name}</span>
                <div className="layer-actions">
                    <Lock size={10} className="action-icon" />
                    <Eye size={10} className="action-icon" />
                </div>
            </div>
            {layer.children && layer.expanded && (
                <div className="layer-children">
                    {layer.children.map((child: any) => (
                        <LayerItem key={child.id} layer={child} depth={depth + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

interface LayerManagerProps {
    layers: any[];
    selectedId: string | null;
    onSelect: (id: string | null) => void;
}

const LayerManager: React.FC<LayerManagerProps> = ({ layers, selectedId, onSelect }) => {
    return (
        <div className="layer-manager">
            <div className="layer-header">
                <span>Layers</span>
            </div>
            <div className="layer-list">
                {layers.map(layer => (
                    <div
                        key={layer.id}
                        className={`layer-item-container ${selectedId === layer.id ? 'selected' : ''}`}
                        onClick={() => onSelect(layer.id)}
                    >
                        <div className="layer-row" style={{ paddingLeft: '8px' }}>
                            <div className="layer-controls">
                                <div style={{ width: 12 }} />
                                <Layers size={12} className="layer-icon" />
                            </div>
                            <span className="layer-name">{layer.name || layer.type}</span>
                            <div className="layer-actions">
                                <Lock size={10} className="action-icon" />
                                <Eye size={10} className="action-icon" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LayerManager;
