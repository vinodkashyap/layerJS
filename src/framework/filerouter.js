'use strict';
var WL = require('./wl.js');
var $ = require('./domhelpers.js');
var Kern = require('../kern/Kern.js');
//var ParseManager = require("./parsemanager.js");

/**
 * load an HTML document by AJAX and return it through a promise
 *
 * @param {string} URL - the url of the HMTL document
 * @returns {Promise} a promise that will return the HTML document
 */
var loadHTML = function(URL) {
  var xhr = new XMLHttpRequest();
  var p = new Kern.Promise();
  xhr.onload = function() {
    var doc = document.implementation.createHTMLDocument("framedoc");
    doc.documentElement.innerHTML = xhr.responseText;
    p.resolve(doc);
  };
  xhr.open("GET", URL);
  xhr.responseType = "text";
  xhr.send();
  return p;
};
var getChildIndex = function(type, node) {
  var children = node.parent.children;
  var i;
  var cc = 0;
  for (i = 0; i < children.length; i++) {
    if (node === children[i]) return cc;
    if (children[i].getAttribute('data-wl-type') !== type) continue;
    cc++;
  }
  throw "node not found in parent";
};
var getLayerJSParents = function(path, node) {
  var type = node.nodeType === 1 && node.getAttribute('data-wl-type');
  if (type === 'stage' || type === 'layer' || type === 'frame') {
    path = (node.getAttribute('data-wl-name') || node.id || type + "[" + getChildIndex(type, node) + "]") + (path ? "." + path : "");
  }
  if (!node.parentNode) return path;
  return getLayerJSParents(path, node.parentNode);
};
var getFramePaths = function(doc) {
  var frames = doc.querySelectorAll('[data-wl-type="frame"]');
  var paths = [];
  var f;
  for (f = 0; f < frames.length; f++) {
    paths.push({
      frame: frames[f],
      path: getLayerJSParents("", frames[f])
    });
  }
  paths = paths.sort(function(a, b) {
    return a.path.length - b.path.length;
  });
  return paths;
};

var FileRouter = Kern.EventManager.extend({
  constructor: function(rootEl) {
    rootEl = rootEl || document;
    $.addDelegtedListener(rootEl, 'click', 'a', function(event) {
      var href = this.href;
      if (href.match(/^\w+:/)) { // absolute URL
        if (!href.match(new RegExp('^' + window.location.origin))) {
          return; // external url
        }
      }
      loadHTML(href).then(function(doc) {
        var paths = getFramePaths(doc);
        var currentPaths = getFramePaths(document);
        var i, j;
        var replacedPaths = [];
        for (i = 0; i < paths.length; i++) {
          var found = false;
          for (j = 0; j < replacedPaths.length; j++) {
            if (paths[i].path.indexOf(replacedPaths[j]) === 0) {
              found = true;
              break;
            }
          }
          if (found) continue;
          found = false;
          for (j = 0; j < currentPaths.length; j++) {
            if (paths[i].path === currentPaths[j].path) {
              found = true;
              break;
            }
          }
          if (found) continue;
          found = false;
          var layerPath = paths[i].path.replace(/^(.*\.)[^\.]*$/, "$1");
          for (j = 0; j < currentPaths.length; j++) {
            if (currentPaths[j].path.indexOf(layerPath) === 0 && currentPaths[j].path.slice(layerPath.length).match(/^[^\.]*$/)) {
              found = true;
              replacedPaths.push(paths[i].path);
              var parent = currentPaths[j].frame.parentNode;
              parent.appendChild(paths[i].frame);
              // FIXME: Refactor to use new children changed paradigm of layerJS
              // calling internal function _parseChildren is not recommended
              parent._wlView._parseChildren();
              parent._wlView.transitionTo(paths[i].frame._wlView.data.attributes.name);
              break;
            }
          }
          if (found) continue;
          window.location.href = href;

        }
        console.log(paths);
      });
      event.preventDefault();
      event.stopPropagation();
    });
  }
});
WL.FileRouter = FileRouter;
