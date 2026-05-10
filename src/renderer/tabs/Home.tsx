import { useEffect, useState } from 'react';
import type { PetState, SpinState } from '@shared/types';
import { PetSprite } from '../components/PetSprite';

export function Home() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [spin, setSpin] = useState<SpinState | null>(null);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getPet().then(setPet).catch(console.error);
      window.codeling.getSpinState().then(setSpin).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  if (!pet || !spin) {
    return <div className="loading">Loading…</div>;
  }

  const xpPct = Math.min(100, Math.round((pet.xp / Math.max(1, pet.level * 100)) * 100));
  const remaining = Math.max(0, spin.spinThreshold - spin.messagesSinceLastSpin);
  const spinReady = spin.spinsAvailable > 0;

  return (
    <div className="home">
      <div className="pet-stage">
        <PetSprite species={pet.species} size={128} />
      </div>

      <div className="pet-meta">
        <div className="pet-name">{pet.name}</div>
        <div className="pet-level">Lv {pet.level}</div>
        <div className="xp-bar">
          <div className="xp-bar__fill" style={{ width: `${xpPct}%` }} />
        </div>
        <div className="bits">{pet.bits} bits</div>
      </div>

      <div className={`spin ${spinReady ? 'spin--ready' : 'spin--locked'}`}>
        {spinReady ? (
          <button className="spin-btn">Spin! ({spin.spinsAvailable})</button>
        ) : (
          <div className="spin-progress">Spin available in {remaining} messages</div>
        )}
      </div>
    </div>
  );
}
