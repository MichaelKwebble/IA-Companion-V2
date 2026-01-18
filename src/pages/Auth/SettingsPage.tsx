import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, User, Bell, Lock, Settings, Users, CreditCard } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/UI/Button';
import './SettingsPage.css';

const EMOJI_OPTIONS = ['👤', '👨‍💻', '👩‍💻', '🚀', '🛠️', '⚙️', '⚡', '🤖', '🎨', '🎮', '💡', '🔥'];
const COLOR_OPTIONS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#1f2937', // gray-800
    '#374151', // gray-700
];

const SettingsPage: React.FC = () => {
    const { user, profile, updateUserProfile } = useAuth();
    const navigate = useNavigate();

    const [nickname, setNickname] = useState(profile?.nickname || '');
    const [emoji, setEmoji] = useState(profile?.emoji || '👤');
    const [bgColor, setBgColor] = useState(profile?.bgColor || '#3b82f6');
    const [showPicker, setShowPicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSave = async () => {
        setIsSaving(true);
        setMessage({ type: '', text: '' });
        try {
            await updateUserProfile({ nickname, emoji, bgColor });
            setMessage({ type: 'success', text: 'Saved' });
            setTimeout(() => setMessage({ type: '', text: '' }), 2000);
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="linear-settings-layout">
            <aside className="settings-sidebar">
                <div className="sidebar-header">
                    <button className="back-link" onClick={() => navigate(-1)}>
                        <ArrowLeft size={14} /> Back to app
                    </button>
                </div>

                <div className="sidebar-section">
                    <div className="section-title">Account</div>
                    <button className="sidebar-item active">
                        <User size={16} className="sidebar-icon" /> Profile
                    </button>
                    <button className="sidebar-item disabled">
                        <Bell size={16} className="sidebar-icon" /> Notifications
                    </button>
                    <button className="sidebar-item disabled">
                        <Lock size={16} className="sidebar-icon" /> Security & access
                    </button>
                </div>

                <div className="sidebar-section">
                    <div className="section-title">Workspace</div>
                    <button className="sidebar-item disabled">
                        <Settings size={16} className="sidebar-icon" /> General
                    </button>
                    <button className="sidebar-item disabled">
                        <Users size={16} className="sidebar-icon" /> Members
                    </button>
                    <button className="sidebar-item disabled">
                        <CreditCard size={16} className="sidebar-icon" /> Billing
                    </button>
                </div>
            </aside>

            <main className="settings-content">
                <div className="content-container">
                    <header className="content-header">
                        <h1>Profile</h1>
                    </header>

                    <div className="settings-form">
                        <div className="form-row">
                            <div className="row-label">
                                <label>Profile picture</label>
                            </div>
                            <div className="row-value">
                                <div className="avatar-picker-trigger">
                                    <button
                                        className="current-avatar"
                                        style={{ backgroundColor: bgColor }}
                                        onClick={() => setShowPicker(!showPicker)}
                                    >
                                        <span className="emoji">{emoji}</span>
                                    </button>

                                    {showPicker && (
                                        <div className="picker-popover">
                                            <div className="popover-section">
                                                <div className="popover-title">Emoji</div>
                                                <div className="emoji-grid-mini">
                                                    {EMOJI_OPTIONS.map(e => (
                                                        <button
                                                            key={e}
                                                            className={`emoji-btn-mini ${emoji === e ? 'active' : ''}`}
                                                            onClick={() => setEmoji(e)}
                                                        >
                                                            {e}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="popover-section">
                                                <div className="popover-title">Color</div>
                                                <div className="color-grid-mini">
                                                    {COLOR_OPTIONS.map(c => (
                                                        <button
                                                            key={c}
                                                            className={`color-btn-mini ${bgColor === c ? 'active' : ''}`}
                                                            style={{ backgroundColor: c }}
                                                            onClick={() => setBgColor(c)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="row-label">
                                <label>Email</label>
                            </div>
                            <div className="row-value">
                                <input
                                    type="text"
                                    className="linear-input disabled"
                                    value={user?.email || ''}
                                    readOnly
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="row-label">
                                <label>Nickname</label>
                                <span className="label-desc">Display name</span>
                            </div>
                            <div className="row-value">
                                <input
                                    type="text"
                                    className="linear-input"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    placeholder="Your nickname"
                                />
                            </div>
                        </div>

                        <div className="form-actions">
                            {message.text && (
                                <span className={`save-message ${message.type}`}>{message.text}</span>
                            )}
                            <Button
                                variant="primary"
                                onClick={handleSave}
                                isLoading={isSaving}
                            >
                                Update profile
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SettingsPage;
