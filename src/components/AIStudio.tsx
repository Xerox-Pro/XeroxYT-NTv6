import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, X, Sparkles, Loader2, Bot, User, Trash2, Plus, MessageSquare, Menu, PanelLeftClose, PanelLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface FileData {
  file: File;
  previewUrl: string | null;
  base64: string;
}

interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface Message {
  role: 'user' | 'model';
  parts: MessagePart[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro' },
  { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

export default function AIStudio() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('gemini_chat_sessions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'default-1',
        title: '新しいチャット',
        messages: [],
        createdAt: Date.now(),
      }
    ];
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return sessions[0]?.id || 'default-1';
  });

  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash-lite');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('gemini_chat_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = (event.target?.result as string).split(',')[1];
        const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        setAttachments(prev => [...prev, { file, previewUrl, base64 }]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAttachments = [...prev];
      if (newAttachments[index].previewUrl) {
        URL.revokeObjectURL(newAttachments[index].previewUrl!);
      }
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新しいチャット',
      messages: [],
      createdAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setAttachments([]);
    setInput('');
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter(s => s.id !== id);
    if (updated.length === 0) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: '新しいチャット',
        messages: [],
        createdAt: Date.now(),
      };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions(updated);
      if (currentSessionId === id) {
        setCurrentSessionId(updated[0].id);
      }
    }
  };

  const clearCurrentChat = () => {
    const updated = sessions.filter(s => s.id !== currentSessionId);
    if (updated.length === 0) {
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: '新しいチャット',
        messages: [],
        createdAt: Date.now(),
      };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
    } else {
      setSessions(updated);
      setCurrentSessionId(updated[0].id);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const newParts: MessagePart[] = [];
    if (input.trim()) newParts.push({ text: input.trim() });
    
    attachments.forEach(att => {
      newParts.push({
        inlineData: { mimeType: att.file.type, data: att.base64 }
      });
    });

    const userMessage: Message = { role: 'user', parts: newParts };
    const updatedMessages = [...messages, userMessage];
    
    const titleText = input.trim() || '添付ファイル付きチャット';
    const currentTitle = messages.length === 0 ? (titleText.length > 20 ? titleText.slice(0, 20) + '...' : titleText) : currentSession.title;

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, title: currentTitle, messages: updatedMessages };
      }
      return s;
    }));

    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    setLoading(true);
    try {
      const res = await fetch('/api/aistudio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          systemInstruction: 'あなたは親切で有能なAIアシスタントです。',
          model: selectedModel
        })
      });
      
      if (!res.ok) throw new Error("API Request failed");
      
      const data = await res.json();
      const modelMessage: Message = { role: 'model', parts: [{ text: data.text }] };

      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, modelMessage] };
        }
        return s;
      }));
    } catch (err) {
      console.error(err);
      const errorMessage: Message = { role: 'model', parts: [{ text: 'エラーが発生しました。もう一度お試しください。' }] };
      setSessions(prev => prev.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, errorMessage] };
        }
        return s;
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-gray-900 font-sans overflow-hidden">
      
      {/* Sidebar for Chat History */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex flex-col border-r border-gray-200 bg-white z-20 shrink-0"
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <button 
                onClick={createNewChat}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 px-4 rounded-xl shadow-xs transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                新しいチャット
              </button>
              <button 
                onClick={() => setSidebarOpen(false)}
                className="ml-2 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="サイドバーを閉じる"
              >
                <PanelLeftClose className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 py-1">
                チャット履歴
              </div>
              {sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => setCurrentSessionId(session.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-sm transition-all ${
                    currentSessionId === session.id
                      ? 'bg-purple-50 text-purple-900 font-semibold border border-purple-200/60 shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <MessageSquare className={`w-4 h-4 shrink-0 ${currentSessionId === session.id ? 'text-purple-600' : 'text-gray-400'}`} />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded transition-opacity"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center">
              Xray Engine
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen min-w-0 bg-[#F8F9FA]">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-xs">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mr-1"
                title="サイドバーを開く"
              >
                <PanelLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-[2px] shadow-sm">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Xray
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Model Selector */}
            <div className="flex items-center bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_MODELS.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <button 
              onClick={clearCurrentChat}
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
              title="現在のチャットを削除"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat Messages */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8 pb-36">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-6">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-[0_10px_30px_rgba(168,85,247,0.2)]"
                >
                  <Sparkles className="w-12 h-12 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">こんにちは。</h2>
                  <p className="text-gray-500 text-lg">どのようなことについてお手伝いしましょうか？</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex-shrink-0 flex items-center justify-center mt-1 shadow-sm">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  
                  <div className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                      ? 'bg-purple-600 text-white rounded-tr-sm shadow-sm' 
                      : 'bg-white border border-gray-200/70 text-gray-800 rounded-tl-sm shadow-sm'
                  }`}>
                    {/* Images in User Message */}
                    {msg.parts.some(p => p.inlineData) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.parts.filter(p => p.inlineData).map((p, idx) => (
                          <div key={idx} className="relative group">
                            {p.inlineData?.mimeType.startsWith('image/') ? (
                              <img 
                                src={`data:${p.inlineData.mimeType};base64,${p.inlineData.data}`} 
                                alt="upload" 
                                className="w-32 h-32 object-cover rounded-xl border border-gray-200 shadow-xs"
                              />
                            ) : (
                              <div className="w-32 h-32 flex flex-col items-center justify-center bg-gray-100 rounded-xl border border-gray-200 text-xs text-gray-500 p-2 text-center">
                                <Paperclip className="w-8 h-8 mb-2 opacity-50" />
                                {p.inlineData?.mimeType || 'File'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Text Content */}
                    <div className={`prose max-w-none ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                      {msg.role === 'model' ? (
                        <ReactMarkdown>{msg.parts.find(p => p.text)?.text || ''}</ReactMarkdown>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.parts.find(p => p.text)?.text || ''}</div>
                      )}
                    </div>
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex-shrink-0 flex items-center justify-center mt-1 shadow-xs">
                      <User className="w-4 h-4 text-gray-600" />
                    </div>
                  )}
                </motion.div>
              ))
            )}

            {loading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-4 justify-start"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex-shrink-0 flex items-center justify-center mt-1 animate-pulse shadow-sm">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center space-x-1.5 p-4 bg-white border border-gray-200 rounded-2xl shadow-xs">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Input Area */}
        <div className="fixed bottom-0 right-0 left-0 bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent pt-10 pb-6 px-4 transition-all" style={{ left: sidebarOpen ? '280px' : '0px' }}>
          <div className="max-w-4xl mx-auto relative">
            <div className="relative flex flex-col bg-white border border-gray-200 rounded-3xl overflow-hidden focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-500/20 transition-all shadow-lg">
              
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex gap-3 p-3 overflow-x-auto border-b border-gray-100 bg-gray-50/50">
                  {attachments.map((att, i) => (
                    <div key={i} className="relative group shrink-0">
                      {att.previewUrl ? (
                        <img src={att.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-xl border border-gray-200 shadow-xs" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center border border-gray-200">
                          <Paperclip className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-end p-2.5 gap-2">
                <label className="p-3 text-gray-500 hover:text-gray-900 cursor-pointer rounded-full hover:bg-gray-100 transition-colors">
                  <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  <Paperclip className="w-5 h-5" />
                </label>

                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="メッセージを入力してください..."
                  className="flex-1 max-h-[200px] bg-transparent text-gray-900 placeholder-gray-400 resize-none py-3 px-1 focus:outline-none text-base"
                  rows={1}
                />

                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && attachments.length === 0) || loading}
                  className="p-3 m-1 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:bg-gray-200 disabled:text-gray-400 transition-colors shadow-sm"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="text-center mt-3 text-[11px] text-gray-400">
              Xray は不正確な情報を表示する場合があります。
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
