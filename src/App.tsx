import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';
import { ThemeProvider } from './contexts/ThemeContext';
import ThemeToggle from './components/ThemeToggle';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PWAUpdateIndicator />
        <ThemeToggle />
        <Routes>
          <Route path="/*" element={<MainApp />} />
          <Route path="/aistudio" element={<AIStudio />} />
        </Routes>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
