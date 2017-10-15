'use strict';

var cache = {};

chrome.runtime.sendMessage({
  cmd: 'sessions'
}, sessions => {
  sessions.forEach(s => cache[s.win] = cache[s.win] || []);
  sessions.forEach(s => cache[s.win].push(s));
  Object.keys(cache).forEach(id => {
    cache[id].sort((a, b) => b.tab - a.tab);
  });
  const details = document.getElementById('details');
  const tr = document.getElementById('tr');
  const div = document.getElementById('sessions');
  var jobs = 0;
  Object.keys(cache).forEach(id => {
    const parent = document.importNode(details.content, true);
    parent.querySelector('summary').textContent = 'Window ' + id;
    cache[id].forEach(s => {
      jobs += 1;
      const node = document.importNode(tr.content, true);
      node.querySelector('td:nth-child(2)').textContent = s.title;
      node.querySelector('td:nth-child(3)').textContent = s.url;
      Object.assign(node.querySelector('tr').dataset, {
        id: s.id,
        win: id,
        url: s.url,
        pinned: s.pinned || false,
        index: s.index || -1
      });
      parent.querySelector('tbody').appendChild(node);
    });
    div.appendChild(parent);
  });
  chrome.storage.local.get({
    'startup-restore': true
  }, prefs => {
    if (prefs['startup-restore'] && jobs <= 20) {
      document.querySelector('[data-cmd="select-all"]').click();
      document.querySelector('[data-cmd="open"]').dataset.close = true;
      document.querySelector('[data-cmd="open"]').click();
    }
  });
});

document.addEventListener('click', ({target}) => {
  const cmd = target.dataset.cmd;
  if (cmd === 'select-all') {
    [...document.querySelectorAll('[type=checkbox]')].forEach(i => i.checked = true);
  }
  else if (cmd === 'select-none') {
    [...document.querySelectorAll('[type=checkbox]')].forEach(i => i.checked = false);
  }
  else if (cmd === 'open') {
    const sessions = [...document.querySelectorAll('[type=checkbox]')].filter(i => i.checked)
      .map(i => i.closest('tr').dataset);
    const map = {};
    Promise.all(sessions.map(s => s.win).filter((id, i, l) => id && l.indexOf(id) === i)
      .map(id => new Promise(resolve => {
        chrome.windows.get(Number(id), () => {
          if (chrome.runtime.lastError) {
            chrome.windows.create({}, win => {
              map[id] = win.id;
              resolve();
            });
          }
          else {
            map[id] = Number(id);
            resolve();
          }
        });
      }))).then(() => {
        sessions.forEach(s => {
          const obj = {
            url: s.url,
            windowId: map[s.win],
            pinned: s.pinned === 'true'
          };
          if (s.index && s.index !== '-1') {
            obj.index = Number(s.index);
          }
          chrome.tabs.create(obj);
        });
        if (target.dataset.close === 'true') {
          chrome.runtime.sendMessage({
            cmd: 'close-me'
          });
        }
      });
  }
});
