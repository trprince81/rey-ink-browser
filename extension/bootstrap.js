// Rey Ink service-worker bootstrap.
// Load the existing worker first, then the capture/storage bridge.
importScripts('background.js', 'capture_bridge.js');
