import React, { useState } from 'react';
import { Search, Info, Play, Loader2 } from 'lucide-react';
import { fetchJSON } from '../utils';

export default function DebugAPI() {
  const [searchQuery, setSearchQuery] = useState('');
  const [videoId, setVideoId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchJSON(`/api/debug/search?q=${encodeURIComponent(searchQuery)}`);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetVideo = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchJSON(`/api/debug/video?id=${encodeURIComponent(videoId)}`);
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetHealth = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await fetchJSON('/api/health');
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Info className="text-blue-600" />
        API Debug Explorer
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 border rounded-xl shadow-sm bg-gray-50">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <Search size={16} /> Raw Search
          </h2>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search query..."
            className="w-full p-2 border rounded mb-2 text-sm"
          />
          <button 
            onClick={handleSearch}
            className="w-full bg-blue-600 text-white py-2 rounded text-sm font-bold hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
        </div>

        <div className="p-4 border rounded-xl shadow-sm bg-gray-50">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <Play size={16} /> Video Info
          </h2>
          <input 
            type="text" 
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="Video ID..."
            className="w-full p-2 border rounded mb-2 text-sm"
          />
          <button 
            onClick={handleGetVideo}
            className="w-full bg-green-600 text-white py-2 rounded text-sm font-bold hover:bg-green-700 transition-colors"
          >
            Get Info
          </button>
        </div>

        <div className="p-4 border rounded-xl shadow-sm bg-gray-50 flex flex-col justify-between">
          <h2 className="font-bold mb-2">System Health</h2>
          <button 
            onClick={handleGetHealth}
            className="w-full bg-gray-800 text-white py-2 rounded text-sm font-bold hover:bg-black transition-colors"
          >
            Check Health
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-100 rounded-xl mb-8">
          {error}
        </div>
      )}

      {result && (
        <div className="border rounded-xl shadow-inner bg-gray-900 text-green-400 p-6 overflow-auto max-h-[600px] font-mono text-xs">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
