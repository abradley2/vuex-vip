(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vuexIndexeddbPersist = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var equals = require('deep-equal');

module.exports = function (name, version, promise) {
  var Promise = window.Promise || promise;
  var db;
  var resolveCreate;
  var rejectCreate;

  if (typeof name !== 'string' || typeof version !== 'number') {
    throw new Error('Please provide name (string) and version number (integer)');
  }

  var openRequest = window.indexedDB.open(name, parseInt(version, 10));

  var createPromise = new Promise(function (resolve, reject) {
    resolveCreate = resolve;
    rejectCreate = reject;
  });

  openRequest.onerror = rejectCreate;

  openRequest.onupgradeneeded = function (e) {
    db = e.target.result;

    for (var i = 0; i < db.objectStoreNames.length; i++) {
      db.deleteObjectStore(db.objectStoreNames[i]);
    }

    function checkReady() {
      if (db.objectStoreNames.contains('saved') && db.objectStoreNames.contains('initial')) {
        resolveCreate(storeTransaction(db));
      }
    }

    var stored = db.createObjectStore('saved', { keyPath: '__namespace__' });
    stored.createIndex('state', 'state', { unique: false });
    stored.transaction.oncomplete = checkReady;
    stored.transaction.onerror = rejectCreate;

    var prev = db.createObjectStore('initial', { keyPath: '__namespace__' });
    prev.createIndex('state', 'state', { unique: false });
    prev.transaction.oncomplete = checkReady;
    prev.transaction.onerror = rejectCreate;
  };

  openRequest.onsuccess = function (e) {
    db = e.target.result;
    resolveCreate(storeTransaction(db));
  };

  function wrapStore(namespace, store) {
    // create a dedicated writer for the store, that has a bottleneck
    // so we aren't firing off a bunch of rapid writes all overwriting
    // eachother anyway
    var writer = bottleneck(function (state) {
      createPromise.then(function (handler) {
        handler('saved', 'put', state);
      });
    }, 500);

    if (!store.mutations) store.mutations = {};
    if (!store.state) store.state = {};

    store.state.__namespace__ = namespace;

    // wrap store mutations to be setters
    for (var methodName in store.mutations) {
      store.mutations[methodName] = function (mutation) {
        return function (state, payload) {
          // apply the mutation
          mutation(state, payload);
          // invoke the writer
          writer(state);
        };
      }(store.mutations[methodName]);
    }

    store.mutations.__reloadState__ = function (state, newState) {
      for (var key in newState) {
        state[key] = newState[key];
      }
    };
  }

  return function recordState(store) {
    wrapStore('root', store);

    for (var ns in store.modules) {
      wrapStore(ns, store.modules[ns]);
    }

    return createPromise.then(function (handler) {
      var moduleNames = Object.keys(store.modules);
      // grab the data that was previously set
      var getInitialStates = handler('initial', 'getAll');
      var getSavedStates = handler('saved', 'getAll');

      return Promise.all([getInitialStates, getSavedStates]).then(function (states) {
        var initialStates = getStateMap(states[0]);
        var savedStates = getStateMap(states[1]);

        // clean up any parts of state that are no longer in the app
        // this does not have to block the promise chain
        for (var _ns in initialStates) {
          if (_ns !== 'root' && moduleNames.indexOf(_ns) === -1) {
            handler('initial', 'delete', _ns);
            handler('saved', 'delete', _ns);
          }
        }

        // call setupStore on each module, which conditionally re-adds initial state
        setupStore(store, initialStates.root, savedStates.root);
        moduleNames.map(function (ns) {
          setupStore(store.modules[ns], initialStates[ns], savedStates[ns]);
        });

        return Promise.resolve();
      });
    });

    function setupStore(store, initialState, savedState) {
      // if there is saved state, and initial state has not changed,
      // we can safely reload the savedState
      if (savedState && equals(initialState, store.state)) {
        store.mutations.__reloadState__(store.state, savedState);
      } else {
        // otherwise, don't reload it. And make the new saved state the store's
        // new initial state
        storeTransaction(db, 'initial', 'put', store.state);
      }
    }
  };
};

// simple and easy to use promise wrappers for the
// indexedDB transactions done above
function storeTransaction(db, objectStore, transactionType) {
  for (var _len = arguments.length, args = Array(_len > 3 ? _len - 3 : 0), _key = 3; _key < _len; _key++) {
    args[_key - 3] = arguments[_key];
  }

  var _transaction$objectSt;

  if (arguments.length === 1) return storeTransaction.bind({}, db);

  var access = transactionType === 'get' ? 'readonly' : 'readwrite';
  var transaction = db.transaction([objectStore], access);

  var request = (_transaction$objectSt = transaction.objectStore(objectStore))[transactionType].apply(_transaction$objectSt, args);

  return new Promise(function (resolve, reject) {
    request.onerror = function (err) {
      reject(err);
    };

    request.onsuccess = function (e) {
      resolve(e.target.result);
    };
  });
}

function getStateMap(states) {
  return states.reduce(function (acc, cur) {
    acc[cur.__namespace__] = cur;
  }, {});
}

// utility function used to bottleneck writes after store mutations
function bottleneck(func, time) {
  var lastArgs = [];
  var pending = false;
  function debounced() {
    lastArgs = arguments;
    if (pending) {
      clearTimeout(pending);
    }
    pending = setTimeout(function () {
      func.apply({}, lastArgs);
    }, time);
  }
  return debounced;
}

},{"deep-equal":2}],2:[function(require,module,exports){
var pSlice = Array.prototype.slice;
var objectKeys = require('./lib/keys.js');
var isArguments = require('./lib/is_arguments.js');

var deepEqual = module.exports = function (actual, expected, opts) {
  if (!opts) opts = {};
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();

  // 7.3. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return opts.strict ? actual === expected : actual == expected;

  // 7.4. For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected, opts);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function isBuffer (x) {
  if (!x || typeof x !== 'object' || typeof x.length !== 'number') return false;
  if (typeof x.copy !== 'function' || typeof x.slice !== 'function') {
    return false;
  }
  if (x.length > 0 && typeof x[0] !== 'number') return false;
  return true;
}

function objEquiv(a, b, opts) {
  var i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return deepEqual(a, b, opts);
  }
  if (isBuffer(a)) {
    if (!isBuffer(b)) {
      return false;
    }
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b);
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) return false;
  }
  return typeof a === typeof b;
}

},{"./lib/is_arguments.js":3,"./lib/keys.js":4}],3:[function(require,module,exports){
var supportsArgumentsClass = (function(){
  return Object.prototype.toString.call(arguments)
})() == '[object Arguments]';

exports = module.exports = supportsArgumentsClass ? supported : unsupported;

exports.supported = supported;
function supported(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
};

exports.unsupported = unsupported;
function unsupported(object){
  return object &&
    typeof object == 'object' &&
    typeof object.length == 'number' &&
    Object.prototype.hasOwnProperty.call(object, 'callee') &&
    !Object.prototype.propertyIsEnumerable.call(object, 'callee') ||
    false;
};

},{}],4:[function(require,module,exports){
exports = module.exports = typeof Object.keys === 'function'
  ? Object.keys : shim;

exports.shim = shim;
function shim (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}

},{}]},{},[1])(1)
});