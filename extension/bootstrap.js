// Rey Ink service-worker bootstrap.
// The complete service worker is kept in background.js.
// capture_bridge.js previously registered PREPARE_REMOTE/REGISTER_REMOTE_RETRY
// handlers that called an undefined register() function and caused the
// "Comando no reconocido: PREPARE_REMOTE" / undefined errors.
importScripts('background.js');
