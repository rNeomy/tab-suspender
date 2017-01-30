'use strict';

var id;
var paused = false;
var at = Date.now();

function check () {
  window.clearTimeout(id);
  if (document.hidden && !paused) {
    chrome.storage.local.get({
      timeout: 30
    }, prefs => {
      at = Date.now();
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
  else if (request.cmd === 'idle-active') {
    chrome.storage.local.get({
      timeout: 30
    }, prefs => {
      let now = Date.now();
      if (!paused && (now - at) > (prefs.timeout * 60 * 1000) && document.hidden) {
        chrome.runtime.sendMessage({
          cmd: 'tab-is-inactive'
        });
        window.clearTimeout(id);
      }
    });
  }
});
