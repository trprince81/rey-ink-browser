const reyInkSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function reyInkStorageReady(timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if (globalThis.chrome?.storage?.local) return true;
    } catch {}
    await reyInkSleep(100);
  }
  throw new Error('Chrome no inicializó storage.local todavía. Reintenta Conectar.');
}

async function reyInkRegisterWithRetry() {
  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await reyInkStorageReady(5000);
      return await register();
    } catch (e) {
      lastError = e;
      const text = String(e?.message || e);
      if (!/storage|local|undefined/i.test(text) || attempt === 5) throw e;
      await reyInkSleep(250 * (attempt + 1));
    }
  }
  throw lastError || new Error('No se pudo registrar la PC.');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'REGISTER_REMOTE_RETRY') return false;

  (async () => {
    const slot = Number(message.pcSlot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 20) {
      throw new Error('Selecciona PC1–PC20.');
    }

    await reyInkStorageReady(5000);
    await chrome.storage.local.set({ reyInkPcSlot: slot });
    return await reyInkRegisterWithRetry();
  })().then(sendResponse).catch(error => {
    sendResponse({ ok: false, error: String(error?.message || error) });
  });

  return true;
});
