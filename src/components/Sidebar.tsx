import React from 'react';
import { Home, Zap, PlaySquare, Folder, History, ThumbsUp } from 'lucide-react';
import { ChannelSubscription } from '../types';
import Avatar from './Avatar';

interface SidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  currentView: string;
  onHome: () => void;
  onShorts?: () => void;
  onSubscriptions?: () => void;
  onLibrary?: () => void;
  onHistory?: () => void;
  subscriptions?: ChannelSubscription[];
  onSelectChannel?: (channelId: string) => void;
}

const section1 = [
  { icon: Home, label: 'ホーム', activeValue: 'home' },
  { icon: Zap, label: 'ショート', activeValue: 'shorts' },
  { icon: PlaySquare, label: '登録チャンネル', activeValue: 'subscriptions' },
];

const section2 = [
  { icon: Folder, label: 'ライブラリ', activeValue: 'library' },
  { icon: History, label: '履歴', activeValue: 'history' },
];

export default function Sidebar({ 
  isOpen, 
  onClose,
  currentView, 
  onHome, 
  onShorts,
  onSubscriptions,
  onLibrary,
  onHistory,
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
    } else if (activeValue === 'shorts' && onShorts) {
      onShorts();
    } else if (activeValue === 'subscriptions' && onSubscriptions) {
      onSubscriptions();
    } else if (activeValue === 'library' && onLibrary) {
      onLibrary();
    } else if (activeValue === 'history' && onHistory) {
      onHistory();
    }

    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  const renderLink = (link: any) => {
    const isActive = currentView === link.activeValue;
    return (
      <button
        key={link.label}
        onClick={() => handleClick(link.activeValue)}
        title={link.label}
        className={`w-full flex items-center ${
          isOpen ? 'gap-6 px-3 py-2.5 rounded-xl' : 'flex-col justify-center py-3 px-1 rounded-lg gap-1'
        } transition-colors ${
          isActive
            ? 'bg-gray-100 text-black font-semibold'
            : 'text-gray-800 hover:bg-gray-100 font-normal'
        }`}
      >
        <link.icon 
          size={isOpen ? 22 : 20} 
          strokeWidth={isActive ? 2.2 : 1.8} 
          className={`shrink-0 ${link.activeValue === 'shorts' ? 'text-red-600' : ''}`} 
        />
        <span className={isOpen ? 'text-[14px] truncate' : 'text-[10px] text-center truncate w-full'}>
          {link.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* モバイル用オーバーレイ */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => onClose?.()}
      />

      <aside
        className={`fixed left-0 top-14 h-[calc(100vh-56px)] bg-white text-gray-900 z-50 transition-all duration-200 overflow-y-auto select-none no-scrollbar border-r border-gray-200 ${
          isOpen 
            ? 'w-64 p-3 translate-x-0' 
            : 'w-18 p-1.5 md:translate-x-0 -translate-x-full'
        } ${!isOpen ? 'md:block' : ''}`}
      >
      <div className="flex flex-col gap-1">
        {/* セクション 1 */}
        <div className="flex flex-col gap-0.5">
          {section1.map(renderLink)}
        </div>

        {isOpen ? (
          <>
            <hr className="border-gray-200 my-3" />
            
            {/* セクション 2 */}
            <div className="flex flex-col gap-0.5">
              <h4 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                ライブラリ & 履歴
              </h4>
              {section2.map(renderLink)}
            </div>

            {/* セクション 3 (登録チャンネル) */}
            <hr className="border-gray-200 my-3" />
            <div className="flex flex-col gap-0.5">
              <h4 className="px-3 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                登録チャンネル ({subscriptions.length})
              </h4>
              {subscriptions.length === 0 ? (
                <p className="px-3 text-xs text-gray-400">登録チャンネルはありません</p>
              ) : (
                subscriptions.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => onSelectChannel && onSelectChannel(sub.id)}
                    className="w-full flex items-center gap-4 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors text-left group"
                  >
                    <Avatar src={sub.avatar} name={sub.title} className="w-6 h-6 text-xs shrink-0" />
                    <span className="text-[14px] font-normal text-gray-800 truncate">
                      {sub.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <>
            <hr className="border-gray-200 my-2" />
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleClick('library')}
                className="w-full flex flex-col items-center justify-center py-3 px-1 rounded-lg gap-1 text-gray-800 hover:bg-gray-100"
                title="ライブラリ"
              >
                <Folder size={20} strokeWidth={1.8} />
                <span className="text-[10px] text-center truncate w-full">ライブラリ</span>
              </button>
              <button
                onClick={() => handleClick('history')}
                className="w-full flex flex-col items-center justify-center py-3 px-1 rounded-lg gap-1 text-gray-800 hover:bg-gray-100"
                title="履歴"
              >
                <History size={20} strokeWidth={1.8} />
                <span className="text-[10px] text-center truncate w-full">履歴</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
    </>
  );
}
