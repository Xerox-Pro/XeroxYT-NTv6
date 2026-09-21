import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';
import { GlobalLiquidBackground, FloatingDomeLens, PrismInspector } from './lib/Liquid';

export default function App() {
  return (
    <>
      <GlobalLiquidBackground />
      <FloatingDomeLens />
      <PrismInspector />
      <PWAUpdateIndicator />
      <Routes>
        <Route path="/*" element={<MainApp />} />
        <Route path="/aistudio" element={<AIStudio />} />
      </Routes>
    </>
  );
}

