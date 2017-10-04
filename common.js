'use strict';

var app = {};
var unsaved = {};
var sessions = [];

var prefs = {
  pageAction: true,
  page: true,
  version: '',
  width: 700,
  height: 500,
  left: null,
  top: null,
  sessions: [],
  online: false,
  pinned: false,
  audio: true,
  unsaved: true,
  whitelist: '',
  tabs: 5,
  battery: false,
};
chrome.storage.local.get(prefs, ps => {
  Object.assign(prefs, ps);
  app.emit('prefs-ready');
});
chrome.storage.onChanged.addListener(ps => {
  Object.keys(ps).forEach(key => prefs[key] = ps[key].newValue);
});

const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
const contexts = ['page_action'];
if (isFirefox) {
  contexts.push('tab');
}

function notify(message) {
  chrome.notifications.create({
    title: 'Tab Suspender',
    type: 'basic',
    iconUrl: 'data/icons/48.png',
    message
  });
}

function tooltip(tab, title) {
  if (prefs.pageAction) {
    chrome.pageAction.setTitle({
      tabId: tab.id,
      title: 'Tab Suspender (Tab Unloader)\n\n' + title
    });
  }
}

app.callbacks = {};
app.on = (id, callback) => {
  app.callbacks[id] = app.callbacks[id] || [];
  app.callbacks[id].push(callback);
};
app.emit = (id, data) => (app.callbacks[id] || []).forEach(c => c(data));

// commands
chrome.commands.onCommand.addListener(command => {
  app.emit(command);
});
// contextMenu
chrome.contextMenus.create({
  title: 'Suspend this tab',
  contexts,
  onclick: (info, tab) => app.emit('suspend-tab', [tab])
});
app.on('prefs-ready', () => {
  if (prefs.page) {
    chrome.contextMenus.create({
      title: 'Suspend this tab',
      contexts: ['page'],
      onclick: (info, tab) => app.emit('suspend-tab', [tab])
    });
  }
});
chrome.contextMenus.create({
  title: 'Unuspend this tab',
  contexts,
  onclick: (info, tab) => app.emit('unsuspend-tab', [tab])
});
/*
chrome.contextMenus.create({
  title: 'Don\'t suspend for now',
  contexts,
  onclick: () => app.emit('dont-suspend')
});
chrome.contextMenus.create({
  title: 'Never suspend this domain',
  contexts,
  onclick: () => app.emit('protect-host')
});
*/
chrome.contextMenus.create({
  title: 'Suspend all tabs',
  contexts,
  onclick: () => app.emit('suspend-all')
});
chrome.contextMenus.create({
  title: 'Unsuspend this window',
  contexts,
  onclick: () => app.emit('unsuspend-window')
});
chrome.contextMenus.create({
  title: 'Unsuspend all tabs',
  contexts,
  onclick: () => app.emit('unsuspend-all')
});
chrome.contextMenus.create({
  title: 'Open tab in suspend mode',
  contexts: ['link'],
  onclick: i => {
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
    }, tab => {
      const req = new XMLHttpRequest();
      req.open('GET', url);
      req.responseType = 'document';
      req.onload = () => {
        const title = req.response.title;
        if (title) {
          chrome.tabs.sendMessage(tab.id, {
            cmd: 'change-title',
            title
          });
          window.setTimeout(app.emit, 500, 'session-restore');
        }
      };
      req.send();
      // Firefox issue
      window.setTimeout(app.emit, 500, 'session-restore');
    });
  }
});

function battery() {
  if ('getBattery' in navigator) {
    return navigator.getBattery().then(function(batt) {
      return batt.dischargingTime !== Infinity;
    });
  }
  else {
    return Promise.resolve(false);
  }
}

function suspend(tab, forced) {
  if (!forced && prefs.online && !navigator.onLine) {
    return tooltip(tab, 'Skipped: browser is not connected to internet');
  }
  if (!forced && prefs.pinned && tab.pinned) {
    return tooltip(tab, 'Skipped: this tab is pinned');
  }
  if (!forced && prefs.audio && tab.audible) {
    return tooltip(tab, 'Skipped: this tab is playing audio');
  }
  if (!forced && prefs.unsaved && unsaved[tab.id] && Object.values(unsaved[tab.id]).reduce((p, c) => p || c, false)) {
    return tooltip(tab, 'Skipped: this tab has unsaved form data');
  }
  const hostname = (new URL(tab.url)).hostname;
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

      const url = './data/suspend/index.html?title=' +
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
}
// check skipped conditions
(function(callback) {
  // 1. prefs.tabs
  chrome.tabs.onCreated.addListener(callback);
  // 2. online listener
  window.addEventListener('online', callback);
})(function() {
  chrome.tabs.query({
    url: ['*://*/*']
  }, tabs => tabs.filter(tab => !tab.active).forEach(tab => chrome.tabs.sendMessage(tab.id, {
    cmd: 'idle-active'
  })));
});

app.on('suspend-tab', tabs => {
  if (tabs) {
    return tabs.forEach(tab => suspend(tab, true));
  }
  chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: ['*://*/*']
  }, tabs => tabs.forEach(tab => suspend(tab, true)));
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

app.on('unsuspend-tab', tabs => {
  if (tabs) {
    return tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, {
      cmd: 'unsuspend'
    }));
  }
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
app.on('open-faqs', append => {
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
      const url = new URL(tab.url);
      let whitelist = prefs.whitelist.split(', ');
      whitelist.push(url.hostname);
      whitelist = whitelist.filter((n, i, l) => n && l.indexOf(n) === i).join(', ');
      chrome.storage.local.set({whitelist});
    });
  });
});

app.on('session-restore', () => {
  chrome.tabs.query({
    // firefox issue
    // url: chrome.runtime.getURL('data/suspend/index.html') + '?*'
  }, tabs => {
    const root = chrome.runtime.getURL('data/suspend/index.html');
    const sessions = tabs.filter(t => t.url.startsWith(root));
    if (chrome.extension.inIncognitoContext === false) {
      chrome.storage.local.set({
        sessions: sessions.map(t => ({
          tab: t.id,
          win: t.windowId,
          title: t.title,
          url: t.url,
          pinned: t.pinned,
          index: t.index
        }))
      });
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, response) => {
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
  else if (request.cmd === 'sessions') {
    response(sessions);
  }
});

// clear unused objects
chrome.tabs.onRemoved.addListener(tabId => {
  delete unsaved[tabId];
  app.emit('session-restore');
});
// session restore
if (chrome.extension.inIncognitoContext === false) {
  window.setTimeout(() => {
    chrome.tabs.query({}, tabs => {
      const urls = tabs.map(tab => tab.url);
      sessions = prefs.sessions.map(s => {
        if (typeof s === 'string') {
          return {
            url: s
          };
        }
        return s;
      }).filter(o => urls.indexOf(o.url) === -1);
      if (sessions.length) {
        chrome.windows.create({
          url: chrome.extension.getURL('data/restore/index.html'),
          width: prefs.width,
          height: prefs.height,
          left: prefs.left || Math.round((screen.availWidth - 700) / 2),
          top: prefs.top || Math.round((screen.availHeight - 500) / 2),
          type: 'popup'
        });
      }
    });
  }, 500);
}

// pageAction
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  chrome.pageAction[prefs.pageAction && tab.url.startsWith('http') || tab.url.startsWith('ftp') ? 'show' : 'hide'](tabId);
});

// idle
chrome.idle.onStateChanged.addListener(state => {
  if (state === 'active') {
    // only suspend inactive tabs
    chrome.tabs.query({}, tabs => tabs.filter(tab => !tab.active).forEach(tab => chrome.tabs.sendMessage(tab.id, {
      cmd: 'idle-active'
    })));
  }
});
// inject on startup
if (chrome.app && chrome.app.getDetails) {
  chrome.tabs.query({
    url: '*://*/*'
  }, tabs => {
    const contentScripts = chrome.app.getDetails().content_scripts;
    for (const tab of tabs) {
      chrome.pageAction[prefs.pageAction && tab.url.startsWith('http') || tab.url.startsWith('ftp') ? 'show' : 'hide'](tab.id);
      //
      for (const cs of contentScripts) {
        chrome.tabs.executeScript(tab.id, {
          file: cs.js[0],
          runAt: cs.run_at,
          allFrames: cs.all_frames,
        });
      }
    }
  });
}

// Fixing bookmarks when a suspended tab gets bookmarked
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
  let url = bookmark.url;
  if (url && url.startsWith(chrome.runtime.getURL(''))) {
    url = decodeURIComponent(url.split('url=')[1].split('&')[0]);
    window.setTimeout(() => {
      chrome.bookmarks.update(id, {url}, () => notify('Suspended URL is cleaned up!'));
    }, 3000);
  }
});

// FAQs && Bu Reposts
app.on('prefs-ready', () => {
  const version = chrome.runtime.getManifest().version;
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
{
  const {name, version} = chrome.runtime.getManifest();
  chrome.runtime.setUninstallURL('http://add0n.com/feedback.html?name=' + name + '&version=' + version);
}
