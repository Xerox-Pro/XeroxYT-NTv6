import React from 'react';
import { SlidersHorizontal, RotateCcw, Check, X } from 'lucide-react';

export interface SearchFilterState {
  uploadDate: 'all' | 'hour' | 'today' | 'week' | 'month' | 'year';
  type: 'all' | 'video' | 'channel' | 'playlist';
  duration: 'all' | 'short' | 'medium' | 'long';
  features: string[]; // e.g. ['live', '4k', 'subtitles']
  sortBy: 'relevance' | 'upload_date' | 'view_count' | 'rating';
}

export const DEFAULT_SEARCH_FILTERS: SearchFilterState = {
  uploadDate: 'all',
  type: 'all',
  duration: 'all',
  features: [],
  sortBy: 'relevance',
};

interface SearchFiltersProps {
  filters: SearchFilterState;
  onChange: (filters: SearchFilterState) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  filters,
  onChange,
  isOpen,
  onToggleOpen,
}) => {
  const activeFilterCount =
    (filters.uploadDate !== 'all' ? 1 : 0) +
    (filters.type !== 'all' ? 1 : 0) +
    (filters.duration !== 'all' ? 1 : 0) +
    filters.features.length +
    (filters.sortBy !== 'relevance' ? 1 : 0);

  const handleReset = () => {
    onChange(DEFAULT_SEARCH_FILTERS);
  };

  const handleFeatureToggle = (featureKey: string) => {
    const isSelected = filters.features.includes(featureKey);
    const updated = isSelected
      ? filters.features.filter((f) => f !== featureKey)
      : [...filters.features, featureKey];
    onChange({ ...filters, features: updated });
  };

  return (
    <div className="mb-6 border-b border-gray-200 pb-4">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onToggleOpen}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
            activeFilterCount > 0 || isOpen
              ? 'bg-gray-900 text-white border-gray-900 shadow-sm hover:bg-black'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-200'
          }`}
        >
          <SlidersHorizontal size={14} />
          <span>フィルタ</span>
          {activeFilterCount > 0 && (
            <span className="ml-1 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 font-medium transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>フィルタをリセット</span>
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 text-xs text-gray-700 bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 transition-all">
          {/* 1. アップロード日時 */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5 tracking-tight uppercase text-gray-500">
              アップロード日時
            </h4>
            <div className="flex flex-col gap-1 mt-1">
              {[
                { id: 'all', label: '指定なし' },
                { id: 'hour', label: '1時間以内' },
                { id: 'today', label: '今日' },
                { id: 'week', label: '今週' },
                { id: 'month', label: '今月' },
                { id: 'year', label: '今年' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    onChange({ ...filters, uploadDate: opt.id as any })
                  }
                  className={`text-left py-1 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-between ${
                    filters.uploadDate === opt.id
                      ? 'font-bold text-black bg-white shadow-2xs border border-gray-200'
                      : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.uploadDate === opt.id && <Check size={12} className="text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* 2. タイプ */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5 tracking-tight uppercase text-gray-500">
              タイプ
            </h4>
            <div className="flex flex-col gap-1 mt-1">
              {[
                { id: 'all', label: 'すべて' },
                { id: 'video', label: '動画' },
                { id: 'channel', label: 'チャンネル' },
                { id: 'playlist', label: '再生リスト' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onChange({ ...filters, type: opt.id as any })}
                  className={`text-left py-1 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-between ${
                    filters.type === opt.id
                      ? 'font-bold text-black bg-white shadow-2xs border border-gray-200'
                      : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.type === opt.id && <Check size={12} className="text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 再生時間 */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5 tracking-tight uppercase text-gray-500">
              再生時間
            </h4>
            <div className="flex flex-col gap-1 mt-1">
              {[
                { id: 'all', label: '指定なし' },
                { id: 'short', label: '4分未満' },
                { id: 'medium', label: '4 〜 20分' },
                { id: 'long', label: '20分以上' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onChange({ ...filters, duration: opt.id as any })}
                  className={`text-left py-1 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-between ${
                    filters.duration === opt.id
                      ? 'font-bold text-black bg-white shadow-2xs border border-gray-200'
                      : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.duration === opt.id && <Check size={12} className="text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 機能 */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5 tracking-tight uppercase text-gray-500">
              機能
            </h4>
            <div className="flex flex-col gap-1 mt-1">
              {[
                { id: 'live', label: 'ライブ' },
                { id: '4k', label: '4K' },
                { id: 'hd', label: 'HD' },
                { id: 'subtitles', label: '字幕' },
                { id: 'creative_commons', label: 'クリエイティブ・コモンズ' },
              ].map((opt) => {
                const isChecked = filters.features.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleFeatureToggle(opt.id)}
                    className={`text-left py-1 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'font-bold text-black bg-white shadow-2xs border border-gray-200'
                        : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isChecked && <Check size={12} className="text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. 並べ替え */}
          <div className="flex flex-col gap-2">
            <h4 className="font-bold text-gray-900 text-xs border-b border-gray-200 pb-1.5 tracking-tight uppercase text-gray-500">
              並べ替え
            </h4>
            <div className="flex flex-col gap-1 mt-1">
              {[
                { id: 'relevance', label: '関連度順' },
                { id: 'upload_date', label: 'アップロード日' },
                { id: 'view_count', label: '視聴回数' },
                { id: 'rating', label: '評価' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onChange({ ...filters, sortBy: opt.id as any })}
                  className={`text-left py-1 px-2 rounded-md transition-colors cursor-pointer flex items-center justify-between ${
                    filters.sortBy === opt.id
                      ? 'font-bold text-black bg-white shadow-2xs border border-gray-200'
                      : 'text-gray-600 hover:text-black hover:bg-gray-200/60'
                  }`}
                >
                  <span>{opt.label}</span>
                  {filters.sortBy === opt.id && <Check size={12} className="text-blue-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
