import { useEffect, useState } from 'react';
import { Home } from './tabs/Home';
import { Settings } from './tabs/Settings';
import { Shop } from './tabs/Shop';
import { Stats } from './tabs/Stats';

type Tab = 'home' | 'shop' | 'stats' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string; hotkey: string }> = [
  { id: 'home', label: 'Home', hotkey: '1' },
  { id: 'shop', label: 'Shop', hotkey: '2' },
  { id: 'stats', label: 'Stats', hotkey: '3' },
  { id: 'settings', label: 'Settings', hotkey: '4' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');

  // Cmd/Ctrl+1..4 switches tabs. Skip when the user is typing in an input —
  // otherwise digits typed into the spin-threshold input or the rename field
  // would steal focus to a tab. The modifier key matches the ⌘/Ctrl pattern
  // most apps already use for tab switching.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const found = TABS.find((t) => t.hotkey === e.key);
      if (!found) return;
      e.preventDefault();
      setTab(found.id);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'tab--active' : ''}`}
            onClick={() => setTab(t.id)}
            title={`${t.label} — Ctrl+${t.hotkey}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <main className="panel">
        {tab === 'home' && <Home />}
        {tab === 'shop' && <Shop />}
        {tab === 'stats' && <Stats />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
