'use strict';

var log = document.getElementById('status');

function restore() {
  chrome.storage.local.get({
    'timeout': 30,
    'tabs': 5,
    'native': true,
    'pinned': false,
    'unsaved': true,
    'online': false,
    'battery': false,
    'focus': false,
    'dark': false,
    'pageAction': true,
    'restore': true,
    'page': true,
    'google': true,
    'audio': true,
    'startup-restore': true,
    'bookmarks': false,
    'whitelist': ''
  }, prefs => {
    Object.keys(prefs).forEach(name => {
      document.getElementById(name)[typeof prefs[name] === 'boolean' ? 'checked' : 'value'] = prefs[name];
    });
  });
}

function save() {
  const prefs = {
    'timeout': Math.max(document.getElementById('timeout').value, 1),
    'tabs': Math.max(document.getElementById('tabs').value, 1),
    'native': document.getElementById('native').checked,
    'pinned': document.getElementById('pinned').checked,
    'unsaved': document.getElementById('unsaved').checked,
    'online': document.getElementById('online').checked,
    'battery': document.getElementById('battery').checked,
    'focus': document.getElementById('focus').checked,
    'dark': document.getElementById('dark').checked,
    'pageAction': document.getElementById('pageAction').checked,
    'restore': document.getElementById('restore').checked,
    'page': document.getElementById('page').checked,
    'google': document.getElementById('google').checked,
    'audio': document.getElementById('audio').checked,
    'startup-restore': document.getElementById('startup-restore').checked,
    'bookmarks': document.getElementById('bookmarks').checked,
    'whitelist': document.getElementById('whitelist').value
      .split(',')
      .map(s => s.trim())
      .map(s => s.startsWith('http') || s.startsWith('ftp') ? (new URL(s)).hostname : s)
      .filter((h, i, l) => l.indexOf(h) === i)
      .join(', ')
  };
  localStorage.setItem('dark', prefs.dark);
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
document.getElementById('recovery').addEventListener('click', () => chrome.runtime.sendMessage({
  cmd: 'recovery'
}));

document.getElementById('bookmarks').addEventListener('click', ({target}) => {
  if (target.checked) {
    chrome.permissions.request({
      permissions: ['bookmarks']
    }, granted => {
      if (!granted) {
        target.checked = false;
      }
    });
  }
});
