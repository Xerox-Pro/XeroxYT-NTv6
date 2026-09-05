import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Search, Mic, Video, Bell, LogIn, LogOut, User, Settings, ShieldCheck } from 'lucide-react';
import Avatar from './Avatar';
import { UserInfo } from '../types';

interface NavbarProps {
  onSearch: (q: string) => void;
  onHome: () => void;
  toggleSidebar: () => void;
  initialSearchQuery: string;
  userInfo: UserInfo | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({ 
  onSearch, 
  onHome, 
  toggleSidebar, 
  initialSearchQuery,
  userInfo,
  onLogin,
  onLogout
}: NavbarProps) {
  const [query, setQuery] = useState(initialSearchQuery);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="w-full min-h-[3.5rem] bg-white text-gray-900 flex flex-wrap items-center justify-between px-4 py-2 border-b border-gray-200 shadow-xs relative z-50">
      {/* 左側: ハンバーガーメニュー + YouTubeロゴ */}
      <div className="flex items-center gap-4 shrink-0">
        <motion.button 
          onClick={toggleSidebar} 
          whileTap={{ scale: 0.88 }}
          className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200 text-gray-800"
          title="メニュー"
        >
          <Menu size={22} strokeWidth={2} />
        </motion.button>
        <Link to="/" className="flex items-center gap-2 select-none group" onClick={(e) => {
          if (window.location.pathname === '/') {
            e.preventDefault();
            onHome();
          }
        }}>
          <img 
            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjvrN3FNoHzYnXNfVvvvuP-mBKnl4JUP7tyzaJzIaA-5S21wei4MmKP4L08YGfUOnOU2Jug18mVZ4mzGgAtgKmj9AgYD-u9AAShb_PwiI_rFBWFTlO7Vmds1lDHcJPqpI_Xs-vYnNnNxzt8n0TLG8IJ-2O4BjADNtFZeIcbd1KU-PjCIFFpcUB6rWfz6_y6/s1600/YouTubePro.png"
            alt="YouTube Logo" 
            className="h-6 sm:h-7 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
            referrerPolicy="no-referrer"
          />
          <span className="text-[17px] sm:text-[19px] font-bold tracking-tight text-gray-900 font-sans">XeroxYT-NTv6</span>
        </Link>
      </div>
      
      {/* 中央: 検索バー + マイク */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-[680px] mx-4 sm:mx-8 flex items-center justify-center gap-2">
        <div className="flex w-full bg-white rounded-full overflow-hidden border border-gray-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20 shadow-xs transition-all duration-200">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索"
            className="w-full bg-transparent px-4 py-2 outline-none text-gray-900 text-sm placeholder-gray-500 font-normal"
          />
          <motion.button 
            type="submit" 
            whileTap={{ scale: 0.92 }}
            className="px-6 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-l border-gray-300 flex items-center justify-center text-gray-700 transition-colors"
            title="検索"
          >
            <Search size={19} strokeWidth={2} />
          </motion.button>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          className="p-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors hidden sm:flex items-center justify-center shadow-xs shrink-0"
          title="音声で検索"
          onClick={() => {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
              const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
              const recognition = new SpeechRecognition();
              recognition.lang = 'ja-JP';
              recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                if (text) {
                  setQuery(text);
                  onSearch(text);
                }
              };
              recognition.start();
            }
          }}
        >
          <Mic size={18} />
        </motion.button>
      </form>

      {/* 右側: ログイン/アバター */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {userInfo ? (
          <div className="relative" ref={dropdownRef}>
            <motion.div 
              className="ml-1 cursor-pointer"
              whileTap={{ scale: 0.94 }}
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <Avatar 
                src={userInfo.picture} 
                name={userInfo.name} 
                className="w-8 h-8 text-xs ring-2 ring-red-50 ring-offset-1" 
              />
            </motion.div>

            <AnimatePresence>
              {isProfileOpen && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 shadow-2xl rounded-xl py-2 z-[60]"
                >
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
                    <Avatar src={userInfo.picture} name={userInfo.name} className="w-10 h-10 text-sm" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-gray-900 truncate">{userInfo.name}</div>
                      <div className="text-xs text-gray-500 truncate">{userInfo.email}</div>
                      <div className="text-[10px] text-red-600 font-medium mt-0.5">YouTube 認証済み</div>
                    </div>
                  </div>
                  
                  <div className="py-2">
                    <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                      <User size={18} strokeWidth={1.5} />
                      <span>チャンネル</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 transition-colors">
                      <ShieldCheck size={18} strokeWidth={1.5} />
                      <span>YouTube Studio</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 text-sm text-gray-700 transition-colors border-b border-gray-100 pb-3 mb-1">
                      <Settings size={18} strokeWidth={1.5} />
                      <span>設定</span>
                    </button>
                    
                    <button 
                      onClick={() => {
                        onLogout();
                        setIsProfileOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 hover:bg-red-50 text-sm text-red-600 transition-colors font-medium"
                    >
                      <LogOut size={18} strokeWidth={1.5} />
                      <span>ログアウト</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <motion.button
            onClick={onLogin}
            whileTap={{ scale: 0.94 }}
            className="flex items-center gap-2 px-3 py-1.5 ml-2 border border-blue-600 text-blue-600 rounded-full hover:bg-blue-50 transition-colors text-sm font-bold"
          >
            <LogIn size={18} />
            <span>ログイン</span>
          </motion.button>
        )}
      </div>
    </header>
  );
}
