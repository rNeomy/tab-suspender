'use strict';

const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
const reloadKeys = ['Enter', ' ', 'Escape', 'F5']

document.body.dataset.mode = localStorage.getItem('dark') === 'true' ? 'dark' : 'white';
// https://github.com/rNeomy/tab-suspender/issues/54
chrome.storage.local.get({
  dark: false
}, prefs => document.body.dataset.mode = prefs.dark ? 'dark' : 'white');
chrome.storage.onChanged.addListener(prefs => {
  if (prefs.dark) {
    document.body.dataset.mode = prefs.dark.newValue ? 'dark' : 'white';
  }
});

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

function setFavicon(favicon) {
  document.querySelector('link[rel*="icon"]').href = favicon;
}

// fav icon
(function(img) {
  // Source: https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
  img.crossOrigin = 'anonymous';  // This enables CORS

  img.onload = () => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.globalAlpha = 0.4;
    ctx.drawImage(img, 0, 0);

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = '#6fb9b3';
    ctx.arc(img.width * 0.75, img.height * 0.75, img.width * 0.25, 0, 2 * Math.PI, false);
    ctx.fill();
    setFavicon(canvas.toDataURL('image/ico'));
  };
  img.onerror = e => console.log(e);
  if (search.favicon && search.favicon !== 'undefined' && search.favicon.startsWith('http')) {
    img.src = decodeURIComponent(search.favicon);
  }
  else {
    chrome.storage.local.get({
      google: true
    }, prefs => {
      const url = decodeURIComponent(search.url);
      if (prefs.google && url) {
        img.src = 'https://www.google.com/s2/favicons?domain=' + (new URL(url)).hostname;
      }
      else {
        img.src = navigator.userAgent.indexOf('Firefox') === -1 ?
          'chrome://favicon/' + url :
          chrome.extension.getURL('data/suspend/favicon.png');
      }
    });
  }
})(new Image());

document.addEventListener('mouseup', e => e.which === 1 && update());

function update() {
  chrome.storage.local.get({
    restore: true
  }, prefs => {
    const len = isFirefox ? 1 : 2;
    if (history.length > len && prefs.restore) {
      chrome.runtime.sendMessage({
        cmd: 'request-session-restore'
      }, () => history.back());
    }
    else {
      chrome.runtime.sendMessage({
        cmd: 'update-tab',
        url: search.url
      });
    }
  });
}

// reload on activate
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    chrome.storage.local.get({
      'focus': false
    }, prefs => prefs.focus && update());
  }
});

document.addEventListener('keypress', ({key}) => {
  if(reloadKeys.indexOf(key) > -1){
    update();
  }
});

chrome.runtime.onMessage.addListener(request => {
  if (request.cmd === 'unsuspend') {
    update();
  }
  else if (request.cmd === 'change-title') {
    document.title = request.title;
    document.querySelector('h1').textContent = request.title;
    const params = Object.entries(Object.assign(search, {
      title: request.title
    })).map(([key, value]) => key + '=' + value).join('&');
    window.history.pushState('', '', '/index.html?' + params);
  }
});
