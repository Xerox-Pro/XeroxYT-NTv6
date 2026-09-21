import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localAI } from '../lib/intelligence';
import { useTheme } from '../lib/ThemeContext';
import { Glass } from '../lib/Liquid';

interface CategoryBarProps {
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
}

const staticCategories = [
  'すべて',
  '音楽',
  'ゲーム',
  'アニメ',
  'ライブ',
  '料理',
  'エンタメ',
  'ニュース',
  'テクノロジー',
  '教育',
  'スポーツ',
];

export default function CategoryBar({ onSelectCategory, selectedCategory = 'すべて' }: CategoryBarProps) {
  const { theme } = useTheme();
  const [active, setActive] = useState(selectedCategory);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [sampledHashtags, setSampledHashtags] = useState<string[]>([]);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 独自AIによる分析結果をカテゴリーに反映
    const topInterests = localAI.getTopSuggestedQueries(3);
    setDynamicCategories(topInterests);

    // 視聴動画のタイトル・概要欄から記憶したハッシュタグから5個ピックアップ
    const tags = localAI.getSampledHashtags(5);
    setSampledHashtags(tags);
  }, [selectedCategory]);

  const categories = [...staticCategories, ...dynamicCategories, ...sampledHashtags];

  useEffect(() => {
    setActive(selectedCategory || 'すべて');
  }, [selectedCategory]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
    setShowLeftArrow(scrollLeft > 10);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
  };

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -260 : 260;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleClick = (cat: string) => {
    setActive(cat);
    if (onSelectCategory) {
      onSelectCategory(cat === 'すべて' ? '' : cat);
    }
  };

  return (
    <div className={`relative h-14 sticky top-14 z-30 select-none transition-colors duration-200 ${
      theme === 'white' 
        ? 'bg-white border-b border-gray-200 shadow-2xs' 
        : 'bg-black/20 backdrop-blur-md border-b border-white/10 shadow-lg'
    }`}>
      {/* 左スクロールボタン */}
      {showLeftArrow && (
        <div className={`absolute left-0 top-0 bottom-0 z-10 flex items-center pr-6 pl-2 ${
          theme === 'white' 
            ? 'bg-gradient-to-r from-white via-white/90 to-transparent' 
            : 'bg-gradient-to-r from-black/80 via-black/40 to-transparent'
        }`}>
          <button
            onClick={() => scroll('left')}
            className={`p-1.5 rounded-full active:scale-95 transition-transform ${
              theme === 'white' 
                ? 'hover:bg-gray-100 text-gray-700 bg-white border border-gray-200 shadow-xs' 
                : 'hover:bg-white/20 text-white bg-white/10 border border-white/20 shadow-xs'
            }`}
            aria-label="前へスクロール"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      )}

      {/* カテゴリ一覧 */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="h-full flex items-center space-x-2.5 px-4 sm:px-6 overflow-x-auto no-scrollbar scroll-smooth"
      >
        {categories.map((cat, idx) => {
          const isActive = active === cat;
          const isHashtag = cat.startsWith('#');

          return (
            <motion.button
              key={`${cat}-${idx}`}
              onClick={() => handleClick(cat)}
              whileTap={{ scale: 0.94 }}
              className={`relative px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isActive
                  ? 'text-white'
                  : theme === 'white'
                  ? isHashtag
                    ? 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  : isHashtag
                  ? 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 border border-cyan-400/40 backdrop-blur-xs'
                  : 'bg-white/10 text-white/90 hover:bg-white/20 border border-white/15 backdrop-blur-xs'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCategoryPill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className={`absolute inset-0 rounded-lg -z-0 ${
                    theme === 'white' 
                      ? 'bg-gray-900 shadow-xs' 
                      : 'bg-gradient-to-r from-cyan-500/80 via-indigo-500/80 to-pink-500/80 border border-white/40 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                  }`}
                />
              )}
              <span className="relative z-10">{cat}</span>
            </motion.button>
          );
        })}
      </div>

      {/* 右スクロールボタン */}
      {showRightArrow && (
        <div className={`absolute right-0 top-0 bottom-0 z-10 flex items-center pl-6 pr-2 ${
          theme === 'white' 
            ? 'bg-gradient-to-l from-white via-white/90 to-transparent' 
            : 'bg-gradient-to-l from-black/80 via-black/40 to-transparent'
        }`}>
          <button
            onClick={() => scroll('right')}
            className={`p-1.5 rounded-full active:scale-95 transition-transform ${
              theme === 'white' 
                ? 'hover:bg-gray-100 text-gray-700 bg-white border border-gray-200 shadow-xs' 
                : 'hover:bg-white/20 text-white bg-white/10 border border-white/20 shadow-xs'
            }`}
            aria-label="次へスクロール"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
