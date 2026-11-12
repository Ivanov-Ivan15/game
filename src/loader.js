async function fetchWithRetry(url, options = {}, retries = 3, backoff = 300) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      if (res.status >= 400 && res.status < 500) {
        throw new Error(`Client error: ${res.status}`);
      }
      throw new Error(`Server error: ${res.status}`);
    }
    return res;
  } catch (err) {
    if (err.name === 'AbortError' || retries <= 0 || (err.message && err.message.startsWith('Client error'))) {
      throw err;
    }
    const jitter = Math.random() * 100;
    const delay = backoff * 2 + jitter;
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, options, retries - 1, backoff * 2);
  }
}

export async function fetchJson(url, signal) {
  const res = await fetchWithRetry(url, { signal });
  return await res.json();
}

export async function loadImage(url, signal) {
  const res = await fetchWithRetry(url, { signal });
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

export async function loadAudioBuffer(url, audioCtx, signal) {
  const res = await fetchWithRetry(url, { signal });
  const arrayBuffer = await res.arrayBuffer();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

export async function loadAllAssets(manifestUrl, audioCtx, onProgress, signal) {
  const manifest = await fetchJson(manifestUrl, signal);
  const total = Object.keys(manifest.images || {}).length + Object.keys(manifest.audio || {}).length;
  let loaded = 0;

  const update = () => {
    loaded++;
    if (onProgress) onProgress(loaded / total);
  };

  const imagePromises = Object.entries(manifest.images || {}).map(async ([key, url]) => {
    const img = await loadImage(url, signal);
    update();
    return [key, img];
  });

  const audioPromises = Object.entries(manifest.audio || {}).map(async ([key, url]) => {
    const buffer = await loadAudioBuffer(url, audioCtx, signal);
    update();
    return [key, buffer];
  });

  const imagesArray = await Promise.all(imagePromises);
  const audioArray = await Promise.all(audioPromises);

  return {
    images: Object.fromEntries(imagesArray),
    audio: Object.fromEntries(audioArray)
  };
}