async function send(action) {
  const msg = document.getElementById('msg');
  msg.className = 'msg';
  msg.textContent = 'Ejecutando…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No hay una pestaña activa.');

    const result = await chrome.tabs.sendMessage(tab.id, { action });
    msg.className = `msg ${result?.ok ? 'ok' : 'err'}`;
    msg.textContent = result?.message || result?.error || (result?.found ? 'Botón encontrado.' : 'Botón no encontrado.');
  } catch (error) {
    msg.className = 'msg err';
    msg.textContent = 'No se pudo comunicar con esta página. Recarga la página e inténtalo de nuevo.';
  }
}

document.getElementById('click').addEventListener('click', () => send('click_avoid_scams'));
document.getElementById('state').addEventListener('click', () => send('get_state'));
