import React from 'react';
import './PropertiesPanel.css';

const PropertiesPanel: React.FC = () => {
    return (
        <div className="properties-panel">
            <div className="panel-header">Properties</div>

            <div className="property-section">
                <div className="section-title">Layout</div>
                <div className="property-row">
                    <div className="property-input">
                        <label>X</label>
                        <input type="number" defaultValue={100} />
                    </div>
                    <div className="property-input">
                        <label>Y</label>
                        <input type="number" defaultValue={100} />
                    </div>
                </div>
                <div className="property-row">
                    <div className="property-input">
                        <label>W</label>
                        <input type="number" defaultValue={375} />
                    </div>
                    <div className="property-input">
                        <label>H</label>
                        <input type="number" defaultValue={812} />
                    </div>
                </div>
            </div>

            <div className="property-section">
                <div className="section-title">Appearance</div>
                <div className="property-row">
                    <div className="property-input full">
                        <label>Fill</label>
                        <div className="color-picker">
                            <div className="color-preview" style={{ backgroundColor: '#ffffff' }} />
                            <span>#FFFFFF</span>
                        </div>
                    </div>
                </div>
                <div className="property-row">
                    <div className="property-input full">
                        <label>Border</label>
                        <div className="color-picker">
                            <div className="color-preview" style={{ backgroundColor: '#e5e7eb' }} />
                            <span>#E5E7EB</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="property-section">
                <div className="section-title">AI Integration</div>
                <div className="property-row toggle-row">
                    <span>Create AI Chatbot</span>
                    <label className="toggle-switch">
                        <input type="checkbox" />
                        <span className="slider round"></span>
                    </label>
                </div>
                <p className="helper-text">Automatically generate a chatbot for this screen context.</p>
            </div>
        </div>
    );
};

export default PropertiesPanel;
