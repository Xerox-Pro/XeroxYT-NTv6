const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf8');

// Add import
code = code.replace(
  /import React, \{ useState, useEffect, useRef \} from 'react';\nimport \{ useNavigate, useLocation \} from 'react-router-dom';/,
  `import React, { useState, useEffect, useRef } from 'react';\nimport { useNavigate, useLocation } from 'react-router-dom';\nimport { useTheme } from '../contexts/ThemeContext';`
);

// Add useTheme hook inside Navbar component
code = code.replace(
  /export default function Navbar\(\{ onSearch, onHome, toggleSidebar, initialSearchQuery = '' \}: NavbarProps\) \{/,
  `export default function Navbar({ onSearch, onHome, toggleSidebar, initialSearchQuery = '' }: NavbarProps) {\n  const { theme } = useTheme();\n  const isLiquid = theme === 'liquid';`
);

// Replace header className
code = code.replace(
  /<header className="w-full min-h-\[3\.5rem\] bg-white text-gray-900 flex flex-wrap items-center justify-between px-4 py-2 border-b border-gray-200 shadow-xs relative z-50">/,
  `<header className={\`w-full min-h-[3.5rem] flex flex-wrap items-center justify-between px-4 py-2 border-b shadow-xs relative z-50 \${isLiquid ? 'text-white border-white/20 bg-transparent' : 'bg-white text-gray-900 border-gray-200'}\`}>`
);

// Search bar input container
code = code.replace(
  /<div className="flex w-full bg-white rounded-full border border-gray-300 focus-within:border-gray-500 focus-within:shadow-inner shadow-xs transition-all duration-150">/,
  `<div className={\`flex w-full rounded-full border focus-within:shadow-inner shadow-xs transition-all duration-150 \${isLiquid ? 'bg-white/10 border-white/30 focus-within:border-white/60 text-white' : 'bg-white border-gray-300 focus-within:border-gray-500'}\`}>`
);

fs.writeFileSync('src/components/Navbar.tsx', code);
