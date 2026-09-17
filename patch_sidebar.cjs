const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Add import
code = code.replace(
  /import React from 'react';/,
  `import React from 'react';\nimport { useTheme } from '../contexts/ThemeContext';`
);

// Add useTheme hook
code = code.replace(
  /export default function Sidebar\(\{ isOpen, onClose, currentView, onHome, onSubscriptions, onLibrary, onHistory \}: SidebarProps\) \{/,
  `export default function Sidebar({ isOpen, onClose, currentView, onHome, onSubscriptions, onLibrary, onHistory }: SidebarProps) {\n  const { theme } = useTheme();\n  const isLiquid = theme === 'liquid';`
);

// Modify main aside className
code = code.replace(
  /className=\{(?:`|")[^]*?w-64 shrink-0 fixed inset-y-0 left-0 xl:relative z-40 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300[^]*?(?:`|")\}/,
  `className={\`w-64 shrink-0 fixed inset-y-0 left-0 xl:relative z-40 flex flex-col transition-transform duration-300 \${isOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0 xl:w-64'} \${isLiquid ? 'backdrop-blur-xl bg-white/5 border-r border-white/20 text-white' : 'bg-white border-r border-gray-200'}\`}`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
