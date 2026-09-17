import { useEffect, useRef, useState } from 'react';
import { LiquidGlass } from './lib/liquidglass';
import { Sparkles, Moon, Sun, ArrowRight, Play, Maximize } from 'lucide-react';

export default function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'liquid' | 'white'>('liquid');

  useEffect(() => {
    if (theme !== 'liquid') return;
    
    let isMounted = true;
    let instance: any = null;

    const init = async () => {
      if (!rootRef.current) return;
      
      const glassEls = rootRef.current.querySelectorAll<HTMLElement>('.liquid-glass-el');
      
      try {
        const lg = await LiquidGlass.init({
          root: rootRef.current,
          glassElements: glassEls,
        });
        
        if (!isMounted) {
          lg.destroy();
        } else {
          instance = lg;
        }
      } catch (e) {
        console.error("LiquidGlass init failed", e);
      }
    };

    const timer = setTimeout(() => {
      init();
    }, 50);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (instance) {
        instance.destroy();
      }
    };
  }, [theme]);

  const isLiquid = theme === 'liquid';

  const getClasses = (base: string) => {
    if (isLiquid) {
      return `${base} liquid-glass-el text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]`;
    }
    return `${base} bg-white/70 backdrop-blur-xl border border-white text-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.06)]`;
  };

  return (
    <div 
      ref={rootRef} 
      className={`relative min-h-screen grid grid-cols-1 md:grid-cols-12 auto-rows-max gap-6 p-4 md:p-8 z-0 transition-colors duration-700 ${
        isLiquid ? 'bg-black' : 'bg-slate-100'
      }`}
    >
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        {isLiquid ? (
          <img
            src="https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2560&auto=format&fit=crop"
            className="w-full h-full object-cover opacity-90 scale-105"
            alt="Prism Background"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 via-white to-slate-200"></div>
        )}
      </div>

      <nav 
        className={getClasses("md:col-span-12 h-20 rounded-[2rem] flex items-center justify-between px-8")}
        data-config={JSON.stringify({
          blurAmount: 0.1, 
          refraction: 1.5, 
          chromAberration: 0.4,
          edgeHighlight: 0.15, 
          fresnel: 0.2,
          cornerRadius: 32, 
          zRadius: 50
        })}
      >
        <div className="flex items-center gap-3 font-black text-2xl tracking-tight">
          <Sparkles className={isLiquid ? "text-cyan-300" : "text-slate-900"} />
          PrismUI
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setTheme(t => t === 'liquid' ? 'white' : 'liquid')}
            className={`p-3 rounded-full transition-colors flex items-center justify-center ${
              isLiquid ? 'hover:bg-white/10' : 'hover:bg-slate-200/50'
            }`}
            title="Toggle Theme"
          >
            {isLiquid ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      <main 
        className={getClasses("md:col-span-8 md:row-span-3 min-h-[450px] rounded-[2rem] p-10 flex flex-col justify-end relative")}
        data-config={JSON.stringify({
          blurAmount: 0.1, 
          refraction: 1.3, 
          chromAberration: 0.3,
          edgeHighlight: 0.05, 
          specular: 0.1,
          fresnel: 0.1,
          cornerRadius: 32, 
          zRadius: 60
        })}
      >
        <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-[1.1]">
          Liquid Prism<br/>Optics Engine
        </h1>
        <p className="text-lg md:text-xl opacity-90 max-w-xl mb-10 font-medium leading-relaxed">
          Experience the power of real-time WebGL refraction, chromatic aberration,
          and liquid glass physics applied directly to the DOM.
        </p>
        <div className="flex flex-wrap gap-4">
          <button className={`px-8 py-4 rounded-2xl font-bold text-lg transition-transform hover:scale-105 active:scale-95 ${
            isLiquid 
              ? 'bg-white/20 hover:bg-white/30 backdrop-blur-md text-white' 
              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg'
          }`}>
            Get Started
          </button>
          <button className={`px-8 py-4 rounded-2xl font-bold text-lg transition-colors ${
            isLiquid 
              ? 'bg-transparent hover:bg-white/10 text-white' 
              : 'bg-transparent hover:bg-slate-200/50 text-slate-800'
          }`}>
            Read Docs
          </button>
        </div>
      </main>

      <button 
        className={getClasses("md:col-span-4 min-h-[140px] rounded-[2rem] p-8 flex items-center justify-between group text-left transition-transform hover:scale-[1.02] active:scale-[0.98]")}
        data-config={JSON.stringify({
          blurAmount: 0.1, 
          refraction: 2.2, 
          chromAberration: 0.6,
          edgeHighlight: 0.3, 
          specular: 0.4,
          button: true, 
          cornerRadius: 32, 
          zRadius: 50
        })}
      >
        <div>
          <div className="font-bold text-2xl mb-1">High Refraction</div>
          <div className="text-sm font-medium opacity-80 uppercase tracking-widest">Index: 2.2</div>
        </div>
        <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
      </button>

      <button 
        className={getClasses("md:col-span-4 min-h-[140px] rounded-[2rem] p-8 flex items-center justify-between group text-left transition-transform hover:scale-[1.02] active:scale-[0.98]")}
        data-config={JSON.stringify({
          blurAmount: 0.1, 
          refraction: 1.6, 
          chromAberration: 0.8,
          edgeHighlight: 0.2, 
          specular: 0.3,
          button: true, 
          cornerRadius: 32, 
          zRadius: 40
        })}
      >
        <div>
          <div className="font-bold text-2xl mb-1">Chromatic Shift</div>
          <div className="text-sm font-medium opacity-80 uppercase tracking-widest">Aberration: 0.8</div>
        </div>
        <Play className="w-8 h-8 group-hover:scale-110 transition-transform" />
      </button>

      <div 
        className={getClasses("md:col-span-4 min-h-[140px] rounded-[3rem] p-8 flex flex-col items-center justify-center cursor-move")}
        data-config={JSON.stringify({
          blurAmount: 0.1, 
          refraction: 1.8, 
          chromAberration: 0.5,
          bevelMode: 1, 
          floating: true, 
          cornerRadius: 48, 
          zRadius: 60
        })}
      >
        <Maximize className="w-8 h-8 mb-3 opacity-90" />
        <div className="font-bold text-lg text-center leading-tight">
          Dome Magnifier<br/>
          <span className="text-sm font-medium opacity-70 uppercase tracking-widest">Drag me around!</span>
        </div>
      </div>

    </div>
  );
}
