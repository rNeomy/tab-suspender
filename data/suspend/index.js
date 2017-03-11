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

function setFavicon(favicon) {
  document.querySelector('link[rel*="icon"]').href = favicon;
}

// fav icon
(function (img) {
  // Source: https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
  img.crossOrigin = "anonymous";  // This enables CORS

  img.onload = () => {
    let canvas = document.querySelector('canvas');
    let ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;

    ctx.globalAlpha = 0.4;
    ctx.drawImage(img, 0 , 0);

    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.fillStyle = '#6fb9b3';
    ctx.arc(img.width * 0.75, img.height * 0.75, img.width * 0.25, 0, 2 * Math.PI, false);
    ctx.fill();

    setFavicon(canvas.toDataURL('image/ico'));
  };

  if (navigator.userAgent.indexOf("Firefox") !== -1) {
    img.src = decodeURIComponent(search.favicon) ||
              chrome.extension.getURL('data/suspend/favicon.png');
  } else {
    img.src = 'chrome://favicon/' + decodeURIComponent(search.url) ||
              chrome.extension.getURL('data/suspend/favicon.png');
  }

})(new Image());

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
