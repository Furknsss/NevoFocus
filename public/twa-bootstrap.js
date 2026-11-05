// Capture Chrome's one-time MessagePort before the main application downloads.
(function () {
  var marked = new URLSearchParams(location.search).get('nevofocus_twa') === '1';
  try {
    if (marked) sessionStorage.setItem('nevofocus_twa_active', '1');
    marked = marked || sessionStorage.getItem('nevofocus_twa_active') === '1';
  } catch (_) {}
  if (!marked) return;
  var state = window.__nevoTwaBootstrap = { channels: [] };
  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || !event.ports || !event.ports.length) return;
    var record = { port: event.ports[0], initial: event.data, messages: [] };
    record.listener = function (message) {
      if (record.messages.length < 30) record.messages.push(message.data);
    };
    record.port.addEventListener('message', record.listener);
    record.port.start();
    state.channels.push(record);
    if (state.channels.length > 4) state.channels.shift().port.close();
    window.dispatchEvent(new Event('nevofocus:twa-port'));
  });
})();
