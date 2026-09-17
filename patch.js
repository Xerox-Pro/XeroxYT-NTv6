const fs = require('fs');
let code = fs.readFileSync('src/MainApp.tsx', 'utf8');
code = code.replace(
  /  return \(\n    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans antialiased selection:bg-red-100 selection:text-red-800">\n      <TopProgressBar isLoading=\{loading \|\| loadingMore\} \/>\n      \{\/\* ナビゲーションバー: 常に上部に固定しつつ、コンテンツと被らないようにする \*\/\}\n      <div className="w-full shrink-0 sticky top-0 z-50 bg-white">\n        <Navbar\n          onSearch=\{handleSearch\}\n          onHome=\{handleGoHome\}\n          toggleSidebar=\{\(\) => setIsSidebarOpen\(\!isSidebarOpen\)\}\n          initialSearchQuery=\{searchQuery\}\n        \/>\n      <\/div>\n      <div className="flex flex-1 relative items-start">/g,
  `  return (
    <div ref={rootRef} className={\`relative min-h-screen flex flex-col font-sans antialiased selection:bg-red-100 selection:text-red-800 \${theme === 'liquid' ? 'text-white overflow-hidden' : 'bg-white text-gray-900'}\`}>
      {theme === 'liquid' && (
        <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-full blur-[100px] animate-pulse opacity-60 mix-blend-screen"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-gradient-to-bl from-fuchsia-500 to-purple-600 rounded-full blur-[120px] animate-pulse opacity-60 mix-blend-screen" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-gradient-to-tr from-yellow-300 to-orange-500 rounded-full blur-[80px] animate-pulse opacity-40 mix-blend-screen" style={{ animationDelay: '4s' }}></div>
        </div>
      )}
      <TopProgressBar isLoading={loading || loadingMore} />
      {/* ナビゲーションバー: 常に上部に固定しつつ、コンテンツと被らないようにする */}
      <div className={\`w-full shrink-0 sticky top-0 z-50 \${theme === 'liquid' ? 'global-glass border-b border-white/20' : 'bg-white'}\`} data-config={JSON.stringify({ blurAmount: 0.2, refraction: 1.4, chromAberration: 0.5, cornerRadius: 0, zRadius: 20 })}>
        <Navbar
          onSearch={handleSearch}
          onHome={handleGoHome}
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          initialSearchQuery={searchQuery}
        />
      </div>
      <div className="flex flex-1 relative items-start" data-dynamic>`
);
fs.writeFileSync('src/MainApp.tsx', code);
