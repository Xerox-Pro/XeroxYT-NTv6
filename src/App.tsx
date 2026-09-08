import { Routes, Route } from 'react-router-dom';
import MainApp from './MainApp';
import AIStudio from './components/AIStudio';

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<MainApp />} />
      <Route path="/aistudio" element={<AIStudio />} />
    </Routes>
  );
}
