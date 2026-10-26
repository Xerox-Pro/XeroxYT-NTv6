import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import PWAUpdateIndicator from './components/PWAUpdateIndicator';

export default function App() {
  return (
    <>
      <PWAUpdateIndicator />
      <Routes>
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </>
  );
}
