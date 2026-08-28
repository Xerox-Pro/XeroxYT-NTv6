import React, { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { Fingerprint, X, Loader2 } from 'lucide-react';
import { UserInfo } from '../types';
import axios from 'axios';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userInfo: UserInfo, data: any) => void;
}

export default function LoginModal({ isOpen, onClose, onSuccess }: LoginModalProps) {
  const [userId, setUserId] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      // 1. Get options from server
      const optRes = await axios.post('/api/auth/options', { userId });
      const { type, options } = optRes.data;

      let authResponse;
      
      // 2. Interact with Authenticator (Fingerprint/Passkey)
      if (type === 'register') {
        authResponse = await startRegistration({ optionsJSON: options });
        // 3. Verify Registration
        const verifyRes = await axios.post('/api/auth/verify-registration', {
          userId,
          response: authResponse,
        });
        
        if (verifyRes.data.success) {
          localStorage.setItem('authToken', verifyRes.data.token);
          onSuccess({ id: userId, name: userId, isLoggedIn: true }, verifyRes.data.data);
          setStatus('success');
        }
      } else {
        authResponse = await startAuthentication({ optionsJSON: options });
        // 3. Verify Authentication
        const verifyRes = await axios.post('/api/auth/verify-authentication', {
          userId,
          response: authResponse,
        });

        if (verifyRes.data.success) {
          localStorage.setItem('authToken', verifyRes.data.token);
          onSuccess({ id: userId, name: userId, isLoggedIn: true }, verifyRes.data.data);
          setStatus('success');
        }
      }
      setTimeout(onClose, 1000);
    } catch (err: any) {
      console.error('Auth Error:', err);
      setStatus('error');
      setErrorMessage(err.response?.data?.error || err.message || '認証に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <Fingerprint className="w-8 h-8" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">ログイン / 登録</h2>
          <p className="text-sm text-center text-gray-500 mb-8">
            アカウントIDを入力して、指紋やパスキー（WebAuthn）で安全にログインします。<br/>
            <span className="text-xs">※データはGitHubに暗号化されて保存されます</span>
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アカウントID (自由に入力)
              </label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="例: my-secret-id-123"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                disabled={status === 'loading' || status === 'success'}
                required
              />
            </div>

            {status === 'error' && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                {errorMessage}
              </div>
            )}
            
            {status === 'success' && (
              <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100 font-medium text-center">
                認証に成功しました！
              </div>
            )}

            <button
              type="submit"
              disabled={!userId.trim() || status === 'loading' || status === 'success'}
              className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  認証中...
                </>
              ) : (
                <>
                  <Fingerprint className="w-5 h-5" />
                  指紋・パスキーで認証
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
