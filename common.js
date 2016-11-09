'use strict';

var app = {};
var unsaved = {};

function tooltip (tab, title) {
  chrome.pageAction.setTitle({
    tabId: tab.id,
    title: 'Tab Suspender (Tab Unloader)\n\n' + title
  });
}

app.callbacks = {};
app.on = (id, callback) => {
  app.callbacks[id] = app.callbacks[id] || [];
  app.callbacks[id].push(callback);
};
app.emit = (id, data) => (app.callbacks[id] || []).forEach(c => c(data));

chrome.contextMenus.create({
  title: 'Suspend this tab',
  contexts: ['page_action'],
  onclick: () => app.emit('suspend-tab')
});
chrome.contextMenus.create({
  title: 'Unuspend this tab',
  contexts: ['page_action'],
  onclick: () => app.emit('unsuspend-tab')
});
chrome.contextMenus.create({
  title: 'Don\'t suspend for now',
  contexts: ['page_action'],
  onclick: () => app.emit('dont-suspend')
});
chrome.contextMenus.create({
  title: 'Never suspend this domain',
  contexts: ['page_action'],
  onclick: () => app.emit('protect-host')
});
chrome.contextMenus.create({
  title: 'Suspend all tabs',
  contexts: ['page_action'],
  onclick: () => app.emit('suspend-all')
});
chrome.contextMenus.create({
  title: 'Unsuspend all tabs',
  contexts: ['page_action'],
  onclick: () => app.emit('unsuspend-all')
});

function battery () {
  if ('getBattery' in navigator) {
    return navigator.getBattery().then(function (batt) {
      return batt.dischargingTime !== Infinity;
    });
  }
  else {
    return Promise.resolve(false);
  }
}

function suspend (tab, forced) {
  chrome.storage.local.get(null, (prefs) => {
    if (!forced && prefs.online && !navigator.onLine) {
      return tooltip(tab, 'Skipped: browser is not connected to internet');
    }
    if (!forced && prefs.pinned && tab.pinned) {
      return tooltip(tab, 'Skipped: this tab is pinned');
    }
    if (!forced && prefs.unsaved && unsaved[tab.id] && Object.values(unsaved[tab.id]).reduce((p, c) => p || c, false)) {
      return tooltip(tab, 'Skipped: this tab has unsaved form data');
    }
    let hostname = (new URL(tab.url)).hostname;
    if (!forced && prefs.whitelist.split(', ').filter(u => u === hostname).length) {
      return tooltip(tab, 'Skipped: tab is in the whitelist');
    }
    battery().then(batt => {
      if (!forced && prefs.battery && !batt) {
        return tooltip(tab, 'Skipped: device is connected to power');
      }

      let url = './data/suspend/index.html?title=' + encodeURIComponent(tab.title) + '&url=' + encodeURIComponent(tab.url);
      chrome.tabs.update(tab.id, {
        url
      }, () => app.emit('session-restore'));
    });
  });
}

app.on('suspend-tab', () => {
  chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: ['*://*/*']
  }, tabs => tabs.forEach((tab) => suspend(tab, true)));
});

app.on('dont-suspend', () => {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, tabs => tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {
    cmd: 'dont-suspend'
  })));
});

app.on('suspend-all', () => {
  chrome.tabs.query({
    url: ['*://*/*']
  }, tabs => tabs.forEach(tab => suspend(tab, false)));
});

app.on('unsuspend-all', () => {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {
      cmd: 'unsuspend'
    }));
  });
});

app.on('unsuspend-tab', () => {
  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, tabs => {
    tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {
      cmd: 'unsuspend'
    }));
  });
});

app.on('open-options', () => chrome.runtime.openOptionsPage());
app.on('open-faqs', (append) => {
  chrome.tabs.create({
    url: 'http://add0n.com/tab-suspender.html' + (append ? '?' + append : '')
  });
});

app.on('protect-host', () => {
  chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: ['*://*/*']
  }, tabs => {
    tabs.forEach(tab => {
      let url = new URL(tab.url);
      chrome.storage.local.get({
        whitelist: ''
      }, prefs => {
        let whitelist = prefs.whitelist.split(', ');
        whitelist.push(url.hostname);
        whitelist = whitelist.filter((n, i, l) => n && l.indexOf(n) === i).join(', ');
        chrome.storage.local.set({whitelist});
      });
    });
  });
});

app.on('session-restore', () => {
  chrome.tabs.query({
    url: chrome.runtime.getURL('data/suspend/index.html') + '?*'
  }, tabs => {
    let sessions = tabs.map(tab => tab.url);
    chrome.storage.local.set({sessions});
  });
});

chrome.runtime.onMessage.addListener((request, sender) => {
  if (request.cmd === 'app.emit') {
    app.emit(request.id, request.data);
  }
  else if (request.cmd === 'update-tab') {
    chrome.tabs.update(sender.tab.id, {
      url: request.url
    }, () => app.emit('session-restore'));
  }
  else if (request.cmd === 'form-changed') {
    unsaved[sender.tab.id] = unsaved[sender.tab.id] || {};
    if (request.unsaved) {
      unsaved[sender.tab.id][request.id] = true;
    }
    else {
      delete unsaved[sender.tab.id][request.id];
    }
  }
  else if (request.cmd === 'tab-is-inactive') {
    suspend(sender.tab, false);
  }
});

// clear unused objects
chrome.tabs.onRemoved.addListener((tabId) => {
  delete unsaved[tabId];
});
// session restore
var restore = [];
chrome.storage.local.get({
  sessions: []
}, prefs => {
  restore = prefs.sessions;
  if (restore.length) {
    chrome.notifications.create('restore', {
      type: 'basic',
      title: 'Restore suspended tabs',
      message: 'Click here to restore all the suspended tabs',
      iconUrl: './data/icons/48.png',
      priority: 2,
      isClickable: true,
      requireInteraction: true
    });
  }
});
chrome.notifications.onClicked.addListener(id => {
  if (id === 'restore') {
    restore.forEach(url => chrome.tabs.create({
      url,
      active: false
    }));
    chrome.notifications.clear(id);
  }
});

// pageAction
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.pageAction[tab.url.startsWith('http') || tab.url.startsWith('ftp') ? 'show' : 'hide'](tabId);
});
