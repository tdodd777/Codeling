import { useState } from 'react';
import { Home } from './tabs/Home';
import { Settings } from './tabs/Settings';
import { Shop } from './tabs/Shop';
import { Stats } from './tabs/Stats';

type Tab = 'home' | 'shop' | 'stats' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="app">
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'tab--active' : ''}`}
            onClick={() => setTab(t.id)}
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
