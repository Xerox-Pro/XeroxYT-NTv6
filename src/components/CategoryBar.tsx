import React, { useState, useEffect } from 'react';
import { localAI } from '../lib/intelligence';
import { BrainCircuit, Hash } from 'lucide-react';

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
  const [active, setActive] = useState(selectedCategory);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);
  const [sampledHashtags, setSampledHashtags] = useState<string[]>([]);

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

  const handleClick = (cat: string) => {
    setActive(cat);
    if (onSelectCategory) {
      onSelectCategory(cat === 'すべて' ? '' : cat);
    }
  };

  return (
    <div className="h-14 flex items-center space-x-2.5 px-4 sm:px-6 overflow-x-auto bg-white border-b border-gray-200 sticky top-14 z-30 no-scrollbar select-none shadow-2xs">
      {categories.map((cat, idx) => {
        const isActive = active === cat;
        const isDynamic = idx >= staticCategories.length && idx < staticCategories.length + dynamicCategories.length;
        const isHashtag = cat.startsWith('#');
        
        return (
          <button
            key={`${cat}-${idx}`}
            onClick={() => handleClick(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'bg-gray-900 text-white'
                : isHashtag
                ? 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {isDynamic && <BrainCircuit size={13} className={isActive ? 'text-white' : 'text-purple-600'} />}
            {isHashtag && <Hash size={13} className={isActive ? 'text-white' : 'text-blue-600'} />}
            {cat}
          </button>
        );
      })}
    </div>
  );
}
