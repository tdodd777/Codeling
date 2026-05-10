import { useEffect, useRef, useState } from 'react';
import { PET_NAME_MAX_LENGTH, type PetState, type SpinResponse, type SpinResult, type SpinState, type SpriteManifest } from '@shared/types';
import { PetSprite } from '../components/PetSprite';

const TOAST_AUTO_DISMISS_MS = 3500;

function describeApplied(result: SpinResult): string {
  const { applied, reward } = result;
  if (applied.kind === 'cosmetic') return `${reward.label} unlocked!`;
  if (applied.kind === 'xp') {
    const lvl = applied.levelsGained > 0 ? ` (Lv +${applied.levelsGained})` : '';
    return `+${applied.amount} XP${lvl}`;
  }
  if (applied.consolationFor) return `Already owned — +${applied.amount} bits instead`;
  return `+${applied.amount} bits`;
}

export function Home() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [spin, setSpin] = useState<SpinState | null>(null);
  const [streak, setStreak] = useState(0);
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<SpinResult | null>(null);
  const dismissRef = useRef<number | null>(null);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getPet().then(setPet).catch(console.error);
      window.codeling.getSpinState().then(setSpin).catch(console.error);
      window.codeling.getStreak().then(setStreak).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  // Background scenery is per (species, stage). Refetch when either changes —
  // evolution lands as a pet update which triggers this effect.
  useEffect(() => {
    if (!pet) return;
    window.codeling
      .getSprites(pet.species, pet.evolutionStage)
      .then(setManifest)
      .catch(console.error);
  }, [pet?.species, pet?.evolutionStage]);

  useEffect(
    () => () => {
      if (dismissRef.current !== null) window.clearTimeout(dismissRef.current);
    },
    [],
  );

  function showToast(result: SpinResult) {
    setToast(result);
    if (dismissRef.current !== null) window.clearTimeout(dismissRef.current);
    dismissRef.current = window.setTimeout(() => setToast(null), TOAST_AUTO_DISMISS_MS);
  }

  function dismissToast() {
    setToast(null);
    if (dismissRef.current !== null) {
      window.clearTimeout(dismissRef.current);
      dismissRef.current = null;
    }
  }

  async function handleSpin() {
    if (busy) return;
    setBusy(true);
    try {
      const res: SpinResponse = await window.codeling.spin();
      if ('error' in res) {
        // Race: counter went to 0 between render and click — UI will refresh on its own.
        return;
      }
      showToast(res);
    } catch (err) {
      console.error('[spin] failed', err);
    } finally {
      setBusy(false);
    }
  }

  if (!pet || !spin) {
    return <div className="loading">Loading…</div>;
  }

  const xpPct = Math.min(100, Math.round((pet.xp / Math.max(1, pet.level * 100)) * 100));
  const remaining = Math.max(0, spin.spinThreshold - spin.messagesSinceLastSpin);
  const spinReady = spin.spinsAvailable > 0;

  return (
    <div className="home">
      <div
        className={`pet-stage ${manifest?.background ? 'pet-stage--scenic' : ''}`}
        style={manifest?.background ? { backgroundImage: `url("${manifest.background}")` } : undefined}
      >
        <PetSprite species={pet.species} stage={pet.evolutionStage} size={128} />
      </div>

      <div className="pet-meta">
        <PetNameEdit currentName={pet.name} />
        <div className="pet-level">Lv {pet.level}</div>
        <div className="xp-bar">
          <div className="xp-bar__fill" style={{ width: `${xpPct}%` }} />
        </div>
        <div className="pet-meta__row">
          <div className="bits">{pet.bits} bits</div>
          {streak > 0 && (
            <div className="streak" title="Consecutive days with activity">
              {streak}-day streak
            </div>
          )}
        </div>
      </div>

      <div className={`spin ${spinReady ? 'spin--ready' : 'spin--locked'}`}>
        {spinReady ? (
          <button className="spin-btn" onClick={handleSpin} disabled={busy}>
            {busy ? 'Spinning…' : `Spin! (${spin.spinsAvailable})`}
          </button>
        ) : (
          <div className="spin-progress">Spin available in {remaining} messages</div>
        )}
      </div>

      {toast && (
        <div className="spin-toast-backdrop" onClick={dismissToast}>
          <div
            className={`spin-toast spin-toast--${toast.reward.tier}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="spin-toast__tier">{toast.reward.tier}</div>
            <div className="spin-toast__label">{toast.reward.label}</div>
            <div className="spin-toast__detail">{describeApplied(toast)}</div>
            <button className="spin-toast__close" onClick={dismissToast}>
              Sweet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PetNameEdit({ currentName }: { currentName: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Sync draft when external updates change the name (e.g., another window).
  useEffect(() => {
    if (!editing) setDraft(currentName);
  }, [currentName, editing]);

  function startEdit() {
    setDraft(currentName);
    setError(null);
    setEditing(true);
    // Focus + select happens after the input mounts.
    queueMicrotask(() => inputRef.current?.select());
  }

  async function commit() {
    const next = draft.trim();
    if (next === currentName) {
      setEditing(false);
      return;
    }
    if (next.length === 0) {
      setError('Name required');
      return;
    }
    const res = await window.codeling.renamePet(next);
    if ('ok' in res) {
      setError(null);
      setEditing(false);
    } else {
      setError(res.error === 'name-too-long' ? `Max ${PET_NAME_MAX_LENGTH} chars` : 'Name required');
    }
  }

  function cancel() {
    setDraft(currentName);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="pet-name pet-name--button"
        onClick={startEdit}
        title="Click to rename"
      >
        {currentName}
      </button>
    );
  }

  return (
    <div className="pet-name-edit">
      <input
        ref={inputRef}
        className="pet-name-input"
        value={draft}
        maxLength={PET_NAME_MAX_LENGTH}
        onChange={(e) => {
          setDraft(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          else if (e.key === 'Escape') cancel();
        }}
        onBlur={commit}
        autoFocus
      />
      {error && <div className="pet-name-error">{error}</div>}
    </div>
  );
}
