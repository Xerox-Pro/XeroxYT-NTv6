const fs = require('fs');
let code = fs.readFileSync('src/components/VideoCard.tsx', 'utf8');

// Add import
code = code.replace(
  /import React, \{ useState, useEffect, useRef \} from 'react';/,
  `import React, { useState, useEffect, useRef } from 'react';\nimport { useTheme } from '../contexts/ThemeContext';`
);

// Add useTheme hook
code = code.replace(
  /export default function VideoCard\(\{ video, onClick, onSelectChannel, size = 'normal', isCompact = false \}: VideoCardProps\) \{/,
  `export default function VideoCard({ video, onClick, onSelectChannel, size = 'normal', isCompact = false }: VideoCardProps) {\n  const { theme } = useTheme();\n  const isLiquid = theme === 'liquid';`
);

// Modify outer container
code = code.replace(
  /className=\{(?:`|")flex cursor-pointer group[^]*?(?:`|")\}/,
  `className={\`flex cursor-pointer group \${isCompact ? 'flex-row gap-3 sm:gap-4 hover:bg-gray-50/50 p-2 sm:p-3 rounded-xl transition-colors' : 'flex-col gap-3'} \${isLiquid ? 'hover:bg-white/5 rounded-2xl p-2 transition-all backdrop-blur-sm' : ''}\`}`
);

// Modify text colors
code = code.replace(
  /className="text-sm font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-700 transition-colors"/g,
  `className={\`text-sm font-semibold line-clamp-2 transition-colors \${isLiquid ? 'text-white group-hover:text-cyan-300' : 'text-gray-900 group-hover:text-blue-700'}\`}`
);

code = code.replace(
  /className="text-xs text-gray-500 mt-1 flex flex-col gap-0\.5"/g,
  `className={\`text-xs mt-1 flex flex-col gap-0.5 \${isLiquid ? 'text-gray-300' : 'text-gray-500'}\`}`
);

code = code.replace(
  /className="hover:text-gray-800 transition-colors"/g,
  `className={\`transition-colors \${isLiquid ? 'hover:text-white' : 'hover:text-gray-800'}\`}`
);

fs.writeFileSync('src/components/VideoCard.tsx', code);
