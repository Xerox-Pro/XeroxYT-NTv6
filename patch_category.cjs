const fs = require('fs');
let code = fs.readFileSync('src/components/CategoryBar.tsx', 'utf8');

// Add import
code = code.replace(
  /import React, \{ useState, useEffect, useRef \} from 'react';/,
  `import React, { useState, useEffect, useRef } from 'react';\nimport { useTheme } from '../contexts/ThemeContext';`
);

// Add useTheme hook
code = code.replace(
  /export default function CategoryBar\(\{ onSelectCategory, selectedCategory = 'すべて' \}: CategoryBarProps\) \{/,
  `export default function CategoryBar({ onSelectCategory, selectedCategory = 'すべて' }: CategoryBarProps) {\n  const { theme } = useTheme();\n  const isLiquid = theme === 'liquid';`
);

// Update classes
code = code.replace(
  /className="relative h-14 bg-white border-b border-gray-200 sticky top-14 z-30 select-none shadow-2xs"/,
  `className={\`relative h-14 sticky top-14 z-30 select-none shadow-2xs \${isLiquid ? 'border-b border-white/20 backdrop-blur-md bg-white/5 text-white' : 'bg-white border-b border-gray-200'}\`}`
);

code = code.replace(
  /className={`relative px-3\.5 py-1\.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1\.5 \${[^]*?}`}/,
  `className={\`relative px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 \${
    isActive 
      ? (isLiquid ? 'text-black' : 'text-white') 
      : isHashtag 
        ? (isLiquid ? 'bg-cyan-900/40 text-cyan-200 border border-cyan-500/30' : 'bg-blue-50 text-blue-800 border border-blue-200') 
        : (isLiquid ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-100 text-gray-800 hover:bg-gray-200')
  }\`}`
);

code = code.replace(
  /className="absolute inset-0 bg-gray-900 rounded-lg -z-0"/,
  `className={\`absolute inset-0 rounded-lg -z-0 \${isLiquid ? 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'bg-gray-900'}\`}`
);

fs.writeFileSync('src/components/CategoryBar.tsx', code);
