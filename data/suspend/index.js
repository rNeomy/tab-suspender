'use strict';

var search = {};
try {
  search = document.location.search
    .substr(1)
    .split('&')
    .map(s => s.split('=').map(s => decodeURIComponent(s)))
    .reduce((p, c) => {
      p[c[0]] = c[1];
      return p;
    }, {});
}
catch (e) {}

document.getElementById('date').textContent = (new Date()).toLocaleString();

document.title = document.querySelector('h1').textContent = search.title || 'Title';
document.querySelector('h2').textContent = search.url || '...';

document.addEventListener('dblclick', () => {
  chrome.runtime.sendMessage({
    cmd: 'update-tab',
    url: search.url
  });
});
// reload on activate
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    chrome.storage.local.get({
      'focus': false
    }, prefs => {
      if (prefs.focus) {
        chrome.runtime.sendMessage({
          cmd: 'update-tab',
          url: search.url
        });
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.cmd === 'unsuspend') {
    chrome.runtime.sendMessage({
      cmd: 'update-tab',
      url: search.url
    });
  }
});
