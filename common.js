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
/*
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
*/
chrome.contextMenus.create({
  title: 'Suspend all tabs',
  contexts: ['page_action'],
  onclick: () => app.emit('suspend-all')
});
chrome.contextMenus.create({
  title: 'Unsuspend this window',
  contexts: ['page_action'],
  onclick: () => app.emit('unsuspend-window')
});
chrome.contextMenus.create({
  title: 'Unsuspend all tabs',
  contexts: ['page_action'],
  onclick: () => app.emit('unsuspend-all')
});
chrome.contextMenus.create({
  title: 'Open tab in suspend mode',
  contexts: ['link'],
  onclick: (i) => {
    let url = i.linkUrl;
    // bypass Google redirect
    if (url.startsWith('https://www.google') && url.indexOf('&url=') !== -1) {
      url = decodeURIComponent(url.split('&url=')[1].split('&')[0]);
    }
    chrome.tabs.create({
      url : './data/suspend/index.html?title=' +
      encodeURIComponent(url) +
      '&url=' + encodeURIComponent(url),
      active: false
    }, (tab) => {
      let req = new XMLHttpRequest();
      req.open('GET', url);
      req.responseType = 'document';
      req.onload = () => {
        let title = req.response.title;
        if (title) {
          chrome.tabs.update(tab.id, {
            url: './data/suspend/index.html?title=' +
              encodeURIComponent(title) +
              '&url=' + encodeURIComponent(url)
          }, () => {
            // Firefox issue
            window.setTimeout(app.emit, 500, 'session-restore');
          });
        }
      };
      req.send();
      // Firefox issue
      window.setTimeout(app.emit, 500, 'session-restore');
    });
  }
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
  chrome.storage.local.get({
    online: false,
    pinned: false,
    unsaved: true,
    whitelist: '',
    tabs: 5,
    battery: false,
  }, (prefs) => {
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
      return tooltip(tab, 'Skipped: tab is in the white-list');
    }
    chrome.tabs.query({}, tabs => {
      // ignore suspended tabs
      tabs = tabs.filter(t => !t.url.startsWith(chrome.runtime.getURL('data/suspend/index.html')));
      if (!forced && tabs.length <= prefs.tabs) {
        return tooltip(tab, 'Skipped: not too many unsuspended tabs');
      }
      battery().then(batt => {
        if (!forced && prefs.battery && !batt) {
          return tooltip(tab, 'Skipped: device is connected to power');
        }

        let url = './data/suspend/index.html?title=' +
          encodeURIComponent(tab.title) +
          '&url=' + encodeURIComponent(tab.url) +
          '&favicon=' + encodeURIComponent(tab.favIconUrl);

        chrome.tabs.update(tab.id, {
          url
        }, () => {
          // Firefox issue
          window.setTimeout(app.emit, 500, 'session-restore');
        });
      });
    });
  });
}
// check skipped conditions
(function (callback) {
  // 1. prefs.tabs
  chrome.tabs.onCreated.addListener(callback);
  // 2. online listener
  window.addEventListener('online',  callback);

})(function () {
  chrome.tabs.query({
    url: ['*://*/*']
  }, tabs => tabs.filter(tab => !tab.active).forEach(tab => chrome.tabs.sendMessage(tab.id, {
    cmd: 'idle-active'
  })));
});

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

app.on('unsuspend-window', () => {
  chrome.tabs.query({
    currentWindow: true
  }, tabs => {
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
    // firefox issue
    // url: chrome.runtime.getURL('data/suspend/index.html') + '?*'
  }, tabs => {
    let root = chrome.runtime.getURL('data/suspend/index.html');
    let sessions = tabs.filter(t => t.url.startsWith(root)).map(tab => tab.url);
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
  app.emit('session-restore');
});
// session restore
var restore = [];
chrome.storage.local.get({
  sessions: [],
  restore: navigator.userAgent.indexOf('Chrome') !== -1 && navigator.userAgent.indexOf('OPR') === -1
}, prefs => {
  restore = prefs.sessions;
  if (restore.length && prefs.restore) {
    restore.forEach(url => chrome.tabs.create({
      url,
      active: false
    }));
  }
});

// pageAction
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.pageAction[tab.url.startsWith('http') || tab.url.startsWith('ftp') ? 'show' : 'hide'](tabId);
});

// idle
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active') {
    // only suspend inactive tabs
    chrome.tabs.query({}, tabs => tabs.filter(tab => !tab.active).forEach(tab => chrome.tabs.sendMessage(tab.id, {
      cmd: 'idle-active'
    })));
  }
});

// FAQs
chrome.storage.local.get('version', prefs => {
  let version = chrome.runtime.getManifest().version;
  let isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
  if (isFirefox ? !prefs.version : prefs.version !== version) {
    window.setTimeout(() => {
      chrome.storage.local.set({version}, () => {
        chrome.tabs.create({
          url: 'http://add0n.com/tab-suspender.html?version=' + version +
            '&type=' + (prefs.version ? ('upgrade&p=' + prefs.version) : 'install')
        });
      });
    }, 3000);
  }
});
(function () {
  let {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
})();
