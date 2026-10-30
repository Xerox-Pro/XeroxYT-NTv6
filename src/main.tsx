import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Router, createPath, parsePath, NavigationType } from 'react-router-dom';
import type { Location, To } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { initPWA } from './pwa';

const LAST_PAGE_KEY = 'xerox_last_page';
const HISTORY_KEY = '__xerox_page';

type Entry = { path: string; state: unknown; key: string };

function validPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

function makeLocation(entry: Entry): Location {
  const parsed = parsePath(entry.path);
  return {
    pathname: parsed.pathname || '/',
    search: parsed.search || '',
    hash: parsed.hash || '',
    state: entry.state ?? null,
    key: entry.key,
  };
}

function readEntry(): Entry | null {
  const entry = window.history.state?.[HISTORY_KEY];
  if (!entry || !validPath(entry.path) || typeof entry.key !== 'string') return null;
  return entry;
}

function newEntry(to: To, state: unknown): Entry {
  const path = typeof to === 'string' ? to : createPath(to);
  return { path: validPath(path) ? path : '/', state: state ?? null, key: Math.random().toString(36).slice(2, 10) };
}

function initializeEntry(): Entry {
  const address = window.location.pathname + window.location.search + window.location.hash;
  let path = address;
  let entry = address === '/' ? readEntry() : null;
  if (!entry && address === '/') {
    try {
      const saved = localStorage.getItem(LAST_PAGE_KEY);
      path = validPath(saved) ? saved : '/';
    } catch {
      path = '/';
    }
  }
  if (!entry) entry = newEntry(path, null);
  window.history.replaceState({ ...window.history.state, [HISTORY_KEY]: entry }, '', '/');
  return entry;
}

const initialEntry = initializeEntry();

function CleanUrlRouter() {
  const [navigation, setNavigation] = useState<{ action: NavigationType; location: Location }>(() => ({
    action: NavigationType.Pop, location: makeLocation(initialEntry),
  }));

  const navigator = useMemo(() => ({
    createHref: () => '/',
    encodeLocation: (to: To) => {
      const parsed = typeof to === 'string' ? parsePath(to) : to;
      return { pathname: parsed.pathname || '/', search: parsed.search || '', hash: parsed.hash || '' };
    },
    go: (delta: number) => window.history.go(delta),
    push: (to: To, state?: unknown) => {
      const entry = newEntry(to, state);
      window.history.pushState({ ...window.history.state, [HISTORY_KEY]: entry }, '', '/');
      setNavigation({ action: NavigationType.Push, location: makeLocation(entry) });
    },
    replace: (to: To, state?: unknown) => {
      const entry = newEntry(to, state);
      window.history.replaceState({ ...window.history.state, [HISTORY_KEY]: entry }, '', '/');
      setNavigation({ action: NavigationType.Replace, location: makeLocation(entry) });
    },
  }), []);

  useEffect(() => {
    const onPopState = () => {
      const entry = readEntry();
      if (entry) setNavigation({ action: NavigationType.Pop, location: makeLocation(entry) });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return <Router location={navigation.location} navigationType={navigation.action} navigator={navigator}><App /></Router>;
}

initPWA();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CleanUrlRouter />
  </StrictMode>,
);
