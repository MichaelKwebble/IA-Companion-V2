import React, { useState } from 'react';
import { Copy, ExternalLink, Search } from 'lucide-react';
import Button from '../../components/UI/Button';
import Input from '../../components/UI/Input';
import Badge from '../../components/UI/Badge';
import './UILibrary.css';

const UILibrary: React.FC = () => {
    const [activeSection, setActiveSection] = useState('All Components');

    const sections = [
        { title: 'Overview', items: [{ name: 'All Components' }] },
        { title: 'Buttons', items: [{ name: 'Button', badge: 'Updated' }, { name: 'ButtonGroup', badge: 'New' }, { name: 'CloseButton' }] },
        {
            title: 'Forms', items: [
                { name: 'Checkbox' },
                { name: 'CheckboxGroup' },
                { name: 'DateField', badge: 'New' },
                { name: 'Description' },
                { name: 'ErrorMessage', badge: 'New' },
                { name: 'Input', badge: 'Updated' },
                { name: 'SearchField', badge: 'New' }
            ]
        }
    ];

    return (
        <div className="ui-library-page">
            <aside className="ui-library-sidebar">
                {sections.map(section => (
                    <div key={section.title} className="sidebar-section">
                        <h3 className="section-title">{section.title}</h3>
                        <ul className="section-list">
                            {section.items.map(item => (
                                <li
                                    key={item.name}
                                    className={`section-item ${activeSection === item.name ? 'active' : ''}`}
                                    onClick={() => setActiveSection(item.name)}
                                >
                                    {item.name}
                                    {item.badge && <Badge variant={item.badge === 'New' ? 'primary' : 'neutral'}>{item.badge}</Badge>}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </aside>

            <main className="ui-library-content">
                <header className="library-header">
                    <div className="header-info">
                        <h1>{activeSection}</h1>
                        <p className="subtitle">Explore the full list of components available in the library. More are on the way.</p>
                    </div>
                    <div className="header-actions">
                        <Button variant="secondary" size="sm" leftIcon={<Copy size={14} />}>Copy Markdown</Button>
                        <Button variant="secondary" size="sm" rightIcon={<ExternalLink size={14} />}>Open</Button>
                    </div>
                </header>

                <section className="component-group">
                    <h2 className="group-title">Buttons</h2>
                    <div className="component-grid">
                        <div className="component-card">
                            <div className="preview-area">
                                <Button variant="primary" leftIcon={<Search size={16} />}>Search</Button>
                            </div>
                            <span className="component-name">Button</span>
                        </div>
                        <div className="component-card">
                            <div className="preview-area">
                                <div className="flex gap-sm">
                                    <Button variant="secondary" size="sm">Photos</Button>
                                    <Button variant="secondary" size="sm">Videos</Button>
                                    <Button variant="ghost" size="sm">...</Button>
                                </div>
                            </div>
                            <span className="component-name">ButtonGroup</span>
                        </div>
                    </div>
                </section>

                <section className="component-group">
                    <h2 className="group-title">Forms</h2>
                    <div className="component-grid">
                        <div className="component-card">
                            <div className="preview-area">
                                <Input placeholder="Type something..." />
                            </div>
                            <span className="component-name">Input</span>
                        </div>
                        <div className="component-card">
                            <div className="preview-area">
                                <Input
                                    label="Search"
                                    leftIcon={<Search size={16} />}
                                    placeholder="Search components..."
                                />
                            </div>
                            <span className="component-name">SearchField</span>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default UILibrary;
