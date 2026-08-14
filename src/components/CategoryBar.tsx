import React, { useState, useEffect } from 'react';
import { localAI } from '../lib/intelligence';
import { BrainCircuit } from 'lucide-react';

interface CategoryBarProps {
  onSelectCategory?: (category: string) => void;
  selectedCategory?: string;
}

const staticCategories = [
  'すべて',
  '音楽',
  'ゲーム',
  'アニメ',
  '料理',
  'エンタメ',
  'ニュース',
  'ライフスタイル',
  'テクノロジー',
  '教育',
  'スポーツ',
  'ライブ',
];

export default function CategoryBar({ onSelectCategory, selectedCategory = 'すべて' }: CategoryBarProps) {
  const [active, setActive] = useState(selectedCategory);
  const [dynamicCategories, setDynamicCategories] = useState<string[]>([]);

  useEffect(() => {
    // 独自AIによる分析結果をカテゴリーに反映
    const topInterests = localAI.getTopSuggestedQueries(3);
    setDynamicCategories(topInterests);
  }, []);

  const categories = [...staticCategories, ...dynamicCategories];

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
    <div className="h-14 flex items-center space-x-3 px-6 overflow-x-auto bg-white border-b border-gray-200 sticky top-14 z-30 no-scrollbar select-none shadow-2xs">
      {categories.map((cat, idx) => {
        const isActive = active === cat;
        const isDynamic = idx >= staticCategories.length;
        
        return (
          <button
            key={`${cat}-${idx}`}
            onClick={() => handleClick(cat)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              isActive
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            {isDynamic && <BrainCircuit size={14} className={isActive ? 'text-white' : 'text-red-500'} />}
            {cat}
          </button>
        );
      })}
    </div>
  );
}
