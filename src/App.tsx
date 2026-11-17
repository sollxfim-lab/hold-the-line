import { useCallback, useEffect } from 'react';
import { Game } from './game/Game';
import { sfx } from './game/audio';
import { useGameStore } from './store/useGameStore';
import { Hud } from './ui/Hud';
import { CheatPanel } from './ui/Cheats';
import { lockPointer } from './ui/pointer';
import {
  ArmoryScreen,
  GameOverScreen,
  PauseScreen,
  TitleScreen,
  UpgradeScreen,
} from './ui/Screens';

export default function App() {
  const phase = useGameStore((s) => s.phase);
  const paused = useGameStore((s) => s.paused);

  const beginRun = useCallback(() => {
    sfx.init();
    useGameStore.getState().startRun();
    lockPointer();
  }, []);

  const openArmory = useCallback(() => {
    useGameStore.getState().setPhase('armory');
  }, []);

  const returnHome = useCallback(() => {
    useGameStore.getState().setPhase('title');
  }, []);

  const resume = useCallback(() => {
    sfx.init();
    lockPointer();
  }, []);

  useEffect(() => {
    const onLockChange = () => {
      const store = useGameStore.getState();
      if (document.pointerLockElement) {
        if (store.phase === 'playing' && store.paused) store.setPaused(false);
        return;
      }
      if (store.phase === 'playing' && !store.paused) store.setPaused(true);
    };

    const onVisibility = () => {
      if (!document.hidden) return;
      const store = useGameStore.getState();
      if (store.phase === 'playing' && !store.paused) store.setPaused(true);
    };

    const onBlur = () => {
      const store = useGameStore.getState();
      if (store.phase === 'playing' && !store.paused) store.setPaused(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const store = useGameStore.getState();
      if (store.phase === 'playing' && !store.paused) store.setPaused(true);
    };

    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className={`app phase-${phase}`}>
      <div className="scene">
        <Game />
      </div>
      <div className="scene-grade" />
      <div className="scanlines" />

      {phase === 'playing' && <Hud />}
      {phase === 'playing' && paused && <PauseScreen onResume={resume} />}
      {phase === 'title' && <TitleScreen onDeploy={beginRun} onArmory={openArmory} />}
      {phase === 'upgrade' && <UpgradeScreen />}
      {phase === 'armory' && <ArmoryScreen onBack={returnHome} />}
      {phase === 'gameover' && <GameOverScreen onRedeploy={beginRun} />}
      <CheatPanel />
    </div>
  );
}
