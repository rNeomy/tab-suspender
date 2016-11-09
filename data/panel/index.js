'use strict';

document.addEventListener('click', e => {
  let target = e.target;
  let id = target.dataset.id;
  if (id) {
    chrome.runtime.sendMessage({
      cmd: 'app.emit',
      id
    });
    window.close();
  }
});

chrome.tabs.query({
  active: true,
  currentWindow: true
}, tabs => {
  tabs = tabs.filter(tab => tab.url.startsWith('http') || tab.url.startsWith('ftp'));
  if (tabs.length) {
    document.querySelector('[data-id="unsuspend-tab"]').dataset.disabled = true;
  }
  else {
    document.querySelector('[data-id="suspend-tab"]').dataset.disabled = true;
    document.querySelector('[data-id="dont-suspend"]').dataset.disabled = true;
    document.querySelector('[data-id="protect-host"]').dataset.disabled = true;
  }
});
