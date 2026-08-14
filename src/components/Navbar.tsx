import React, { useState, useRef, useEffect } from 'react';
import { Menu, Search, Play, Mic, Video, Bell, LogIn, LogOut, User, Settings, ShieldCheck } from 'lucide-react';
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
    <header className="fixed top-0 left-0 right-0 h-14 bg-white text-gray-900 z-50 flex items-center justify-between px-4 border-b border-gray-200 shadow-xs">
      {/* 左側: ハンバーガーメニュー + YouTubeロゴ */}
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar} 
          className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors duration-200 text-gray-800"
          title="メニュー"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={onHome}>
          <div className="w-8 h-5.5 bg-red-600 text-white rounded-[6px] flex items-center justify-center shadow-xs">
             <Play size={13} fill="currentColor" className="ml-0.5" />
          </div>
          <span className="text-[20px] font-bold tracking-tighter text-gray-900 font-sans">YouTube</span>
          <span className="text-[10px] font-semibold text-gray-500 -mt-3 ml-0.5">JP</span>
        </div>
      </div>
      
      {/* 中央: 検索バー & マイク */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-[680px] mx-4 sm:mx-8 flex items-center gap-3">
        <div className="flex w-full bg-white rounded-full overflow-hidden border border-gray-300 focus-within:border-blue-600 shadow-xs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="検索"
            className="w-full bg-transparent px-4 py-2 outline-none text-gray-900 text-sm placeholder-gray-500 font-normal"
          />
          <button 
            type="submit" 
            className="px-6 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 border-l border-gray-300 flex items-center justify-center text-gray-700 transition-colors"
            title="検索"
          >
            <Search size={19} strokeWidth={2} />
          </button>
        </div>
        <button 
          type="button" 
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-full transition-colors shrink-0 text-gray-700"
          title="音声検索"
        >
          <Mic size={19} strokeWidth={2} />
        </button>
      </form>

      {/* 右側: 作成 (Video)、通知 (Bell)、ログイン/アバター */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button 
          className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-700"
          title="作成"
        >
          <Video size={20} strokeWidth={1.8} />
        </button>
        <button 
          className="p-2.5 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors text-gray-700 relative"
          title="通知"
        >
          <Bell size={20} strokeWidth={1.8} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full"></span>
        </button>

        {userInfo ? (
          <div className="relative" ref={dropdownRef}>
            <div 
              className="ml-1 cursor-pointer"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <Avatar 
                src={userInfo.picture} 
                name={userInfo.name} 
                className="w-8 h-8 text-xs ring-2 ring-red-50 ring-offset-1" 
              />
            </div>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 shadow-2xl rounded-xl py-2 z-[60] animate-in fade-in zoom-in duration-150">
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
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="flex items-center gap-2 px-3 py-1.5 ml-2 border border-blue-600 text-blue-600 rounded-full hover:bg-blue-50 transition-colors text-sm font-bold"
          >
            <LogIn size={18} />
            <span>ログイン</span>
          </button>
        )}
      </div>
    </header>
  );
}
