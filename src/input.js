export function createInput(onFireKey) {
  const keys = {};

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;

    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      if (typeof onFireKey === 'function') {
        onFireKey();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  return {
    getState: () => ({
      left: !!(keys['ArrowLeft'] || keys['KeyA']),
      right: !!(keys['ArrowRight'] || keys['KeyD']),
      thrust: !!(keys['ArrowUp'] || keys['KeyW'])
    })
  };
}