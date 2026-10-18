import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_API_URL || 'http://localhost:5001';

const GXAgentDrawer = () => {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Load persisted chat history from localStorage
    const [messages, setMessages] = useState(() => {
        try {
            const stored = localStorage.getItem('fit_cloth_gx_chat');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (e) {
            console.warn('Failed to parse saved chat history:', e);
        }
        return [
            {
                id: 1,
                sender: 'gx',
                text: "SYSTEM ONLINE // I am GX, your bespoke proportion & styling AI.\n\nAsk me for styling recommendations, custom garment advice, or budget-friendly options tailored to your silhouette!",
                products: [],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ];
    });

    const messagesEndRef = useRef(null);

    // Auto-scroll to latest message
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, isLoading]);

    // Persist messages to localStorage on change
    useEffect(() => {
        try {
            localStorage.setItem('fit_cloth_gx_chat', JSON.stringify(messages));
        } catch (e) {
            console.warn('Failed to save chat to localStorage:', e);
        }
    }, [messages]);

    // Clear chat history handler
    const handleClearChat = () => {
        const resetMessages = [
            {
                id: Date.now(),
                sender: 'gx',
                text: "SYSTEM RESET // Chat history cleared. How can I assist you with custom styling or proportion matching?",
                products: [],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
        ];
        setMessages(resetMessages);
        try {
            localStorage.removeItem('fit_cloth_gx_chat');
        } catch {}
    };

    // Query RAG Agent via Express backend
    const queryRAGAgent = async (userPrompt) => {
        setIsLoading(true);

        // Optional price extraction for max_price filter
        const priceMatch = userPrompt.match(/(?:under|below|less than|budget of)\s*(?:rs\.?|inr|₹)?\s*(\d+)/i);
        const maxPrice = priceMatch ? parseFloat(priceMatch[1]) : undefined;

        try {
            const res = await fetch(`${API_BASE_URL}/api/ai/chat?stream=true`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream, application/json'
                },
                body: JSON.stringify({
                    message: userPrompt.trim(),
                    max_price: maxPrice,
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP error ${res.status}`);
            }

            const contentType = res.headers.get('content-type') || '';
            const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            if (contentType.includes('text/event-stream') && res.body) {
                const replyId = Date.now() + 1;
                let replyText = '';
                let replyProducts = [];

                // Create initial placeholder message
                setMessages((prev) => [
                    ...prev,
                    {
                        id: replyId,
                        sender: 'gx',
                        text: '',
                        products: [],
                        model: 'gemma',
                        time: currentTime,
                    },
                ]);

                const reader = res.body.getReader();
                const decoder = new TextDecoder('utf-8');
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const event = JSON.parse(line.slice(6));
                                if (event.type === 'token') {
                                    replyText += event.text;
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === replyId ? { ...m, text: replyText } : m
                                        )
                                    );
                                } else if (event.type === 'products') {
                                    replyProducts = event.products || [];
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === replyId ? { ...m, products: replyProducts } : m
                                        )
                                    );
                                }
                            } catch {}
                        }
                    }
                }

                // If text is still empty after stream ends, ensure fallback is displayed
                if (!replyText.trim()) {
                    const fallback = replyProducts.length > 0
                        ? "Here are our top recommended bespoke garments tailored to your request:"
                        : "Hello! Welcome to Fit Cloths. How can I assist you with custom fit or styling today?";
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === replyId ? { ...m, text: fallback, products: replyProducts } : m
                        )
                    );
                }
            } else {
                const data = await res.json();
                const gxReply = {
                    id: Date.now() + 1,
                    sender: 'gx',
                    text: data.reply || "I couldn't generate a response for that query.",
                    products: Array.isArray(data.products) ? data.products : [],
                    model: data.model || 'gemma',
                    time: currentTime,
                };
                setMessages((prev) => [...prev, gxReply]);
            }
        } catch (err) {
            console.error('GX RAG Agent Error:', err);
            const errorReply = {
                id: Date.now() + 1,
                sender: 'gx',
                text: `[ GX RAG SERVICE NOTICE ]: ${err.message || 'The AI service is temporarily unavailable. Check that the RAG API and Ollama are running.'}`,
                isError: true,
                products: [],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
            setMessages((prev) => [...prev, errorReply]);
        } finally {
            setIsLoading(false);
        }
    };

    // Listen for external trigger to open GX Agent with input/measurements
    useEffect(() => {
        const handleOpenGX = (event) => {
            const { prompt, autoSend } = event.detail || {};
            setIsOpen(true);
            if (prompt) {
                if (autoSend) {
                    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const userMsg = {
                        id: Date.now(),
                        sender: 'user',
                        text: prompt,
                        time: currentTime,
                    };
                    setMessages((prev) => [...prev, userMsg]);
                    queryRAGAgent(prompt);
                } else {
                    setInput(prompt);
                }
            }
        };

        window.addEventListener('open_gx_agent', handleOpenGX);
        return () => window.removeEventListener('open_gx_agent', handleOpenGX);
    }, []);

    // Handle User Send Form
    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userPrompt = input.trim();
        const userMsg = {
            id: Date.now(),
            sender: 'user',
            text: userPrompt,
            time: currentTime,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        queryRAGAgent(userPrompt);
    };

    return (
        <>
            {/* ==========================================
                1. FLOATING CIRCULAR TOGGLE BUTTON (BOTTOM-RIGHT)
            ========================================== */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 active:scale-95 transition-all flex items-center justify-center cursor-pointer group"
                title="Open GX Assistant"
            >
                {isOpen ? (
                    <span className="font-mono font-black text-lg text-white">✕</span>
                ) : (
                    <span className="font-mono font-black text-base tracking-wider text-white group-hover:scale-105 transition-transform select-none">
                        GX
                    </span>
                )}
            </button>

            {/* ==========================================
                2. SIDEBAR OVERLAY / DRAWER PANEL
            ========================================== */}
            {isOpen && (
                <div
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity"
                />
            )}

            {/* Drawer Container */}
            <div
                className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[450px] bg-[#f7f6f0] border-l-2 border-black flex flex-col justify-between shadow-[-8px_0px_0px_0px_rgba(0,0,0,1)] transition-transform duration-300 ease-in-out font-sans ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Drawer Header */}
                <div className="p-4 bg-black text-white border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center font-mono font-black text-xs text-white border border-white shadow-[1px_1px_0px_0px_rgba(255,255,255,0.5)]">
                            GX
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-mono font-black text-sm uppercase tracking-wider text-white">
                                    GX // RAG STYLING AGENT
                                </h3>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            </div>
                            <p className="text-[9.5px] font-mono text-neutral-400 uppercase tracking-widest">
                                [ GEMMA 2B • 384-D SEMANTIC SEARCH ]
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleClearChat}
                            className="text-[10px] font-mono text-neutral-300 hover:text-red-400 px-2 py-1 border border-white/20 hover:border-red-400 transition-colors cursor-pointer uppercase font-bold"
                            title="Clear conversation history"
                        >
                            [ CLEAR ]
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="text-neutral-400 hover:text-white font-mono text-sm px-2 py-1 border border-white/20 hover:border-white cursor-pointer uppercase"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Message Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${
                                msg.sender === 'user' ? 'items-end' : 'items-start'
                            }`}
                        >
                            {/* Sender Tag & Timestamp */}
                            <div className="flex items-center gap-2 mb-1 text-[9px] text-black/50 uppercase tracking-wider">
                                <span>{msg.sender === 'user' ? 'YOU' : 'GX RAG ENGINE'}</span>
                                <span>•</span>
                                <span>{msg.time}</span>
                            </div>

                            {/* Message Bubble */}
                            <div
                                className={`max-w-[92%] p-3.5 border-2 border-black ${
                                    msg.sender === 'user'
                                        ? 'bg-black text-white shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]'
                                        : msg.isError
                                        ? 'bg-red-50 text-red-900 border-red-600 shadow-[3px_3px_0px_0px_rgba(239,68,68,1)]'
                                        : 'bg-white text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]'
                                }`}
                            >
                                {msg.sender === 'gx' && !msg.text ? (
                                    <div className="flex items-center gap-2 text-neutral-500 font-mono text-[11px] py-0.5">
                                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping"></span>
                                        <span className="tracking-wider">CURATING STYLING ADVICE...</span>
                                    </div>
                                ) : (
                                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                )}

                                {/* Cool Product Recommendations Section with Direct Links */}
                                {Array.isArray(msg.products) && msg.products.length > 0 && (
                                    <div className="mt-3.5 pt-3 border-t-2 border-black/20 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                                ✦ RECOMMENDED GARMENTS ({msg.products.length})
                                            </span>
                                            <span className="text-[9px] text-neutral-500 uppercase font-bold">CLICK TO VIEW</span>
                                        </div>

                                        <div className="space-y-2">
                                            {msg.products.map((prod, pIdx) => {
                                                const prodImg =
                                                    (Array.isArray(prod.image_urls) && prod.image_urls[0]) ||
                                                    prod.image_url ||
                                                    'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=600&q=80';
                                                const prodId = prod.id || prod.product_id || prod.product_code;
                                                const priceFormatted = `₹${Number(prod.price_inr || prod.price || 0).toLocaleString('en-IN')}`;

                                                return (
                                                    <div
                                                        key={pIdx}
                                                        onClick={() => {
                                                            if (prodId) {
                                                                navigate(`/cloth?id=${prodId}`);
                                                                setIsOpen(false);
                                                            }
                                                        }}
                                                        className="p-2.5 bg-[#f7f6f0] border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(249,115,22,1)] hover:border-black transition-all flex gap-3 items-center group cursor-pointer"
                                                    >
                                                        {/* Thumbnail */}
                                                        <div className="w-16 h-18 bg-white border border-black flex-shrink-0 overflow-hidden flex items-center justify-center p-0.5">
                                                            <img
                                                                src={prodImg}
                                                                alt={prod.name}
                                                                className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                                                                onError={(e) => {
                                                                    e.target.src =
                                                                        'https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?auto=format&fit=crop&w=600&q=80';
                                                                }}
                                                            />
                                                        </div>

                                                        {/* Details */}
                                                        <div className="flex-1 min-w-0 space-y-1">
                                                            <div className="flex items-center justify-between gap-1">
                                                                <span className="text-[9px] font-bold uppercase bg-black text-white px-1.5 py-0.5 select-none truncate max-w-[130px]">
                                                                    {prod.category || 'BESPOKE'}
                                                                </span>
                                                                <span className="text-xs font-black text-black">
                                                                    {priceFormatted}
                                                                </span>
                                                             </div>

                                                            <h4 className="text-xs font-bold uppercase tracking-tight text-black truncate group-hover:text-orange-600 transition-colors">
                                                                {prod.name}
                                                            </h4>

                                                            {prod.fit_type && (
                                                                <p className="text-[9px] text-neutral-500 uppercase truncate">
                                                                    FIT: {prod.fit_type}
                                                                </p>
                                                            )}

                                                            {/* Action Link */}
                                                            <div className="pt-0.5 flex items-center gap-1 text-[9.5px] font-bold text-orange-600 group-hover:translate-x-1 transition-transform">
                                                                <span>VIEW BESPOKE GARMENT</span>
                                                                <span>→</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Sleek Universal Loading Bubble */}
                    {isLoading && (
                        <div className="flex flex-col items-start space-y-1 animate-fadeIn">
                            <div className="flex items-center gap-2 text-[9px] text-black/50 uppercase tracking-wider">
                                <span>GX ASSISTANT</span>
                                <span>•</span>
                                <span className="text-emerald-700 font-bold">TYPING</span>
                            </div>
                            <div className="px-4 py-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center gap-2.5">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-black animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 rounded-full bg-black animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 rounded-full bg-black animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                                <span className="text-[11px] font-mono text-neutral-500">GX is thinking...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Footer */}
                <form
                    onSubmit={handleSend}
                    className="p-3.5 bg-white border-t-2 border-black flex items-center gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isLoading}
                        placeholder={isLoading ? "GX is typing..." : "Ask GX about fit, sizing, or styling..."}
                        className="flex-1 bg-[#f7f6f0] border-2 border-black py-3 px-3 text-xs font-mono uppercase placeholder:text-black/40 focus:outline-none disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="bg-black text-white border-2 border-black px-4 py-3 font-mono font-bold text-xs uppercase tracking-wider hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-black transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center gap-1.5"
                    >
                        {isLoading ? (
                            <span className="animate-pulse">...</span>
                        ) : (
                            <>
                                <span>SEND</span>
                                <span>→</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </>
    );
};

export default GXAgentDrawer;