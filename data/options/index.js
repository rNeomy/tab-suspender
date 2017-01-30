'use strict';

var log = document.getElementById('status');

function restore () {
  chrome.storage.local.get({
    timeout: 30,
    tabs: 5,
    pinned: false,
    unsaved: true,
    online: false,
    battery: false,
    focus: false,
    restore: navigator.userAgent.indexOf('Chrome') !== -1 && navigator.userAgent.indexOf('OPR') === -1,
    whitelist: ''
  }, (prefs) => {
    Object.keys(prefs).forEach (name => {
      document.getElementById(name)[typeof prefs[name] === 'boolean' ? 'checked' : 'value'] = prefs[name];
    });
  });
}

function save () {
  let prefs = {
    timeout: Math.max(document.getElementById('timeout').value, 1),
    tabs: Math.max(document.getElementById('tabs').value, 1),
    pinned: document.getElementById('pinned').checked,
    unsaved: document.getElementById('unsaved').checked,
    online: document.getElementById('online').checked,
    battery: document.getElementById('battery').checked,
    focus: document.getElementById('focus').checked,
    restore: document.getElementById('restore').checked,
    whitelist: document.getElementById('whitelist').value
      .split(',')
      .map(s => s.trim())
      .map(s => s.startsWith('http') || s.startsWith('ftp') ? (new URL(s)).hostname : s)
      .filter((h, i, l) => l.indexOf(h) === i)
      .join(', ')
  };

  chrome.storage.local.set(prefs, () => {
    log.textContent = 'Options saved.';
    setTimeout(() => log.textContent = '', 750);
    restore();
  });
}

document.addEventListener('DOMContentLoaded', restore);
document.getElementById('save').addEventListener('click', () => {
  try {
    save();
  }
  catch (e) {
    log.textContent = e.message;
    setTimeout(() => log.textContent = '', 750);
  }
});
