import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'white' | 'liquid';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'white',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app-theme') as Theme) || 'white';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    if (theme === 'liquid') {
      document.documentElement.classList.add('liquid-theme');
    } else {
      document.documentElement.classList.remove('liquid-theme');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'white' ? 'liquid' : 'white');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
