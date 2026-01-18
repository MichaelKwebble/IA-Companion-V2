import React, { useState, useMemo } from 'react';
import { MessageSquare, Plus, Send, ChevronLeft, Edit2, GitMerge, Bot } from 'lucide-react';
import './ChatWorkspace.css';
import FlowMap from './FlowMap';
import { parseCodeToFlow } from '../../../../utils/codeFlowParser';

interface ChatSession {
    id: string;
    title: string;
    date: string;
}

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const MOCK_CHATS: ChatSession[] = [
    { id: '1', title: 'Debugging Main Loop', date: 'Today' },
    { id: '2', title: 'Sensor Integration Help', date: 'Yesterday' },
    { id: '3', title: 'Library Setup', date: '2 days ago' },
];

interface ChatWorkspaceProps {
    isDesignMode?: boolean;
    code?: string;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ isDesignMode = false, code = '' }) => {
    const [mode, setMode] = useState<'agents' | 'flow'>('agents');

    // Parse code to generate flowchart data
    const flowData = useMemo(() => {
        if (!code || code.trim() === '') {
            return { nodes: [], edges: [] };
        }
        return parseCodeToFlow(code);
    }, [code]);
    const [chats, setChats] = useState<ChatSession[]>(MOCK_CHATS);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'user', content: 'How do I read from the analog pin?' },
        { id: '2', role: 'assistant', content: 'You can use the `analogRead(pin)` function. For example: `int val = analogRead(A0);`' },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [editingChatId, setEditingChatId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const handleNewChat = () => {
        const newId = Math.random().toString(36).substr(2, 9);
        const newChat: ChatSession = { id: newId, title: 'New Chat', date: 'Just now' };
        setChats([newChat, ...chats]);
        setActiveChatId(newId);
        setMessages([]);
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newMessage: Message = {
            id: Math.random().toString(36).substr(2, 9),
            role: 'user',
            content: inputValue
        };

        setMessages([...messages, newMessage]);
        setInputValue('');

        // Mock AI response
        setTimeout(() => {
            const aiResponse: Message = {
                id: Math.random().toString(36).substr(2, 9),
                role: 'assistant',
                content: 'This is a mock response. In the real app, this would call Gemini.'
            };
            setMessages(prev => [...prev, aiResponse]);
        }, 1000);
    };

    const startRenaming = (chat: ChatSession, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingChatId(chat.id);
        setEditTitle(chat.title);
    };

    const saveRename = () => {
        if (editingChatId) {
            setChats(chats.map(c => c.id === editingChatId ? { ...c, title: editTitle } : c));
            setEditingChatId(null);
        }
    };

    const activeChat = chats.find(c => c.id === activeChatId);

    return (
        <div className="chat-workspace">
            {/* Mode Toggle Header - Only show in Code Mode */}
            {!isDesignMode && (
                <div className="workspace-mode-toggle">
                    <button
                        className={`mode-btn ${mode === 'agents' ? 'active' : ''}`}
                        onClick={() => setMode('agents')}
                    >
                        <Bot size={14} /> Agents
                    </button>
                    <button
                        className={`mode-btn ${mode === 'flow' ? 'active' : ''}`}
                        onClick={() => setMode('flow')}
                    >
                        <GitMerge size={14} /> Flow Map
                    </button>
                </div>
            )}

            {mode === 'flow' ? (
                <FlowMap nodes={flowData.nodes} edges={flowData.edges} />
            ) : (
                <>
                    {activeChatId && activeChat ? (
                        <div className="chat-view single-view">
                            <div className="chat-header">
                                <button className="back-btn" onClick={() => setActiveChatId(null)}>
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="header-title">{activeChat.title}</span>
                            </div>

                            <div className="chat-messages">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`message ${msg.role}`}>
                                        <div className="message-bubble">
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <form className="chat-input-area" onSubmit={handleSendMessage}>
                                <input
                                    type="text"
                                    placeholder="Ask Gemini..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                />
                                <button type="submit" disabled={!inputValue.trim()}>
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="chat-list-view">
                            <div className="list-header">
                                <button className="new-chat-btn-full" onClick={handleNewChat}>
                                    <Plus size={16} /> New Chat
                                </button>
                            </div>
                            <div className="chat-list full-width">
                                {chats.map(chat => (
                                    <div
                                        key={chat.id}
                                        className="chat-item"
                                        onClick={() => setActiveChatId(chat.id)}
                                    >
                                        <div className="chat-item-icon"><MessageSquare size={20} /></div>
                                        <div className="chat-item-info">
                                            {editingChatId === chat.id ? (
                                                <input
                                                    type="text"
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    onBlur={saveRename}
                                                    onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="rename-input"
                                                />
                                            ) : (
                                                <span className="chat-title" onDoubleClick={(e) => startRenaming(chat, e)}>
                                                    {chat.title}
                                                </span>
                                            )}
                                            <span className="chat-date">{chat.date}</span>
                                        </div>
                                        {!editingChatId && (
                                            <button className="rename-btn" onClick={(e) => startRenaming(chat, e)}>
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ChatWorkspace;
