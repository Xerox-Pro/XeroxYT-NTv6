import React, { useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Palette } from 'lucide-react';
import { LiquidGlass } from '@ybouane/liquidglass';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    if (theme === 'liquid' && rootRef.current) {
      try {
        LiquidGlass.init({
          root: rootRef.current,
          glassElements: rootRef.current.querySelectorAll('.glass'),
        }).then((inst) => {
          if (active) {
            instanceRef.current = inst;
          } else {
            inst?.destroy();
          }
        }).catch((err) => {
          console.warn('ThemeToggle LiquidGlass fallback:', err);
        });
      } catch (err) {
        console.warn('ThemeToggle LiquidGlass init error:', err);
      }
    }

    return () => {
      active = false;
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
    };
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'white' ? 'liquid' : 'white');
  };

  const isLiquid = theme === 'liquid';

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-16 h-16">
      <div ref={rootRef} className="relative w-full h-full">
        {/* Background to refract for the button */}
        {isLiquid && (
          <div className="absolute inset-[-50%] bg-gradient-to-br from-cyan-400 via-fuchsia-500 to-purple-600 rounded-full animate-pulse blur-xl opacity-70" />
        )}
        
        <button
          onClick={toggleTheme}
          className={`
            flex items-center justify-center rounded-full shadow-2xl transition-all duration-300
            ${isLiquid ? 'liquid-glass-button glass w-full h-full absolute inset-0 text-white' : 'w-14 h-14 bg-gray-900 text-white hover:bg-black hover:scale-105 m-1'}
          `}
          data-config={JSON.stringify({
            button: true,
            refraction: 1.6,
            chromAberration: 0.9,
            blurAmount: 0,
            cornerRadius: 64,
            zRadius: 50,
            bevelMode: 1, // Dome shape
          })}
          title="Toggle Theme"
        >
          <Palette className="w-6 h-6 z-10" />
        </button>
      </div>
    </div>
  );
}
