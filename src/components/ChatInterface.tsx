import React, { useState, useRef, useEffect } from 'react';
import { type Message, usePromptAPI } from '../hooks/usePromptAPI';
import StatusBanner from './StatusBanner';

type RoleType = 'general' | 'fitness' | 'email' | 'js_testing' | 'weather';

const ROLE_PROMPTS: Record<RoleType, string> = {
    general: 'You are a polite, helpful, and friendly assistant. Always aim to provide clear and courteous responses.',
    fitness: 'You are a professional and supportive fitness coach and nutritionist. Provide expert advice on exercise, diet, and healthy living in a polite manner. If the user asks a question that is NOT related to fitness, exercise, diet, or health, please gracefully decline and let them know you specialize in fitness and health topics.',
    email: 'You are a professional email drafting assistant. ONLY respond to email-related requests. Always provide a full email example. Provide the email example directly without any introductory or concluding remarks (no sugar coating). If the query is not about emails, simply state that you only handle email questions.',
    js_testing: 'You are a JavaScript code generator. Your task is to translate user instructions into executable JavaScript code. ONLY output the valid JavaScript code itself, no explanations, no markdown blocks, no sugar coating.\n\nExamples:\n- User: show prompt with message "hello"\n- System: window.prompt("hello")\n- User: alert "Welcome"\n- System: window.alert("Welcome")\n- User: console log the window height\n- System: console.log(window.innerHeight)\n',
    weather: 'You are a weather assistant. Your task is to extract the city name from the user\'s request. ONLY output the name of the city, nothing else. No punctuation, no filler words, no sugar coating.\n\nExamples:\n- User: What is the weather in London?\n- System: London\n- User: How is the weather in New York today?\n- System: New York\n- User: Show me weather for Mumbai\n- System: Mumbai\n'
};

const ChatInterface: React.FC = () => {
    const executeJavaScript = (code: string) => {
        try {
            // Remove markdown code blocks if the AI accidentally includes them
            const cleanCode = code.replace(/```javascript|```js|```/g, '').trim();
            const func = new Function(cleanCode);
            func();
        } catch (err) {
            console.error('Failed to execute JS:', err);
        }
    };

    const fetchWeatherReport = async (city: string) => {
        try {
            const response = await fetch(`https://wttr.in/${encodeURIComponent(city.trim())}?format=%c+%t`);
            if (response.ok) {
                return await response.text();
            }
            return "Sorry, I couldn't find the weather for that location.";
        } catch (err) {
            console.error('Failed to fetch weather:', err);
            return "Error: Failed to fetch weather data.";
        }
    };

    const [role, setRole] = useState<RoleType>('general');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { status, sendMessage, error, downloadProgress } = usePromptAPI(ROLE_PROMPTS[role]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Reset messages when role changes
    useEffect(() => {
        setMessages([]);
    }, [role]);

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setIsTyping(false);
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || status !== 'ready' || isTyping) return;

        const controller = new AbortController();
        setAbortController(controller);

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

        let accumulatedText = '';
        try {
            await sendMessage(userMessage.text, (chunk) => {
                accumulatedText = chunk;
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId ? { ...msg, text: chunk } : msg
                    )
                );
            }, controller.signal);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Generation aborted');
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId
                            ? { ...msg, text: msg.text + ' [Generation stopped]' }
                            : msg
                    )
                );
            } else {
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === aiMessageId
                            ? { ...msg, text: 'Error: Failed to get response from AI.' }
                            : msg
                    )
                );
            }
        } finally {
            setIsTyping(false);
            setAbortController(null);

            // Handle JS execution or Weather fetching based on role
            if (accumulatedText) {
                if (role === 'js_testing') {
                    executeJavaScript(accumulatedText);
                } else if (role === 'weather') {
                    const city = accumulatedText.trim();
                    // Show fetching state
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === aiMessageId ? { ...msg, text: `Fetching weather info for ${city}...` } : msg
                        )
                    );

                    const weatherData = await fetchWeatherReport(city);
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === aiMessageId ? { ...msg, text: `Weather for ${city}: ${weatherData}` } : msg
                        )
                    );
                }
            }
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
            <header className="glass-panel main-header">
                <div className="header-top">
                    <h1 className="logo">
                        Chrome <span className="accent">AI Chat</span>
                    </h1>
                    <StatusBanner status={status} error={error} downloadProgress={downloadProgress} />
                </div>

                <div className="role-selector-container">
                    <label htmlFor="role-select">Persona:</label>
                    <select
                        id="role-select"
                        value={role}
                        onChange={(e) => setRole(e.target.value as RoleType)}
                        disabled={status === 'loading'}
                    >
                        <option value="general">Default Assistant</option>
                        <option value="fitness">Fitness Expert</option>
                        <option value="email">Email Writer</option>
                        <option value="js_testing">JS Testing</option>
                        <option value="weather">Weather Assistant</option>
                    </select>
                </div>
            </header>

            <main className="messages-container">
                {messages.length === 0 && (
                    <div className="message status">
                        {status === 'ready'
                            ? `The AI has been configured as a ${role.replace(/^\w/, c => c.toUpperCase())}. How can it help you?`
                            : "Initializing AI models..."
                        }
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
                    {isTyping ? (
                        <button
                            className="stop-button"
                            onClick={handleStop}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="6" y="6" width="12" height="12"></rect>
                            </svg>
                        </button>
                    ) : (
                        <button
                            className="send-button"
                            onClick={handleSend}
                            disabled={status !== 'ready' || !inputValue.trim()}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    )}
                </div>
                <p className="footer-credits">
                    Powered by Gemini Nano • On-Device AI
                </p>
            </footer>
        </div>
    );
};

export default ChatInterface;
