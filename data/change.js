'use strict';

var changes = [];
var id = Math.random();

document.addEventListener('change', e => {
  let target = e.target;
  if (target.closest('form')) {
    let index = changes.indexOf(target);
    if (target.value) {
      if (index === -1) {
        changes.push(target);
      }
    }
    else {
      if (index !== -1) {
        changes.splice(index, 1);
      }
    }
    chrome.runtime.sendMessage({
      cmd: 'form-changed',
      unsaved: changes.length,
      id
    });
  }
});
