'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameAudio } from '../game/audio';
import { FIXED_STEP_MS, GO_FRAMES, MAX_CATCH_UP_STEPS, faithfulPreset } from '../game/config';
import { bindGameInput } from '../game/input';
import { createGameState, type GameEvent, type GameState } from '../game/model';
import { createGameRenderer } from '../game/renderer';
import { applyGameEvent, stepSimulation } from '../game/simulation';
import { formatTime, sceneStatusText } from '../game/scenes';

const BEST_KEY = 'duck-milk-best-ms';
const MUTE_KEY = 'duck-milk-muted';

function readBest(): number | null {
  const value = Number(window.localStorage.getItem(BEST_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readMuted(): boolean {
  return window.localStorage.getItem(MUTE_KEY) === 'true';
}

function copyState(state: GameState): GameState {
  return { ...state };
}

export default function DuckMilkGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<GameState>(() => createGameState());
  const gameRef = useRef<GameState>(snapshot);
  const audioRef = useRef<GameAudio | null>(null);
  const [muted, setMuted] = useState(false);

  const publish = useCallback(() => {
    setSnapshot(copyState(gameRef.current));
  }, []);

  const handleTransition = useCallback((previous: GameState, next: GameState) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (previous.scene === 'ready' && next.scene === 'ready'
      && previous.readyFramesRemaining > GO_FRAMES && next.readyFramesRemaining <= GO_FRAMES) {
      audio.playGo();
    }
    if (previous.scene === 'ready' && next.scene === 'playing') audio.startBgm();
    if (previous.scene === 'playing' && next.scene === 'clear') {
      audio.stopBgm();
      audio.playClear();
    }
    if (previous.scene === 'playing' && (next.scene === 'choking' || next.scene === 'fail')) {
      audio.stopBgm();
      audio.playFail();
    }
  }, []);

  const dispatch = useCallback((event: GameEvent) => {
    const previous = gameRef.current;
    const next = applyGameEvent(previous, event);
    gameRef.current = next;

    if (event.type === 'start' || event.type === 'retry') {
      void audioRef.current?.unlock().then(() => audioRef.current?.playReady());
    }
    if (event.type === 'press' && previous.scene === 'playing') {
      audioRef.current?.playSwallow();
    }
    if (event.type === 'togglePause' || event.type === 'pause' || event.type === 'resume') {
      audioRef.current?.setPaused(next.paused);
    }
    handleTransition(previous, next);
    publish();
  }, [handleTransition, publish]);

  useEffect(() => {
    const initialMuted = readMuted();
    audioRef.current = new GameAudio(initialMuted);
    const hydrationFrame = window.requestAnimationFrame(() => {
      setMuted(initialMuted);
      gameRef.current = { ...gameRef.current, bestTimeMs: readBest() };
      publish();
    });
    return () => {
      window.cancelAnimationFrame(hydrationFrame);
      audioRef.current?.destroy();
    };
  }, [publish]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = createGameRenderer(canvas);
    const cleanupInput = bindGameInput(canvas, {
      onPress: () => {
        if (gameRef.current.scene === 'title') dispatch({ type: 'start' });
        else dispatch({ type: 'press' });
      },
      onRelease: () => dispatch({ type: 'release' }),
      onCancel: () => dispatch({ type: 'cancel' }),
      onVisibilityPause: () => dispatch({ type: 'pause' }),
      onRotate: () => dispatch({ type: 'cancel' }),
    });

    let animationId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    let lastUiPublish = 0;
    let publishedScene = gameRef.current.scene;

    const frame = (now: number) => {
      const activeState = gameRef.current;
      const elapsed = now - lastTime;
      lastTime = now;

      if (!document.hidden && !activeState.paused) {
        accumulator += Math.min(elapsed, FIXED_STEP_MS * MAX_CATCH_UP_STEPS);
        let steps = 0;
        while (accumulator >= FIXED_STEP_MS && steps < MAX_CATCH_UP_STEPS) {
          const previous = gameRef.current;
          const next = stepSimulation(previous);
          gameRef.current = next;
          handleTransition(previous, next);
          accumulator -= FIXED_STEP_MS;
          steps += 1;
        }
      } else {
        accumulator = 0;
      }

      renderer.render(gameRef.current);
      if (now - lastUiPublish >= 80 || gameRef.current.scene !== publishedScene) {
        lastUiPublish = now;
        publishedScene = gameRef.current.scene;
        publish();
      }
      animationId = requestAnimationFrame(frame);
    };

    renderer.render(gameRef.current);
    animationId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(animationId);
      cleanupInput();
      renderer.destroy();
    };
  }, [dispatch, handleTransition, publish]);

  useEffect(() => {
    if (snapshot.bestTimeMs !== null) window.localStorage.setItem(BEST_KEY, String(snapshot.bestTimeMs));
  }, [snapshot.bestTimeMs]);

  const toggleMute = async () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    window.localStorage.setItem(MUTE_KEY, String(nextMuted));
    await audioRef.current?.unlock();
    audioRef.current?.setMuted(nextMuted);
  };

  const primaryAction = () => {
    if (snapshot.scene === 'title') dispatch({ type: 'start' });
    else if (snapshot.scene === 'clear' || snapshot.scene === 'fail') dispatch({ type: 'retry' });
    else if (snapshot.paused) dispatch({ type: 'resume' });
  };

  const riskRatio = Math.min(1, snapshot.risk / faithfulPreset.riskLimit);
  const dangerClass = riskRatio >= faithfulPreset.criticalRatio ? 'critical' : riskRatio >= faithfulPreset.warningRatio ? 'warning' : 'quiet';
  const showPrimary = snapshot.scene === 'title' || snapshot.scene === 'clear' || snapshot.scene === 'fail' || snapshot.paused;

  return (
    <main className="game-shell">
      <section className="game-card" aria-label="鴨鴨喝牛奶遊戲">
        <header className="game-header">
          <div className="title-lockup" aria-label="鴨鴨喝牛奶，20 秒連點挑戰">
            <span className="logo-duck" aria-hidden="true">●</span>
            <div>
              <strong>鴨鴨喝牛奶</strong>
              <span>20 秒連點挑戰</span>
            </div>
          </div>

          <div className="header-tools">
            <span className="best-chip" suppressHydrationWarning>
              <span>最佳</span>
              <strong>{snapshot.bestTimeMs === null ? '--.--' : formatTime(snapshot.bestTimeMs)}</strong>
            </span>
            <button className="icon-button" type="button" onClick={toggleMute} aria-label={muted ? '開啟聲音' : '靜音'} suppressHydrationWarning>
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => dispatch({ type: 'togglePause' })}
              disabled={snapshot.scene !== 'playing'}
              aria-label={snapshot.paused ? '繼續遊戲' : '暫停遊戲'}
            >
              {snapshot.paused ? '▶' : 'Ⅱ'}
            </button>
          </div>
        </header>

        <div className={`game-viewport ${dangerClass}`}>
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            role="button"
            tabIndex={0}
            aria-label="遊戲畫面。遊戲中快速連點讓鴨鴨喝牛奶；電腦可連按空白鍵。"
          />
          <div className="screen-gloss" aria-hidden="true" />
        </div>

        <aside className="game-panel" aria-label="遊戲狀態與操作">
          {showPrimary ? (
            <button className="primary-button" type="button" onClick={primaryAction}>
              <strong>{snapshot.scene === 'title' ? '開始遊戲' : snapshot.paused ? '繼續遊戲' : '再喝一瓶'}</strong>
              <span>{snapshot.scene === 'title' ? '點一下，準備 READY / GO' : '調整節奏，再挑戰最佳時間'}</span>
            </button>
          ) : snapshot.scene === 'choking' ? (
            <div className="play-coach choking" aria-hidden="true">
              <span className="gesture-dot" />
              <div>
                <strong>鴨鴨嗆到了！</strong>
                <span>先看看鴨鴨的反應，再調整下一次節奏</span>
              </div>
            </div>
          ) : (
            <div className={`play-coach ${snapshot.drinkAnimationFrames > 0 ? 'holding' : ''}`} aria-hidden="true">
              <span className="gesture-dot" />
              <div>
                <strong>{snapshot.drinkAnimationFrames > 0 ? '繼續連點喝奶！' : '連點遊戲畫面'}</strong>
                <span>{snapshot.drinkAnimationFrames > 0 ? '盯著左側爆星，抓準停手時機' : '點得越快、喝得越快，也越容易嗆到'}</span>
              </div>
            </div>
          )}

          <p className="micro-tip">貼近紅色警戒能喝得更快；太貪心就會嗆到</p>
        </aside>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{sceneStatusText(snapshot)}</p>
      </section>
    </main>
  );
}
