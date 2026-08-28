(() => {
  const BUTTON_SELECTORS = [
    '#avoidScamsButton',
    '#reportButtonContainer #avoidScamsButton',
    '[data-rey-ink="avoid-scams"]'
  ];

  function findButton() {
    for (const selector of BUTTON_SELECTORS) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function clickButton() {
    const button = findButton();
    if (!button) {
      return { ok: false, error: 'No se encontró #avoidScamsButton en esta página.' };
    }

    if (button.dataset.reyInkBound !== '1') {
      button.dataset.reyInkBound = '1';
      button.addEventListener('click', () => {
        try {
          const target = document.querySelector('#scamAlert');
          if (target && target.classList.contains('hidden')) {
            target.classList.remove('hidden');
          }
        } catch (_) {}
      }, { passive: true });
    }

    button.click();
    return { ok: true, message: 'Botón ejecutado correctamente.' };
  }

  function exposeApi() {
    window.ReyInkBrowser = window.ReyInkBrowser || {};
    window.ReyInkBrowser.clickAvoidScams = clickButton;
  }

  exposeApi();

  const observer = new MutationObserver(() => {
    const button = findButton();
    if (button && button.dataset.reyInkBound !== '1') {
      button.dataset.reyInkBound = '1';
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.action === 'click_avoid_scams') {
      sendResponse(clickButton());
      return true;
    }

    if (message?.action === 'get_state') {
      sendResponse({
        ok: true,
        found: Boolean(findButton()),
        url: location.href
      });
      return true;
    }

    return false;
  });
})();
