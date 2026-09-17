import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Sliders, Eye, RefreshCw, Layers, Compass, Sun, Moon, Info } from 'lucide-react';
import { useTheme, LIQUID_PRESETS } from '../lib/ThemeContext';
import { Glass } from '../lib/Liquid';

export default function PrismInspector() {
  const {
    theme,
    setTheme,
    config,
    updateConfig,
    activePreset,
    applyPreset,
    showPrismInspector,
    setShowPrismInspector,
    showFloatingDome,
    setShowFloatingDome,
  } = useTheme();

  if (!showPrismInspector) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
        onClick={() => setShowPrismInspector(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl p-6 shadow-2xl ${
            theme === 'white'
              ? 'bg-white text-gray-900 border border-gray-200'
              : 'bg-gray-950/85 text-white border border-white/20 backdrop-blur-xl shadow-[0_16px_50px_rgba(0,0,0,0.6)]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-400 via-purple-500 to-amber-300 p-0.5 flex items-center justify-center shadow-md">
                <div className="w-full h-full bg-gray-950 rounded-[14px] flex items-center justify-center">
                  <Sparkles size={18} className="text-cyan-300" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold tracking-tight">Liquid Glass Studio</h3>
                <p className="text-xs text-gray-400">XeroxYT-NTv6 液体ガラス & プリズム設定</p>
              </div>
            </div>
            <button
              onClick={() => setShowPrismInspector(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Theme Selector */}
          <div className="mb-6">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
              基本テーマの切り替え
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/20 border border-white/10">
              <button
                type="button"
                onClick={() => setTheme('white')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  theme === 'white'
                    ? 'bg-white text-gray-900 shadow-md font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sun size={16} />
                ホワイトテーマ
              </button>
              <button
                type="button"
                onClick={() => setTheme('liquid')}
                className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${
                  theme === 'liquid'
                    ? 'bg-gradient-to-r from-cyan-500/30 via-purple-500/30 to-pink-500/30 text-white border border-white/30 shadow-md font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles size={16} className="text-cyan-300" />
                Liquid Glass
              </button>
            </div>
          </div>

          {theme === 'liquid' && (
            <>
              {/* Presets */}
              <div className="mb-6">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                  プリズム・屈折プリセット
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(LIQUID_PRESETS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`text-left p-3 rounded-2xl border transition-all ${
                        activePreset === key
                          ? 'border-cyan-400/60 bg-cyan-500/15 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold text-white mb-0.5">{item.name}</div>
                      <div className="text-[11px] text-gray-400 line-clamp-1">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="mb-6 space-y-4 bg-black/20 p-4 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between text-xs text-gray-300 font-semibold mb-1">
                  <span>パラメーター詳細調整</span>
                  <button
                    onClick={() => applyPreset('prism')}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                  >
                    <RefreshCw size={11} />
                    推奨値にリセット
                  </button>
                </div>

                {/* Blur */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">ぼかし量 (blurAmount)</span>
                    <span className="font-mono text-cyan-300">{config.blurAmount.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.01"
                    value={config.blurAmount}
                    onChange={(e) => updateConfig({ blurAmount: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                  />
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    ※ 0.15標準（ぼかしを最小限に抑え、クッキリとした屈折を表現）
                  </div>
                </div>

                {/* Refraction */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">屈折・歪み (refraction)</span>
                    <span className="font-mono text-purple-300">{config.refraction.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.5"
                    step="0.05"
                    value={config.refraction}
                    onChange={(e) => updateConfig({ refraction: parseFloat(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                  />
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    ※ 高いほど背後の映像やテキストが強く歪みます
                  </div>
                </div>

                {/* Chromatic Aberration */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">クロム収差 / プリズム分光 (chromAberration)</span>
                    <span className="font-mono text-pink-300">{config.chromAberration.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.6"
                    step="0.02"
                    value={config.chromAberration}
                    onChange={(e) => updateConfig({ chromAberration: parseFloat(e.target.value) })}
                    className="w-full accent-pink-400 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                  />
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    ※ 光の波長ごとのズレにより、フチに美しい虹色のプリズム分散が生じます
                  </div>
                </div>

                {/* Edge Highlight & Specular */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">エッジ光沢</span>
                      <span className="font-mono text-amber-300">{config.edgeHighlight.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.5"
                      step="0.02"
                      value={config.edgeHighlight}
                      onChange={(e) => updateConfig({ edgeHighlight: parseFloat(e.target.value) })}
                      className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">鏡面ハイライト</span>
                      <span className="font-mono text-emerald-300">{config.specular.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="0.6"
                      step="0.02"
                      value={config.specular}
                      onChange={(e) => updateConfig({ specular: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-white/20 rounded-lg appearance-none"
                    />
                  </div>
                </div>
              </div>

              {/* Floating Dome Lens feature */}
              <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-purple-900/30 to-cyan-900/30 border border-white/15 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Compass size={14} className="text-cyan-300" />
                    ドラッグ可能な虫眼鏡ドーム (Dome Lens)
                  </div>
                  <div className="text-[11px] text-gray-300 mt-0.5">
                    画面上を自由に動かして動画やUIを拡大・プリズム屈折
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFloatingDome(!showFloatingDome)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    showFloatingDome
                      ? 'bg-cyan-400 text-gray-950 shadow-md font-bold'
                      : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                  }`}
                >
                  {showFloatingDome ? '表示中 (ON)' : '有効にする'}
                </button>
              </div>
            </>
          )}

          {/* Description of Liquid Glass technology */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-gray-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-white text-xs">
              <Info size={14} className="text-cyan-400" />
              Liquid Glassとは？
            </div>
            <p className="text-[11px] leading-relaxed text-gray-400">
              WebGLシェーダーパイプラインを用いて、DOM要素の背後をリアルタイムにキャプチャ・テクスチャ化し、物理屈折法則（スネルの法則）と色収差（波長ごとの屈折率分散）を計算してレンダリングする次世代ガラスマテリアル技術です。
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
