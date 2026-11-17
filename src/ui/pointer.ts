export function lockPointer() {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  try {
    const result = canvas.requestPointerLock() as unknown;
    if (result && typeof (result as Promise<void>).catch === 'function') {
      (result as Promise<void>).catch(() => {
        /* Browser denied the lock; the player can click the field to retry. */
      });
    }
  } catch {
    /* Pointer lock unavailable. */
  }
}

export function releasePointer() {
  if (document.pointerLockElement) document.exitPointerLock();
}
