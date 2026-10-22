export function createInput() {
  const keys = {};

  window.addEventListener('keydown', (e) => { keys[e.code] = true; });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  return {
    getState: () => ({
      left: !!(keys['ArrowLeft'] || keys['KeyA']),
      right: !!(keys['ArrowRight'] || keys['KeyD']),
      thrust: !!(keys['ArrowUp'] || keys['KeyW'])
    })
  };
}