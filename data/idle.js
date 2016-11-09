'use strict';

var id;
var paused = false;

function check () {
  window.clearTimeout(id);
  if (document.hidden && !paused) {
    chrome.storage.local.get({
      timeout: 30
    }, prefs => {
      id = window.setTimeout(() => chrome.runtime.sendMessage({
        cmd: 'tab-is-inactive'
      }), prefs.timeout * 60 * 1000);
    });
  }
}
document.addEventListener('visibilitychange', check);
check();

chrome.runtime.onMessage.addListener(request => {
  if (request.cmd === 'dont-suspend') {
    paused = true;
    window.clearTimeout(id);
  }
});
