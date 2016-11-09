'use strict';

var log = document.getElementById('status');

function restore_options () {
  chrome.storage.local.get({
    timeout: 30,
    pinned: false,
    unsaved: true,
    online: false,
    battery: false,
    focus: false,
    whitelist: ''
  }, (prefs) => {
    Object.keys(prefs).forEach (name => {
      document.getElementById(name)[typeof prefs[name] === 'boolean' ? 'checked' : 'value'] = prefs[name];
    });
  });
}

function save_options() {
  let prefs = {
    timeout: Math.max(document.getElementById('timeout').value, 5),
    pinned: document.getElementById('pinned').checked,
    unsaved: document.getElementById('unsaved').checked,
    online: document.getElementById('online').checked,
    battery: document.getElementById('battery').checked,
    focus: document.getElementById('focus').checked,
    whitelist: document.getElementById('whitelist').value
      .split(',')
      .map(s => s.trim())
      .map(s => s.startsWith('http') || s.startsWith('ftp') ? (new URL(s)).hostname : s)
      .join(', ')
  };

  chrome.storage.local.set(prefs, () => {
    log.textContent = 'Options saved.';
    setTimeout(() => log.textContent = '', 750);
    restore_options();
  });
}

document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', () => {
  try {
    save_options();
  }
  catch (e) {
    log.textContent = e.message;
    setTimeout(() => log.textContent = '', 750);
  }
});
