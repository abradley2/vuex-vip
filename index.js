const equals = require('deep-equal')

module.exports = function (name, version, promise) {
  const Promise = window.Promise || promise
  var db
  var resolveCreate
  var rejectCreate

  if (typeof name !== 'string' || typeof version !== 'number') {
    throw new Error('Please provide name (string) and version number (integer)')
  }

  const openRequest = window.indexedDB.open(name, parseInt(version, 10))

  const createPromise = new Promise(function (resolve, reject) {
    resolveCreate = resolve
    rejectCreate = reject
  })

  openRequest.onerror = rejectCreate

  openRequest.onupgradeneeded = function (e) {
    db = e.target.result

    for (var i = 0; i < db.objectStoreNames.length; i++) {
      db.deleteObjectStore(db.objectStoreNames[i])
    }

    function checkReady () {
      if (
        db.objectStoreNames.contains('saved') &&
        db.objectStoreNames.contains('initial')
      ) {
        resolveCreate(storeTransaction(db))
      }
    }

    const stored = db.createObjectStore('saved', {keyPath: '__namespace__'})
    stored.createIndex('state', 'state', {unique: false})
    stored.transaction.oncomplete = checkReady
    stored.transaction.onerror = rejectCreate

    const prev = db.createObjectStore('initial', {keyPath: '__namespace__'})
    prev.createIndex('state', 'state', {unique: false})
    prev.transaction.oncomplete = checkReady
    prev.transaction.onerror = rejectCreate
  }

  openRequest.onsuccess = function (e) {
    db = e.target.result
    resolveCreate(storeTransaction(db))
  }

  function wrapStore (namespace, store) {
    // create a dedicated writer for the store, that has a bottleneck
    // so we aren't firing off a bunch of rapid writes all overwriting
    // eachother anyway
    const writer = bottleneck(function (state) {
      createPromise.then(function (handler) {
        handler('saved', 'put', state)
      })
    }, 500)

    if (!store.mutations) store.mutations = {}
    if (!store.state) store.state = {}

    store.state.__namespace__ = namespace

    // wrap store mutations to be setters
    for (var methodName in store.mutations) {
      store.mutations[methodName] = (function (mutation) {
        return function (state, payload) {
          // apply the mutation
          mutation(state, payload)
          // invoke the writer
          writer(state)
        }
      })(store.mutations[methodName])
    }

    store.mutations.__reloadState__ = function (state, newState) {
      for (var key in newState) {
        state[key] = newState[key]
      }
    }
  }

  return function recordState (store) {
    wrapStore('root', store)

    for (var ns in store.modules) {
      wrapStore(ns, store.modules[ns])
    }

    return createPromise
      .then(function (handler) {
        const moduleNames = Object.keys(store.modules)
        // grab the data that was previously set
        const getInitialStates = handler('initial', 'getAll')
        const getSavedStates = handler('saved', 'getAll')

        return Promise.all([getInitialStates, getSavedStates])
          .then(function (states) {
            const initialStates = getStateMap(states[0])
            const savedStates = getStateMap(states[1])

            // clean up any parts of state that are no longer in the app
            // this does not have to block the promise chain
            for (let ns in initialStates) {
              if (ns !== 'root' && moduleNames.indexOf(ns) === -1) {
                handler('initial', 'delete', ns)
                handler('saved', 'delete', ns)
              }
            }

            // call setupStore on each module, which conditionally re-adds initial state
            setupStore(store, initialStates.root, savedStates.root)
            moduleNames.map(function (ns) {
              setupStore(store.modules[ns], initialStates[ns], savedStates[ns])
            })

            return Promise.resolve()
          })
      })

    function setupStore (store, initialState, savedState) {
      // if there is saved state, and initial state has not changed,
      // we can safely reload the savedState
      if (savedState && equals(initialState, store.state)) {
        store.mutations.__reloadState__(store.state, savedState)
      } else {
        // otherwise, don't reload it. And make the new saved state the store's
        // new initial state
        storeTransaction(db, 'initial', 'put', store.state)
      }
    }
  }
}

// simple and easy to use promise wrappers for the
// indexedDB transactions done above
function storeTransaction (db, objectStore, transactionType, ...args) {
  if (arguments.length === 1) return storeTransaction.bind({}, db)

  const access = transactionType === 'get' ? 'readonly' : 'readwrite'
  const transaction = db.transaction([objectStore], access)

  const request = transaction.objectStore(objectStore)[transactionType](...args)

  return new Promise(function (resolve, reject) {
    request.onerror = function (err) {
      reject(err)
    }

    request.onsuccess = function (e) {
      resolve(e.target.result)
    }
  })
}

function getStateMap (states) {
  return states.reduce(function (acc, cur) {
    acc[cur.__namespace__] = cur
    return acc
  }, {})
}

// utility function used to bottleneck writes after store mutations
function bottleneck (func, time) {
  var lastArgs = []
  var pending = false
  function debounced () {
    lastArgs = arguments
    if (pending) {
      clearTimeout(pending)
    }
    pending = setTimeout(function () {
      func.apply({}, lastArgs)
    }, time)
  }
  return debounced
}
