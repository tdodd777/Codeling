import { useEffect, useState } from 'react';
import { SPIN_THRESHOLD_MAX, SPIN_THRESHOLD_MIN, type ReceiverInfo, type SpinState } from '@shared/types';

export function Settings() {
  const [spin, setSpin] = useState<SpinState | null>(null);
  const [receiver, setReceiver] = useState<ReceiverInfo | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<string>('');
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [autoLaunch, setAutoLaunch] = useState<boolean | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
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
    window.codeling.getAutoLaunch().then(setAutoLaunch).catch(console.error);
    return window.codeling.onUpdate(refetch);
  }, []);

  useEffect(() => {
    if (!saveMessage) return;
    const t = window.setTimeout(() => setSaveMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [saveMessage]);

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

  async function toggleAutoLaunch() {
    if (autoLaunch === null) return;
    const next = !autoLaunch;
    const written = await window.codeling.setAutoLaunch(next);
    setAutoLaunch(written);
    if (written !== next) {
      // OS rejected the change (e.g., dev environment where setLoginItemSettings
      // is a no-op) — surface that so user knows the toggle didn't take.
      setSaveMessage({ kind: 'err', text: 'OS did not accept the change (try the packaged build)' });
    }
  }

  async function handleExport() {
    const res = await window.codeling.exportSave();
    if ('ok' in res) {
      setSaveMessage({ kind: 'ok', text: `Exported to ${res.path}` });
    } else if (res.error !== 'cancelled') {
      setSaveMessage({ kind: 'err', text: `Export failed: ${res.detail ?? res.error}` });
    }
  }

  async function handleImport() {
    const res = await window.codeling.importSave();
    if ('ok' in res) {
      setSaveMessage({ kind: 'ok', text: `Imported from ${res.path}` });
    } else if (res.error !== 'cancelled') {
      const detail = res.detail ? ` (${res.detail})` : '';
      setSaveMessage({ kind: 'err', text: `Import failed: ${res.error}${detail}` });
    }
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

      <Section title="Application">
        <div className="setting-row">
          <div className="setting-row__main">
            <div className="setting-row__label">Launch on login</div>
            <div className="setting-row__hint">Codeling starts in the tray when you sign in</div>
          </div>
          <div className="setting-row__action">
            <button
              className={`toggle ${autoLaunch ? 'toggle--on' : ''}`}
              onClick={toggleAutoLaunch}
              disabled={autoLaunch === null}
              role="switch"
              aria-checked={!!autoLaunch}
            >
              <span className="toggle__thumb" />
            </button>
          </div>
        </div>
      </Section>

      <Section title="Save">
        <div className="setting-row">
          <div className="setting-row__main">
            <div className="setting-row__label">Move between machines</div>
            <div className="setting-row__hint">JSON dump of pet, sessions, unlocks, achievements</div>
          </div>
          <div className="setting-row__action setting-row__action--horizontal">
            <button className="ghost-btn" onClick={handleExport}>Export</button>
            <button className="ghost-btn" onClick={handleImport}>Import</button>
          </div>
        </div>
        {saveMessage && (
          <div className={`save-message save-message--${saveMessage.kind}`}>{saveMessage.text}</div>
        )}
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
