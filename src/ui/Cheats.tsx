import { useEffect } from 'react';
import { useGameStore } from '../store/useGameStore';

const TOGGLES = [
  {
    key: 'godMode' as const,
    label: 'God mode',
    desc: 'Ignore all incoming damage.',
  },
  {
    key: 'infiniteAmmo' as const,
    label: 'Infinite ammunition',
    desc: 'Shots no longer consume rounds.',
  },
  {
    key: 'oneHitKill' as const,
    label: 'One-hit elimination',
    desc: 'Every confirmed round deals lethal damage.',
  },
  {
    key: 'flyMode' as const,
    label: 'Owner flight',
    desc: 'Space ascends, C descends, Shift boosts. Release to fall.',
  },
  {
    key: 'noclip' as const,
    label: 'Barrier bypass',
    desc: 'Ignore colliders and arena bounds while traversing.',
  },
  {
    key: 'v4Awakening' as const,
    label: 'V4 awakening (always)',
    desc: 'Keep the class V4 horns and aura active for inspection.',
  },
];

export function CheatPanel() {
  const open = useGameStore((s) => s.cheatsOpen);
  const godMode = useGameStore((s) => s.godMode);
  const infiniteAmmo = useGameStore((s) => s.infiniteAmmo);
  const oneHitKill = useGameStore((s) => s.oneHitKill);
  const flyMode = useGameStore((s) => s.flyMode);
  const noclip = useGameStore((s) => s.noclip);
  const v4Awakening = useGameStore((s) => s.v4Awakening);
  const phase = useGameStore((s) => s.phase);
  const bank = useGameStore((s) => s.bank);
  const toggleCheat = useGameStore((s) => s.toggleCheat);
  const setCheatsOpen = useGameStore((s) => s.setCheatsOpen);
  const cheatAddCredits = useGameStore((s) => s.cheatAddCredits);
  const cheatUnlockAll = useGameStore((s) => s.cheatUnlockAll);
  const cheatGrantSuite = useGameStore((s) => s.cheatGrantSuite);
  const cheatHeal = useGameStore((s) => s.cheatHeal);
  const cheatNuke = useGameStore((s) => s.cheatNuke);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        const store = useGameStore.getState();
        const next = !store.cheatsOpen;
        store.setCheatsOpen(next);
        if (next && document.pointerLockElement) document.exitPointerLock();
        return;
      }
      if (e.key === 'Escape' && useGameStore.getState().cheatsOpen) {
        useGameStore.getState().setCheatsOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) {
    return (
      <div className="owner-hint" aria-hidden>
        <span>F2</span> Owner console
      </div>
    );
  }

  const active = { godMode, infiniteAmmo, oneHitKill, flyMode, noclip, v4Awakening };

  return (
    <div className="cheat-layer" role="dialog" aria-label="Owner console">
      <div className="cheat-panel">
        <header className="cheat-head">
          <div>
            <span className="hud-eyebrow">Owner access · F2</span>
            <h2>Override console</h2>
          </div>
          <button className="cheat-close" onClick={() => setCheatsOpen(false)}>
            Close
          </button>
        </header>

        <p className="cheat-note">
          Developer tooling for the owner of this build. Toggles apply immediately and are not
          written to the local save.
        </p>

        <div className="cheat-toggles">
          {TOGGLES.map((toggle) => {
            const on = active[toggle.key];
            return (
              <button
                key={toggle.key}
                className={`cheat-toggle ${on ? 'is-on' : ''}`}
                onClick={() => toggleCheat(toggle.key)}
              >
                <span className="cheat-switch">
                  <i />
                </span>
                <span className="cheat-toggle-copy">
                  <strong>{toggle.label}</strong>
                  <em>{toggle.desc}</em>
                </span>
                <span className="cheat-state">{on ? 'ON' : 'OFF'}</span>
              </button>
            );
          })}
        </div>

        <div className="cheat-actions">
          <button className="cheat-action" onClick={cheatAddCredits}>
            <strong>+25,000 CR</strong>
            <em>Add reserve credits</em>
          </button>
          <button className="cheat-action" onClick={cheatUnlockAll}>
            <strong>Unlock arsenal</strong>
            <em>All platforms, classes, and coats</em>
          </button>
          <button className="cheat-action" onClick={cheatGrantSuite}>
            <strong>Mythic suite</strong>
            <em>Max field modifications</em>
          </button>
          <button
            className="cheat-action"
            onClick={cheatHeal}
            disabled={phase !== 'playing'}
          >
            <strong>Full restore</strong>
            <em>Integrity and trauma kits</em>
          </button>
          <button
            className="cheat-action danger"
            onClick={cheatNuke}
            disabled={phase !== 'playing'}
          >
            <strong>Purge sector</strong>
            <em>Eliminate all hostiles</em>
          </button>
        </div>

        <footer className="cheat-foot">
          <span>Active balance</span>
          <strong>{bank.toLocaleString()} CR</strong>
          <span>{phase === 'playing' ? 'In field — releasing pointer' : 'Base of operations'}</span>
        </footer>
      </div>
    </div>
  );
}
