import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Paperclip,
  X,
  Sparkles,
  Loader2,
  User,
  Trash2,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Copy,
  Check,
  ArrowLeft,
  Terminal,
  ExternalLink,
  Code
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { safeStorage } from '../services/safeStorage';

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
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash (高速・推奨)' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (高度な推論)' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (軽量)' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
];

/**
 * Enhanced CodeBlock Component with syntax layout, line numbers, and copy action
 */
function CodeBlock({ language, code }: { language?: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');
  const showLineNumbers = lines.length > 2;

  return (
    <div className="not-prose my-3 rounded-xl overflow-hidden border border-gray-800 bg-[#12121e] text-gray-100 shadow-md font-mono text-xs sm:text-sm">
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#1a1a2e] border-b border-gray-800/80 text-gray-400 text-xs select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-semibold text-gray-300 uppercase tracking-wider text-[11px]">
            {language || 'code'}
          </span>
          <span className="text-[10px] text-gray-500 font-sans">
            ({lines.length}行)
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-800/90 hover:bg-gray-700 active:bg-gray-600 text-gray-300 hover:text-white transition-all text-xs"
          title="コードをコピー"
          type="button"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-[11px]">コピー完了!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              <span className="font-medium text-[11px]">コピー</span>
            </>
          )}
        </button>
      </div>

      <div className="p-3.5 overflow-x-auto text-[13px] leading-relaxed scrollbar-thin scrollbar-thumb-gray-700">
        {showLineNumbers ? (
          <table className="border-collapse w-full">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-white/[0.03]">
                  <td className="pr-3 text-right select-none text-gray-600 font-mono text-[11px] w-6 align-top">
                    {idx + 1}
                  </td>
                  <td className="text-gray-200 font-mono whitespace-pre align-top">
                    {line || ' '}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="font-mono text-gray-200 whitespace-pre">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}

/**
 * Rich Markdown Renderer supporting GFM tables, checklists, strikethroughs,
 * code blocks with copy button, blockquotes, links, and headers.
 */
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="prose max-w-none text-gray-800 text-[14px] sm:text-[15px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          pre({ children }) {
            return <div className="not-prose my-1">{children}</div>;
          },
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isInline = !match && !codeString.includes('\n');

            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 font-mono text-[13px] border border-purple-200/70 font-medium inline-block mx-0.5"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <CodeBlock
                language={match ? match[1] : ''}
                code={codeString}
              />
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-3 border border-gray-200 rounded-xl shadow-2xs bg-white">
                <table className="min-w-full divide-y divide-gray-200 text-sm text-left">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-gray-50/90 text-gray-800 font-semibold border-b border-gray-200">
                {children}
              </thead>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-gray-700 border-b border-gray-200">
                {children}
              </th>
            );
          },
          tbody({ children }) {
            return <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>;
          },
          tr({ children }) {
            return <tr className="hover:bg-purple-50/30 transition-colors">{children}</tr>;
          },
          td({ children }) {
            return (
              <td className="px-4 py-2 text-gray-700 text-xs sm:text-sm border-b border-gray-100">
                {children}
              </td>
            );
          },
          h1({ children }) {
            return (
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-5 mb-2.5 pb-1.5 border-b border-gray-200">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-lg sm:text-xl font-bold text-gray-800 mt-4 mb-2">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mt-3 mb-1.5">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="text-sm sm:text-base font-semibold text-gray-700 mt-2 mb-1">
                {children}
              </h4>
            );
          },
          blockquote({ children }) {
            return (
              <blockquote className="border-l-4 border-purple-500 bg-purple-50/60 pl-4 pr-3 py-2.5 my-3 text-gray-700 italic rounded-r-lg text-sm sm:text-base">
                {children}
              </blockquote>
            );
          },
          ul({ children }) {
            return <ul className="list-disc list-outside ml-5 my-2 space-y-1 text-gray-800">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside ml-5 my-2 space-y-1 text-gray-800">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed text-sm sm:text-base my-0.5">{children}</li>;
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-800 underline decoration-purple-300 underline-offset-2 hover:decoration-purple-600 font-medium inline-flex items-center gap-0.5 transition-colors"
              >
                {children}
                <ExternalLink className="w-3 h-3 inline-block shrink-0 opacity-70 ml-0.5" />
              </a>
            );
          },
          hr() {
            return <hr className="my-4 border-t border-gray-200" />;
          },
          strong({ children }) {
            return <strong className="font-semibold text-gray-900">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-gray-800">{children}</em>;
          },
          p({ children }) {
            return <p className="leading-relaxed mb-2 last:mb-0 text-sm sm:text-base">{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Message footer action bar for quick copying and metadata
 */
function ResponseActions({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
      <button
        onClick={handleCopy}
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-purple-700 transition-colors"
        title="回答をクリップボードにコピー"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-emerald-600 font-medium">コピーしました</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>回答をコピー</span>
          </>
        )}
      </button>
      <span className="text-gray-300">|</span>
      <span className="text-[11px] text-gray-400">Markdown形式</span>
    </div>
  );
}

export default function AIStudio() {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = safeStorage.getJSON<ChatSession[] | null>('gemini_chat_sessions', null);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
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

  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Save sessions to safeStorage
  useEffect(() => {
    safeStorage.setJSON('gemini_chat_sessions', sessions);
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
          systemInstruction: 'あなたは有能で親切なAIアシスタント「Xray」です。回答は読みやすく構造化されたMarkdown形式（見出し、箇条書き、太字、表、コードブロックなどを適切に活用）で出力してください。',
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

            <div className="p-4 border-t border-gray-100 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>Xray Engine (Markdown対応)</span>
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
            
            <Link
              to="/"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200/80 shadow-2xs mr-1"
              title="YouTubeホームに戻る"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ホームに戻る</span>
            </Link>

            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center p-[2px] shadow-sm">
              <div className="w-full h-full bg-white rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                  Xray
                </h1>
                <span className="text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                  Markdown
                </span>
              </div>
            </div>
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
                  <p className="text-gray-500 text-lg">Xray AIアシスタントです。Markdown形式で見やすく回答します。</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => {
                const fullText = msg.parts.map(p => p.text || '').filter(Boolean).join('\n');

                return (
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
                    
                    <div className={`max-w-[85%] rounded-2xl p-4 sm:p-5 ${
                      msg.role === 'user' 
                        ? 'bg-purple-600 text-white rounded-tr-sm shadow-sm' 
                        : 'bg-white border border-gray-200/80 text-gray-800 rounded-tl-sm shadow-sm'
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
                      <div className="max-w-none">
                        {msg.role === 'model' ? (
                          <>
                            <MarkdownRenderer content={fullText} />
                            {fullText && <ResponseActions text={fullText} />}
                          </>
                        ) : (
                          <div className="whitespace-pre-wrap leading-relaxed text-white text-[14px] sm:text-[15px]">
                            {fullText}
                          </div>
                        )}
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 border border-gray-300 flex-shrink-0 flex items-center justify-center mt-1 shadow-xs">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                    )}
                  </motion.div>
                );
              })
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
                  placeholder="Xrayにメッセージを入力..."
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
