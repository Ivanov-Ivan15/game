export function createLoop({ update, render }) {
  let lastTime = performance.now();
  let accumulator = 0;
  const dt = 1 / 60; // Фіксований крок 60 Гц

  let stepsCount = 0;
  let framesCount = 0;
  let stepsPerSecond = 0;
  let framesPerSecond = 0;
  let lastFpsUpdate = performance.now();
  let frameTimeMs = 0;

  function frame(currentTime) {
    const elapsed = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    
    accumulator += Math.min(elapsed, 0.25);

    while (accumulator >= dt) {
      update(dt);
      accumulator -= dt;
      stepsCount++;
    }

    const alpha = accumulator / dt;

    const startRender = performance.now();
    render(alpha);
    frameTimeMs = performance.now() - startRender;
    framesCount++;

    if (currentTime - lastFpsUpdate >= 1000) {
      stepsPerSecond = stepsCount;
      framesPerSecond = framesCount;
      stepsCount = 0;
      framesCount = 0;
      lastFpsUpdate = currentTime;
    }

    requestAnimationFrame(frame);
  }

  return {
    start: () => requestAnimationFrame(frame),
    getStats: () => ({
      stepsPerSecond,
      framesPerSecond,
      frameTimeMs: frameTimeMs.toFixed(2)
    })
  };
}