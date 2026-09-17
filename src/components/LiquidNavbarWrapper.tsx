import React, { useEffect, useRef } from 'react';

export function LiquidNavbarWrapper({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    let isCancelled = false;

    const initGlass = async () => {
      if (!rootRef.current) return;
      try {
        const { LiquidGlass } = await import('@ybouane/liquidglass');
        const glassElements = rootRef.current.querySelectorAll('.webgl-glass');
        if (glassElements.length === 0) return;
        
        const instance = await LiquidGlass.init({
          root: rootRef.current,
          glassElements: Array.from(glassElements) as HTMLElement[],
          defaults: {
            cornerRadius: 0,
            refraction: 0.8,
            blurAmount: 0.25,
            chromAberration: 0.05
          }
        });
        
        if (isCancelled) {
          instance.destroy();
        } else {
          instanceRef.current = instance;
        }
      } catch (e) {
        console.error("LiquidGlass init error", e);
      }
    };

    setTimeout(initGlass, 500);

    return () => {
      isCancelled = true;
      if (instanceRef.current) {
        instanceRef.current.destroy();
      }
    };
  }, []);

  return (
    <div ref={rootRef} className="w-full relative z-50">
      {/* Animated blobs behind the navbar */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ height: '3.5rem' }}>
         <div className="absolute top-[-2rem] left-[10%] w-32 h-32 bg-purple-400/60 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
         <div className="absolute top-[-1rem] left-[50%] w-32 h-32 bg-yellow-400/60 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000"></div>
         <div className="absolute top-[-2rem] right-[20%] w-32 h-32 bg-pink-400/60 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000"></div>
         <div className="absolute top-1 left-[80%] w-24 h-24 bg-blue-400/50 rounded-full mix-blend-multiply filter blur-xl animate-blob"></div>
      </div>
      
      {/* The navbar itself */}
      {children}
    </div>
  );
}
