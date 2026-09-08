import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Paperclip, X, Settings2, Sparkles, Loader2, Bot, User, Trash2 } from 'lucide-react';
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

export default function AIStudio() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('あなたは親切で有能なAIアシスタントです。');
  const [showSettings, setShowSettings] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const generatePersonalPrompt = async () => {
    if (!input.trim()) {
      alert("入力欄に「〇〇なプロンプトを作って」のように書いてからボタンを押してください。");
      return;
    }
    setLoading(true);
    try {
      const promptRequest = [
        {
          role: 'user',
          parts: [{ text: `以下の要件に基づいて、AIアシスタントの強力なシステムプロンプト（指示書）を作成してください。出力はプロンプトの本文のみとしてください。\n要件: ${input}` }]
        }
      ];
      const res = await fetch('/api/aistudio/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: promptRequest })
      });
      const data = await res.json();
      if (data.text) {
        setSystemPrompt(data.text);
        setInput('');
        setShowSettings(true);
      }
    } catch (err) {
      console.error(err);
      alert("プロンプト生成に失敗しました。");
    } finally {
      setLoading(false);
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
    
    setMessages(updatedMessages);
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
          systemInstruction: systemPrompt
        })
      });
      
      if (!res.ok) throw new Error("API Request failed");
      
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'エラーが発生しました。もう一度お試しください。' }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] text-gray-900 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-[2px] shadow-sm">
            <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 tracking-tight">
            Gemini Studio
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setMessages([])}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="チャットをクリア"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-colors ${showSettings ? 'text-purple-600 bg-purple-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Settings / System Prompt Area */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-gray-200 bg-white shadow-sm"
          >
            <div className="p-6 max-w-4xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-widest flex items-center gap-2">
                  <Bot className="w-4 h-4" /> System Instructions (パーソナルプロンプト)
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-gray-500">AIの役割や口調、振る舞いのルールを設定できます。</p>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-800 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none min-h-[120px]"
                placeholder="AIへの指示を記述してください..."
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
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
      <div className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-[#F8F9FA] via-[#F8F9FA]/90 to-transparent pt-10 pb-6 px-4">
        <div className="max-w-4xl mx-auto relative">
          
          {/* Action Buttons above input */}
          <div className="flex gap-2 mb-3">
             <button
               onClick={generatePersonalPrompt}
               disabled={loading || !input.trim()}
               className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-purple-50 text-xs font-semibold text-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 shadow-xs hover:border-purple-300"
             >
               <Sparkles className="w-3.5 h-3.5 text-purple-600" />
               パーソナルプロンプト自動生成
             </button>
          </div>

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
            Gemini は不正確な情報を表示する場合があります。
          </div>
        </div>
      </div>
    </div>
  );
}
