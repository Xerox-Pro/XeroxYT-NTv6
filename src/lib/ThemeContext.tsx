import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'white' | 'liquid';

export interface LiquidGlassConfig {
  blurAmount: number;
  refraction: number;
  chromAberration: number;
  edgeHighlight: number;
  specular: number;
  fresnel: number;
  distortion: number;
  cornerRadius: number;
  zRadius: number;
  opacity: number;
  saturation: number;
  brightness: number;
  shadowOpacity: number;
  shadowSpread: number;
  bevelMode: number;
  floating?: boolean;
  button?: boolean;
}

export const LIQUID_PRESETS: Record<string, { name: string; desc: string; config: Partial<LiquidGlassConfig> }> = {
  prism: {
    name: '強プリズム (Prism Ultra)',
    desc: '強い屈折と虹色の色収差による高屈折プリズム効果（標準推奨）',
    config: {
      blurAmount: 0.15,
      refraction: 1.82,
      chromAberration: 0.36,
      edgeHighlight: 0.24,
      specular: 0.32,
      fresnel: 0.85,
      shadowOpacity: 0.35,
      brightness: 0.02,
      saturation: 0.05,
      bevelMode: 0,
    },
  },
  crystal: {
    name: 'クリスタル (Crystal Clear)',
    desc: 'ほぼぼかし無しの超高透明度ガラスとシャープな光沢',
    config: {
      blurAmount: 0.05,
      refraction: 1.55,
      chromAberration: 0.22,
      edgeHighlight: 0.18,
      specular: 0.35,
      fresnel: 0.9,
      shadowOpacity: 0.3,
      brightness: 0,
      saturation: 0,
      bevelMode: 0,
    },
  },
  frosted: {
    name: '曇りガラス (Frosted Panel)',
    desc: '適度なぼかしが効いたソフトなフロストグラス',
    config: {
      blurAmount: 0.35,
      refraction: 0.85,
      chromAberration: 0.08,
      edgeHighlight: 0.12,
      specular: 0.15,
      fresnel: 0.7,
      shadowOpacity: 0.3,
      brightness: 0,
      saturation: 0,
      bevelMode: 0,
    },
  },
  dark: {
    name: 'ダークグラス (Dark Glass)',
    desc: '深みのある黒味とコントラストを帯びたサイバーグラス',
    config: {
      blurAmount: 0.2,
      refraction: 1.4,
      chromAberration: 0.25,
      edgeHighlight: 0.2,
      specular: 0.28,
      fresnel: 0.8,
      shadowOpacity: 0.45,
      brightness: -0.28,
      saturation: -0.1,
      bevelMode: 0,
    },
  },
};

const DEFAULT_CONFIG: LiquidGlassConfig = {
  blurAmount: 0.15, // standard low blur requested by user
  refraction: 1.82, // strong distortion requested
  chromAberration: 0.36, // strong prism effect
  edgeHighlight: 0.24,
  specular: 0.32,
  fresnel: 0.85,
  distortion: 0.05,
  cornerRadius: 24,
  zRadius: 40,
  opacity: 1,
  saturation: 0.05,
  brightness: 0.02,
  shadowOpacity: 0.35,
  shadowSpread: 12,
  bevelMode: 0,
};

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  config: LiquidGlassConfig;
  updateConfig: (patch: Partial<LiquidGlassConfig>) => void;
  activePreset: string;
  applyPreset: (presetKey: string) => void;
  showPrismInspector: boolean;
  setShowPrismInspector: (show: boolean) => void;
  showFloatingDome: boolean;
  setShowFloatingDome: (show: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'white',
  setTheme: () => {},
  config: DEFAULT_CONFIG,
  updateConfig: () => {},
  activePreset: 'prism',
  applyPreset: () => {},
  showPrismInspector: false,
  setShowPrismInspector: () => {},
  showFloatingDome: false,
  setShowFloatingDome: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('xerox_theme') as Theme) || 'liquid'; // Default to liquid theme
  });

  const [activePreset, setActivePreset] = useState<string>(() => {
    return localStorage.getItem('xerox_liquid_preset') || 'prism';
  });

  const [config, setConfig] = useState<LiquidGlassConfig>(() => {
    try {
      const saved = localStorage.getItem('xerox_liquid_config');
      if (saved) return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_CONFIG;
  });

  const [showPrismInspector, setShowPrismInspector] = useState(false);
  const [showFloatingDome, setShowFloatingDome] = useState(false);

  useEffect(() => {
    localStorage.setItem('xerox_theme', theme);
    if (theme === 'liquid') {
      document.body.classList.add('theme-liquid');
      document.body.classList.remove('theme-white');
    } else {
      document.body.classList.add('theme-white');
      document.body.classList.remove('theme-liquid');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('xerox_liquid_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('xerox_liquid_preset', activePreset);
  }, [activePreset]);

  const updateConfig = (patch: Partial<LiquidGlassConfig>) => {
    setConfig(prev => ({ ...prev, ...patch }));
  };

  const applyPreset = (presetKey: string) => {
    const preset = LIQUID_PRESETS[presetKey];
    if (preset) {
      setActivePreset(presetKey);
      setConfig(prev => ({ ...prev, ...preset.config }));
    }
  };

  return (
    <ThemeContext.Provider
      value={{
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
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
