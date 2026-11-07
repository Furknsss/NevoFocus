// Capture Chrome's one-time MessagePort before the main application downloads.
(function () {
  var marked = new URLSearchParams(location.search).get('nevofocus_twa') === '1';
  try {
    if (marked) sessionStorage.setItem('nevofocus_twa_active', '1');
    marked = marked || sessionStorage.getItem('nevofocus_twa_active') === '1';
  } catch (_) {}
  if (!marked) return;
  // Chromium identifies a DAL-verified application with its android-app origin.
  var appOrigin = 'android-app://' + new URL(location.origin).hostname;
  var trustedOrigins = [location.origin, appOrigin, appOrigin + '/com.furknsss.nevofocus'];
  var state = window.__nevoTwaBootstrap = { channels: [], received: [], status: 'waiting' };
  window.addEventListener('message', function (event) {
    if (state.received.length < 8) state.received.push({ origin: event.origin, ports: event.ports ? event.ports.length : 0, empty: event.data === '' });
    if (trustedOrigins.indexOf(event.origin) === -1 || !event.ports || !event.ports.length) return;
    var record = { port: event.ports[0], initial: event.data, messages: [] };
    record.listener = function (message) {
      if (record.messages.length < 30) record.messages.push(message.data);
    };
    record.port.addEventListener('message', record.listener);
    record.port.start();
    state.channels.push(record);
    state.status = 'port-captured';
    if (state.channels.length > 4) state.channels.shift().port.close();
    window.dispatchEvent(new Event('nevofocus:twa-port'));
  });
})();
