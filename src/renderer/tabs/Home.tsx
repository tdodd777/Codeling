import { useEffect, useMemo, useRef, useState } from 'react';
import { PET_NAME_MAX_LENGTH, SPECIES_CATALOG, type AnimationView, type PetState, type SpeciesAnimationsCatalog, type SpinResponse, type SpinResult, type SpinState, type SpriteManifest } from '@shared/types';
import { PetSprite } from '../components/PetSprite';

const TOAST_AUTO_DISMISS_MS = 3500;

function describeApplied(result: SpinResult): string {
  const { applied } = result;
  if (applied.kind === 'xp') {
    const lvl = applied.levelsGained > 0 ? ` (Lv +${applied.levelsGained})` : '';
    return `+${applied.amount} XP${lvl}`;
  }
  if (applied.kind === 'species') {
    return `${SPECIES_CATALOG[applied.species].label} added to your collection!`;
  }
  if (applied.consolationFor === 'species_token') {
    return `You own them all — +${applied.amount} bits instead`;
  }
  return `+${applied.amount} bits`;
}

export function Home() {
  const [pet, setPet] = useState<PetState | null>(null);
  const [spin, setSpin] = useState<SpinState | null>(null);
  const [streak, setStreak] = useState(0);
  const [manifest, setManifest] = useState<SpriteManifest | null>(null);
  const [animCatalog, setAnimCatalog] = useState<SpeciesAnimationsCatalog>({});
  const [homeAnim, setHomeAnim] = useState<string>('idle');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<SpinResult | null>(null);
  const dismissRef = useRef<number | null>(null);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getPet().then(setPet).catch(console.error);
      window.codeling.getSpinState().then(setSpin).catch(console.error);
      window.codeling.getStreak().then(setStreak).catch(console.error);
      window.codeling.getAnimationsCatalog().then(setAnimCatalog).catch(console.error);
    };
    refetch();
    return window.codeling.onUpdate(refetch);
  }, []);

  // Background scenery + manifest is per species. Refetch when the active
  // species changes — also pulls the saved Home animation preference for
  // that species (defaults to 'idle' when nothing was ever set). Clear the
  // manifest to null first so a stale frame from the previous species
  // doesn't render between species swap and manifest arrival.
  useEffect(() => {
    if (!pet) return;
    setManifest(null);
    window.codeling
      .getSprites(pet.species)
      .then(setManifest)
      .catch(console.error);
    window.codeling
      .getHomeAnimation(pet.species)
      .then(setHomeAnim)
      .catch(console.error);
  }, [pet?.species]);

  // Available picker options = owned animations for the active species from
  // the catalog. Catalog already dedupes by canonical name.
  const pickerOptions = useMemo<AnimationView[]>(() => {
    if (!pet) return [];
    const list = animCatalog[pet.species] ?? [];
    return list.filter((a) => a.owned);
  }, [pet?.species, animCatalog]);

  // Safety: if the saved preference points to an animation the player no
  // longer owns (shouldn't happen — unlocks are append-only — but resetSave
  // could wipe), fall back to idle.
  const effectiveAnim = useMemo(() => {
    if (homeAnim === 'idle') return 'idle';
    return pickerOptions.some((a) => a.name === homeAnim) ? homeAnim : 'idle';
  }, [homeAnim, pickerOptions]);

  async function handlePickAnim(name: string) {
    if (!pet) return;
    if (name === homeAnim) return;
    setHomeAnim(name); // optimistic
    const res = await window.codeling.setHomeAnimation(pet.species, name);
    if ('error' in res) {
      // Roll back optimistic update on the off-chance the main process rejects.
      window.codeling.getHomeAnimation(pet.species).then(setHomeAnim).catch(console.error);
    }
  }

  useEffect(
    () => () => {
      if (dismissRef.current !== null) window.clearTimeout(dismissRef.current);
    },
    [],
  );

  // Esc dismisses an open spin reveal toast. Conditional listener — no point
  // attaching when the toast isn't shown, and avoids stealing Esc from inputs.
  useEffect(() => {
    if (!toast) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') dismissToast();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // dismissToast captures dismissRef; it's stable across renders (ref +
    // setState only), so the eslint-deps warning is a false positive here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

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
        <PetSprite species={pet.species} manifest={manifest} size={128} animation={effectiveAnim} />
      </div>

      {pickerOptions.length > 1 && (
        <div className="anim-picker" role="radiogroup" aria-label="Pet animation">
          {pickerOptions.map((opt) => (
            <button
              key={opt.name}
              type="button"
              role="radio"
              aria-checked={effectiveAnim === opt.name}
              className={`anim-picker__pill ${effectiveAnim === opt.name ? 'anim-picker__pill--on' : ''}`}
              onClick={() => handlePickAnim(opt.name)}
              title={opt.name}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}

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
