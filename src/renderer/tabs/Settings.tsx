import { useEffect, useState } from 'react';
import { SPIN_THRESHOLD_MAX, SPIN_THRESHOLD_MIN, type ReceiverInfo, type SpinState } from '@shared/types';

export function Settings() {
  const [spin, setSpin] = useState<SpinState | null>(null);
  const [receiver, setReceiver] = useState<ReceiverInfo | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>('');
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const refetch = () => {
      window.codeling.getSpinState().then((s) => {
        setSpin(s);
        setThresholdDraft(String(s.spinThreshold));
      }).catch(console.error);
    };
    refetch();
    window.codeling.getReceiverInfo().then(setReceiver).catch(console.error);
    return window.codeling.onUpdate(refetch);
  }, []);

  async function commitThreshold() {
    setThresholdError(null);
    const n = Number(thresholdDraft);
    if (!Number.isInteger(n)) {
      setThresholdError('Whole number required');
      return;
    }
    const res = await window.codeling.setSpinThreshold(n);
    if ('ok' in res) {
      // Live update via codeling:update will refetch spin state and resync draft.
      return;
    }
    setThresholdError(`Must be between ${res.min} and ${res.max}`);
  }

  async function performReset() {
    if (resetting) return;
    setResetting(true);
    try {
      await window.codeling.resetSave();
      setConfirmReset(false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="settings">
      <Section title="Game">
        <div className="setting-row">
          <div className="setting-row__main">
            <div className="setting-row__label">Spin threshold</div>
            <div className="setting-row__hint">User messages between free spins</div>
          </div>
          <div className="setting-row__action">
            <input
              className="setting-input"
              type="number"
              min={SPIN_THRESHOLD_MIN}
              max={SPIN_THRESHOLD_MAX}
              step={1}
              value={thresholdDraft}
              onChange={(e) => setThresholdDraft(e.target.value)}
              onBlur={commitThreshold}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                if (e.key === 'Escape' && spin) setThresholdDraft(String(spin.spinThreshold));
              }}
            />
            {thresholdError && <div className="setting-error">{thresholdError}</div>}
          </div>
        </div>
      </Section>

      <Section title="Receiver">
        <div className="setting-row setting-row--info">
          <div className="setting-row__label">HTTP endpoint</div>
          <code className="setting-code">{receiver?.http ?? '…'}</code>
        </div>
        <div className="setting-row setting-row--info">
          <div className="setting-row__label">gRPC endpoint</div>
          <code className="setting-code">{receiver?.grpc ?? '…'}</code>
        </div>
        <div className="setting-row__hint setting-row__hint--block">
          Run <code>scripts/install-telemetry.{`{ps1,sh}`}</code> install to point Claude Code at these.
        </div>
      </Section>

      <Section title="Danger zone">
        {!confirmReset ? (
          <button className="danger-btn" onClick={() => setConfirmReset(true)}>
            Reset save
          </button>
        ) : (
          <div className="danger-confirm">
            <div className="danger-confirm__msg">
              This wipes pet, sessions, unlocks, and event log. Default wizard returns. <strong>Cannot be undone.</strong>
            </div>
            <div className="danger-confirm__actions">
              <button className="danger-btn" onClick={performReset} disabled={resetting}>
                {resetting ? 'Resetting…' : 'Yes, reset everything'}
              </button>
              <button className="ghost-btn" onClick={() => setConfirmReset(false)} disabled={resetting}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="settings-section">
      <div className="settings-section__title">{title}</div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}
