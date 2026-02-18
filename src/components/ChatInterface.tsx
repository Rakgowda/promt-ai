import React, { useState, useRef, useEffect } from 'react';
import { type Message, usePromptAPI } from '../hooks/usePromptAPI';
import StatusBanner from './StatusBanner';

const ChatInterface: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { status, sendMessage, error, downloadProgress } = usePromptAPI();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!inputValue.trim() || status !== 'ready') return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: inputValue.trim(),
            timestamp: new Date(),
        };

        const aiMessageId = (Date.now() + 1).toString();
        const initialAiMessage: Message = {
            id: aiMessageId,
            role: 'ai',
            text: '',
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage, initialAiMessage]);
        setInputValue('');
        setIsTyping(true);

        try {
            await sendMessage(userMessage.text, (chunk) => {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId ? { ...msg, text: chunk } : msg
                    )
                );
            });
        } catch (err: any) {
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === aiMessageId
                        ? { ...msg, text: 'Error: Failed to get response from AI.' }
                        : msg
                )
            );
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="app-container">
            <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em' }}>
                    Chrome <span style={{ color: 'var(--accent-color)' }}>AI Chat</span>
                </h1>
                <StatusBanner status={status} error={error} downloadProgress={downloadProgress} />
            </header>

            <main className="messages-container">
                {messages.length === 0 && (
                    <div className="message status">
                        The on-device Gemini Nano model is ready to assist you.
                    </div>
                )}
                {messages.map((msg) => (
                    <div key={msg.id} className={`message ${msg.role}`}>
                        {msg.text}
                    </div>
                ))}
                {isTyping && (
                    <div className="message ai">
                        <div className="typing-indicator">
                            <div className="dot"></div>
                            <div className="dot"></div>
                            <div className="dot"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </main>

            <footer className="chat-footer glass-panel">
                <div className="input-wrapper">
                    <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={status === 'ready' ? "Type a prompt..." : "AI is initializing..."}
                        disabled={status !== 'ready'}
                        rows={1}
                    />
                    <button
                        className="send-button"
                        onClick={handleSend}
                        disabled={status !== 'ready' || !inputValue.trim() || isTyping}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center' }}>
                    Powered by Gemini Nano • On-Device AI
                </p>
            </footer>
        </div>
    );
};

export default ChatInterface;
