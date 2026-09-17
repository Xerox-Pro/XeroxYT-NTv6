import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { localAI } from '../lib/intelligence';

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
  const isLiquid = theme === 'liquid';
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
    <div className={`relative h-14 sticky top-14 z-30 select-none shadow-2xs ${isLiquid ? 'border-b border-white/10 bg-black/20 text-white' : 'bg-white border-b border-gray-200'}`}>
      {/* 左スクロールボタン */}
      {showLeftArrow && (
        <div className={`absolute left-0 top-0 bottom-0 z-10 flex items-center pr-6 pl-2 ${isLiquid ? 'bg-gradient-to-r from-black/80 to-transparent' : 'bg-gradient-to-r from-white via-white/90 to-transparent'}`}>
          <button
            onClick={() => scroll('left')}
            className={`p-1.5 rounded-full active:scale-95 transition-transform shadow-xs ${isLiquid ? 'bg-white/20 text-white hover:bg-white/30 border border-white/20' : 'hover:bg-gray-100 text-gray-700 bg-white border border-gray-200'}`}
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
              className={`relative px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
    isActive 
      ? (isLiquid ? 'text-black' : 'text-white') 
      : isHashtag 
        ? (isLiquid ? 'bg-cyan-900/40 text-cyan-200 border border-cyan-500/30' : 'bg-blue-50 text-blue-800 border border-blue-200') 
        : (isLiquid ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-800 hover:bg-gray-200')
  }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCategoryPill"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  className={`absolute inset-0 rounded-lg -z-0 ${isLiquid ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'bg-gray-900'}`}
                />
              )}
              <span className="relative z-10">{cat}</span>
            </motion.button>
          );
        })}
      </div>

      {/* 右スクロールボタン */}
      {showRightArrow && (
        <div className={`absolute right-0 top-0 bottom-0 z-10 flex items-center pl-6 pr-2 ${isLiquid ? 'bg-gradient-to-l from-black/80 to-transparent' : 'bg-gradient-to-l from-white via-white/90 to-transparent'}`}>
          <button
            onClick={() => scroll('right')}
            className={`p-1.5 rounded-full active:scale-95 transition-transform shadow-xs ${isLiquid ? 'bg-white/20 text-white hover:bg-white/30 border border-white/20' : 'hover:bg-gray-100 text-gray-700 bg-white border border-gray-200'}`}
            aria-label="次へスクロール"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
