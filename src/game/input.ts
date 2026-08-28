export interface GameInputHandlers {
  onPress: () => void;
  onRelease: () => void;
  onCancel: () => void;
  onVisibilityPause: () => void;
  onRotate: () => void;
}

export function bindGameInput(canvas: HTMLCanvasElement, handlers: GameInputHandlers): () => void {
  let activePointer: number | null = null;
  let spaceHeld = false;

  const pointerDown = (event: PointerEvent) => {
    if (activePointer !== null || event.button !== 0) return;
    activePointer = event.pointerId;
    canvas.setPointerCapture?.(event.pointerId);
    handlers.onPress();
    event.preventDefault();
  };

  const pointerUp = (event: PointerEvent) => {
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    handlers.onRelease();
    event.preventDefault();
  };

  const pointerCancel = (event: PointerEvent) => {
    if (activePointer !== event.pointerId) return;
    activePointer = null;
    handlers.onCancel();
  };

  const keyDown = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || event.repeat || spaceHeld) return;
    spaceHeld = true;
    handlers.onPress();
    event.preventDefault();
  };

  const keyUp = (event: KeyboardEvent) => {
    if (event.code !== 'Space' || !spaceHeld) return;
    spaceHeld = false;
    handlers.onRelease();
    event.preventDefault();
  };

  const blur = () => {
    activePointer = null;
    spaceHeld = false;
    handlers.onCancel();
    handlers.onVisibilityPause();
  };

  const visibility = () => {
    if (!document.hidden) return;
    activePointer = null;
    spaceHeld = false;
    handlers.onCancel();
    handlers.onVisibilityPause();
  };

  const rotate = () => {
    activePointer = null;
    spaceHeld = false;
    handlers.onCancel();
    handlers.onRotate();
  };

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  window.addEventListener('keydown', keyDown, { passive: false });
  window.addEventListener('keyup', keyUp, { passive: false });
  window.addEventListener('blur', blur);
  window.addEventListener('orientationchange', rotate);
  document.addEventListener('visibilitychange', visibility);

  return () => {
    canvas.removeEventListener('pointerdown', pointerDown);
    canvas.removeEventListener('pointerup', pointerUp);
    canvas.removeEventListener('pointercancel', pointerCancel);
    window.removeEventListener('keydown', keyDown);
    window.removeEventListener('keyup', keyUp);
    window.removeEventListener('blur', blur);
    window.removeEventListener('orientationchange', rotate);
    document.removeEventListener('visibilitychange', visibility);
  };
}
