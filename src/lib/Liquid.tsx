import React, { useEffect, useRef, useId } from 'react';
import { LiquidGlass } from './liquidglass-engine';
import { useTheme, LiquidGlassConfig } from './ThemeContext';

// High-definition iridescent prismatic fluid background for authentic refraction and chromatic dispersion
export const AMBIENT_LIQUID_BG = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

export interface LiquidRootProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: any;
  id?: string;
}

export function LiquidRoot({ children, className = '', style, as: Component = "div", id }: LiquidRootProps) {
  const rootRef = useRef<HTMLElement>(null);
  const { theme, config } = useTheme();
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (theme !== 'liquid') {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
      return;
    }

    let mounted = true;

    const setupLiquid = async () => {
      if (!rootRef.current || !mounted) return;

      const elements = rootRef.current.querySelectorAll<HTMLElement>(':scope > .glass-element');
      if (elements.length === 0) return;

      try {
        if (instanceRef.current) {
          try {
            instanceRef.current.destroy();
          } catch {
            // ignore
          }
        }

        instanceRef.current = await LiquidGlass.init({
          root: rootRef.current,
          glassElements: elements,
          defaults: {
            blurAmount: config.blurAmount,
            refraction: config.refraction,
            chromAberration: config.chromAberration,
            edgeHighlight: config.edgeHighlight,
            specular: config.specular,
            fresnel: config.fresnel,
            shadowOpacity: config.shadowOpacity,
            shadowSpread: config.shadowSpread,
            brightness: config.brightness,
            saturation: config.saturation,
            bevelMode: config.bevelMode,
          },
        });
      } catch (err) {
        console.warn("LiquidGlass initialization note:", err);
      }
    };

    const timer = setTimeout(setupLiquid, 60);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
    };
  }, [theme, config.blurAmount, config.refraction, config.chromAberration, config.edgeHighlight, config.specular, config.bevelMode]);

  if (theme !== 'liquid') {
    return <Component id={id} className={className} style={style}>{children}</Component>;
  }

  return (
    <Component
      id={id}
      ref={rootRef}
      className={`relative ${className}`}
      style={style}
    >
      {/* Sampled background element for LiquidGlass to refract */}
      <img
        src={AMBIENT_LIQUID_BG}
        className="fixed inset-0 w-screen h-screen object-cover pointer-events-none select-none"
        style={{ zIndex: -10, filter: 'contrast(1.08) saturate(1.1)' }}
        crossOrigin="anonymous"
        alt=""
        aria-hidden="true"
      />
      {children}
    </Component>
  );
}

export type GlassVariant = 'default' | 'button' | 'navbar' | 'search' | 'pill' | 'card' | 'dome' | 'chip' | 'sidebar';

export interface GlassProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
  variant?: GlassVariant;
  config?: Partial<LiquidGlassConfig>;
  as?: any;
  dynamic?: boolean;
}

export function Glass({
  children,
  className = '',
  variant = 'default',
  config: customConfig,
  as: Component = 'div',
  dynamic = false,
  onClick,
  style,
  ...props
}: GlassProps) {
  const { theme, config: globalConfig } = useTheme();

  if (theme !== 'liquid') {
    return (
      <Component className={className} onClick={onClick} style={style} {...props}>
        {children}
      </Component>
    );
  }

  // Specialized parameters based on element variant
  let variantConfig: Partial<LiquidGlassConfig> = {};

  switch (variant) {
    case 'button':
      variantConfig = {
        button: true,
        cornerRadius: 24,
        blurAmount: Math.min(globalConfig.blurAmount, 0.08), // lower blur for clear text readability
        refraction: Math.min(globalConfig.refraction + 0.15, 2.2), // high prism punch
        chromAberration: Math.min(globalConfig.chromAberration + 0.05, 0.45),
        edgeHighlight: 0.25,
        specular: 0.38,
        shadowOpacity: 0.38,
      };
      break;
    case 'pill':
    case 'chip':
      variantConfig = {
        button: true,
        cornerRadius: 20,
        blurAmount: Math.min(globalConfig.blurAmount, 0.06),
        refraction: globalConfig.refraction,
        chromAberration: globalConfig.chromAberration,
        edgeHighlight: 0.22,
        specular: 0.32,
      };
      break;
    case 'navbar':
      variantConfig = {
        cornerRadius: 0,
        blurAmount: globalConfig.blurAmount,
        refraction: Math.max(globalConfig.refraction - 0.2, 1.3),
        chromAberration: globalConfig.chromAberration,
        edgeHighlight: 0.2,
        specular: 0.24,
        shadowOpacity: 0.25,
      };
      break;
    case 'sidebar':
      variantConfig = {
        cornerRadius: 0,
        blurAmount: globalConfig.blurAmount,
        refraction: Math.max(globalConfig.refraction - 0.1, 1.4),
        chromAberration: globalConfig.chromAberration,
        edgeHighlight: 0.2,
        specular: 0.25,
        shadowOpacity: 0.25,
      };
      break;
    case 'search':
      variantConfig = {
        cornerRadius: 28,
        blurAmount: Math.min(globalConfig.blurAmount, 0.08),
        refraction: globalConfig.refraction,
        chromAberration: globalConfig.chromAberration,
        edgeHighlight: 0.22,
        specular: 0.3,
      };
      break;
    case 'card':
      variantConfig = {
        cornerRadius: 18,
        blurAmount: globalConfig.blurAmount,
        refraction: globalConfig.refraction,
        chromAberration: globalConfig.chromAberration,
        edgeHighlight: 0.18,
        specular: 0.28,
        shadowOpacity: 0.35,
      };
      break;
    case 'dome':
      variantConfig = {
        bevelMode: 1,
        cornerRadius: 50,
        zRadius: 50,
        floating: true,
        blurAmount: 0,
        refraction: 1.85,
        chromAberration: 0.42,
        edgeHighlight: 0.35,
        specular: 0.45,
      };
      break;
    default:
      variantConfig = {};
      break;
  }

  const finalConfig = {
    ...globalConfig,
    ...variantConfig,
    ...customConfig,
  };

  // Additional prismatic border and backdrop styling in CSS to complement WebGL shader
  const glassClasses = `glass-element backdrop-blur-[1.5px] border border-white/25 shadow-[0_8px_32px_0_rgba(0,0,0,0.25)] ring-1 ring-white/20 transition-all duration-150 ${className}`;

  return (
    <Component
      className={glassClasses}
      data-config={JSON.stringify(finalConfig)}
      onClick={onClick}
      style={{
        // Ensure element creates appropriate stacking context and avoids opaque background
        ...style,
      }}
      {...(dynamic ? { 'data-dynamic': 'true' } : {})}
      {...props}
    >
      {children}
    </Component>
  );
}

// Interactive Draggable Dome Lens (as featured in LiquidGlass doc: ドームベベル（拡大鏡）)
export function FloatingDomeLens() {
  const { theme, showFloatingDome, setShowFloatingDome } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    if (theme !== 'liquid' || !showFloatingDome) {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
      return;
    }

    let mounted = true;

    const setup = async () => {
      if (!rootRef.current || !mounted) return;
      try {
        const domeEl = rootRef.current.querySelector<HTMLElement>('.dome-element');
        if (domeEl) {
          instanceRef.current = await LiquidGlass.init({
            root: rootRef.current,
            glassElements: [domeEl],
            defaults: {
              bevelMode: 1,
              cornerRadius: 55,
              zRadius: 55,
              floating: true,
              blurAmount: 0,
              refraction: 1.88,
              chromAberration: 0.4,
              specular: 0.4,
              edgeHighlight: 0.3,
            },
          });
        }
      } catch (e) {
        console.warn("Dome lens init:", e);
      }
    };

    const timer = setTimeout(setup, 80);
    return () => {
      mounted = false;
      clearTimeout(timer);
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
    };
  }, [theme, showFloatingDome]);

  if (theme !== 'liquid' || !showFloatingDome) return null;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{ position: 'fixed' }}
    >
      {/* Draggable glass dome element */}
      <div
        className="glass-element dome-element pointer-events-auto cursor-grab active:cursor-grabbing w-28 h-28 rounded-full flex flex-col items-center justify-center text-center select-none shadow-2xl border border-white/40 ring-2 ring-white/30"
        style={{
          position: 'absolute',
          top: '25%',
          right: '8%',
        }}
        data-config={JSON.stringify({
          bevelMode: 1,
          cornerRadius: 56,
          zRadius: 56,
          floating: true,
          blurAmount: 0,
          refraction: 1.88,
          chromAberration: 0.4,
          edgeHighlight: 0.35,
          specular: 0.45,
        })}
        title="ドラッグして画面上の要素を拡大・屈折できます"
      >
        <div className="text-[10px] font-bold text-white tracking-wider drop-shadow-md bg-black/40 px-2 py-0.5 rounded-full pointer-events-none">
          🔍 LENS
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowFloatingDome(false);
          }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-black/70 hover:bg-black text-white rounded-full text-[10px] flex items-center justify-center pointer-events-auto border border-white/30"
          title="閉じる"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function GlobalLiquidBackground() {
  const { theme } = useTheme();
  if (theme !== 'liquid') return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-50 bg-[#070b14]" aria-hidden="true">
      {/* Dynamic ambient gradient fallback */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-cyan-950 opacity-90" />
      {/* Core saturated fluid image */}
      <img
        src={AMBIENT_LIQUID_BG}
        className="w-full h-full object-cover select-none scale-105 opacity-90 mix-blend-screen"
        style={{ filter: 'brightness(0.92) contrast(1.1) saturate(1.15)' }}
        crossOrigin="anonymous"
        alt=""
      />
      {/* Subtle iridescent ambient overlay to emphasize refraction */}
      <div
        className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-purple-500/10 to-amber-400/10 mix-blend-overlay pointer-events-none"
      />
    </div>
  );
}

/**
 * プリズム・リキッドグラス パラメータ微調整用インスペクター
 * ユーザーが屈折率や色収差、ぼかし(0.15標準)をリアルタイムに体感可能
 */
export function PrismInspector() {
  const { theme, config, updateConfig } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  if (theme !== 'liquid') return null;

  return (
    <div className="fixed bottom-4 right-4 z-[999] select-none text-xs font-sans">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/90 border border-white/25 shadow-lg backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
          title="プリズム / ガラスパラメータ調整"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-medium text-[11px] tracking-wide">Prism Engine</span>
        </button>
      ) : (
        <div className="w-72 p-3.5 rounded-2xl bg-black/80 border border-white/25 text-white shadow-2xl backdrop-blur-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/15 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-400" />
              <span className="font-bold text-xs tracking-wider uppercase text-cyan-200">Prism Optics</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white text-xs px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2.5 text-[11px]">
            {/* ぼかし (blurAmount) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-white/80">
                <span>ぼかし (Blur)</span>
                <span className="font-mono text-cyan-300">{config.blurAmount.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.blurAmount}
                onChange={(e) => updateConfig({ blurAmount: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
            </div>

            {/* 屈折 (refraction) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-white/80">
                <span>屈折・歪み (Refraction)</span>
                <span className="font-mono text-cyan-300">{config.refraction.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={config.refraction}
                onChange={(e) => updateConfig({ refraction: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
            </div>

            {/* 色収差 (chromAberration) */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-white/80">
                <span>色収差プリズム (Aberration)</span>
                <span className="font-mono text-cyan-300">{config.chromAberration.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1.2"
                step="0.05"
                value={config.chromAberration}
                onChange={(e) => updateConfig({ chromAberration: parseFloat(e.target.value) })}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
            </div>

            {/* プリセットボタン */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-1.5">
              <button
                onClick={() => updateConfig({ blurAmount: 0.15, refraction: 2.2, chromAberration: 0.65 })}
                className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-center text-[10px] text-cyan-200 border border-white/15"
              >
                強力プリズム
              </button>
              <button
                onClick={() => updateConfig({ blurAmount: 0.05, refraction: 1.8, chromAberration: 0.4 })}
                className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-center text-[10px] text-white/90 border border-white/15"
              >
                クリアクリスタル
              </button>
              <button
                onClick={() => updateConfig({ blurAmount: 0.15, refraction: 1.6, chromAberration: 0.35 })}
                className="flex-1 py-1 rounded bg-white/10 hover:bg-white/20 text-center text-[10px] text-white/70 border border-white/15"
              >
                標準
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

