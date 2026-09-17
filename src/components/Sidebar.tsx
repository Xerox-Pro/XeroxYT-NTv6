import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Home, Zap, PlaySquare, Folder, History, ThumbsUp, ShieldCheck } from 'lucide-react';
import { ChannelSubscription } from '../types';
import Avatar from './Avatar';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  currentView: string;
  onHome: () => void;
  onSubscriptions?: () => void;
  onLibrary?: () => void;
  onHistory?: () => void;
  onDebugAPI?: () => void;
  subscriptions?: ChannelSubscription[];
  onSelectChannel?: (channelId: string) => void;
}

const section1 = [
  { icon: Home, label: 'ホーム', activeValue: 'home', path: '/' },
  { icon: PlaySquare, label: '登録チャンネル', activeValue: 'subscriptions', path: '/feed/subscriptions' },
];

const section2 = [
  { icon: Folder, label: 'ライブラリ', activeValue: 'library', path: '/feed/library' },
  { icon: History, label: '履歴', activeValue: 'history', path: '/feed/history' },
];

export default function Sidebar({ 
  isOpen, 
  onClose,
  currentView, 
  onHome, 
  onSubscriptions,
  onLibrary,
  onHistory,
  onDebugAPI,
  subscriptions = [], 
  onSelectChannel 
}: SidebarProps) {
  
  const handleClick = (activeValue: string) => {
    if (activeValue === 'toggle' && onClose) {
      onClose();
      return;
    }

    if (activeValue === 'home') {
      onHome();
    } else if (activeValue === 'subscriptions' && onSubscriptions) {
      onSubscriptions();
    } else if (activeValue === 'library' && onLibrary) {
      onLibrary();
    } else if (activeValue === 'history' && onHistory) {
      onHistory();
    } else if (activeValue === 'debug' && onDebugAPI) {
      onDebugAPI();
    }

    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  const renderLink = (link: any) => {
    const isActive = currentView === link.activeValue;
    return (
      <motion.div key={link.label} whileTap={{ scale: 0.95 }} className="w-full">
        <Link
          to={link.path}
          onClick={() => handleClick(link.activeValue)}
          title={link.label}
          className={`w-full flex items-center ${
            isOpen ? 'gap-4 px-3 py-2 rounded-xl' : 'flex-col justify-center py-2.5 px-1 rounded-lg gap-1'
          } transition-colors ${
            isActive
              ? 'bg-gray-100 text-black font-semibold'
              : 'text-gray-800 hover:bg-gray-100 font-normal'
          }`}
        >
          <link.icon 
            size={isOpen ? 22 : 20} 
            strokeWidth={isActive ? 2.2 : 1.8} 
            className={`shrink-0`} 
          />
          <span className={isOpen ? 'text-[14px] truncate' : 'text-[10px] text-center truncate w-full'}>
            {link.label}
          </span>
        </Link>
      </motion.div>
    );
  };

  return (
    <>
      {/* モバイル・タブレット用オーバーレイ */}
      <div 
        className={`fixed inset-0 top-0 md:top-[56px] bg-black/50 z-30 xl:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => onClose?.()}
      />

      {/* レイアウトスペース確保用プレースホルダー (タブレット以下の画面幅でサイドバーがfixedになった時もmain要素がズレないようにする) */}
      <div className="hidden md:block xl:hidden shrink-0 w-[72px]" />

      <aside
        className={`bg-white/40 backdrop-blur-xl text-gray-900 z-40 transition-transform duration-200 overflow-y-auto select-none no-scrollbar border-r border-white/60 shadow-lg shrink-0 ${
          isOpen 
            ? 'w-56 p-2.5 fixed xl:sticky top-0 md:top-[56px] h-screen md:h-[calc(100vh-56px)] left-0 translate-x-0 shadow-2xl xl:shadow-none' 
            : 'w-[72px] p-1.5 fixed xl:sticky top-0 md:top-[56px] h-screen md:h-[calc(100vh-56px)] left-0 -translate-x-full md:translate-x-0'
        }`}
      >
      <div className="flex flex-col gap-1">
        {/* セクション 1 */}
        <div className="flex flex-col gap-0.5">
          {section1.map(renderLink)}
        </div>

        {isOpen ? (
          <>
            <hr className="border-gray-200 my-2" />
            
            {/* セクション 2 */}
            <div className="flex flex-col gap-0.5">
              <h4 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                ライブラリ & 履歴
              </h4>
              {section2.map(renderLink)}
              
              <Link
                to="/debug/api"
                onClick={() => handleClick('debug')}
                className={`w-full flex items-center ${
                  isOpen ? 'gap-4 px-3 py-2 rounded-xl' : 'flex-col justify-center py-2.5 px-1 rounded-lg gap-1'
                } transition-colors ${
                  currentView === 'debug'
                    ? 'bg-gray-100 text-black font-semibold'
                    : 'text-gray-800 hover:bg-gray-100 font-normal'
                }`}
              >
                <ShieldCheck size={isOpen ? 22 : 20} strokeWidth={currentView === 'debug' ? 2.2 : 1.8} className="shrink-0 text-blue-600" />
                <span className={isOpen ? 'text-[14px] truncate' : 'text-[10px] text-center truncate w-full'}>
                  APIデバッグ
                </span>
              </Link>
            </div>

            {/* セクション 3 (登録チャンネル) */}
            <hr className="border-gray-200 my-2" />
            <div className="flex flex-col gap-0.5">
              <h4 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                登録チャンネル ({subscriptions.length})
              </h4>
              {subscriptions.length === 0 ? (
                <p className="px-3 text-xs text-gray-400">登録チャンネルはありません</p>
              ) : (
                subscriptions.map((sub) => (
                  <motion.div key={sub.id} whileTap={{ scale: 0.96 }} className="w-full">
                    <Link
                      to={`/channel/${sub.id}`}
                      onClick={(e) => {
                        if (onSelectChannel) {
                          e.preventDefault();
                          onSelectChannel(sub.id);
                        }
                      }}
                      className="w-full flex items-center gap-4 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors text-left group"
                    >
                      <Avatar src={sub.avatar} name={sub.title} className="w-6 h-6 text-xs shrink-0" />
                      <span className="text-[14px] font-normal text-gray-800 truncate">
                        {sub.title}
                      </span>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <hr className="border-gray-200 my-1.5" />
            <div className="flex flex-col gap-1">
              <Link
                to="/feed/library"
                onClick={() => handleClick('library')}
                className="w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-lg gap-1 text-gray-800 hover:bg-gray-100"
                title="ライブラリ"
              >
                <Folder size={20} strokeWidth={1.8} />
                <span className="text-[10px] text-center truncate w-full">ライブラリ</span>
              </Link>
              <Link
                to="/feed/history"
                onClick={() => handleClick('history')}
                className="w-full flex flex-col items-center justify-center py-2.5 px-1 rounded-lg gap-1 text-gray-800 hover:bg-gray-100"
                title="履歴"
              >
                <History size={20} strokeWidth={1.8} />
                <span className="text-[10px] text-center truncate w-full">履歴</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </aside>
    </>
  );
}
