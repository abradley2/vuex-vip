# Vuex IndexedDB Persist

Persist your Vuex state tree to indexedDB

This is currently best used for development purposes only.

### Purpose

This provides "Hot reloading" without actually having to use the feature as
provided by Webpack or Browserify.

If you are using Vuex- all you need to do is persist state and replace your store's
initial state on startup. This is much more simple then hot-reloading's "opt-in" architecture.

There are other Vuex-persistance libraries available, however this offers some nice
features that I personally cannot live without:

1. IndexedDB is used instead of window.localStorage.
It is fast, and supported by all major browsers (including IE10).
2. When some piece of default state on your store or a store module changes from
it's previous default state- the "persisted" state will be reset. This creates a
much more pleasant development experience, and by itself prevents most the bugs
that "version-bumping" the database number normally does.
3. In addition to having indexedDB's performance, "save-state" writes are
bottlenecked such that a write happens only 250ms after all queued up actions
have finished. 
4. Lightweight- apart from a possible promise polyfill (which you probably were
using anyway), and , this module is a mere < 200 lines of code

### Setup
To initiate the local indexedDB datebase:

**databaseName (string)** The name of the indexedDB database to be created/used  
**version (integer)** Version number of the database. Increment this to force a reset  
**promisePolyfill (promise, optional)** Promise polyfill if needed (in older browser environment)  

`const persist = require('vuex-indexeddb-persist')('MyVueApp', 1, require('es6-promise'))`  

This returns a function which takes your `storeConfig` (the object you pass to Vuex's store
constructor) and returns a Promise which resolves once initialState has been loaded.

### Usage

Instead of as a plugin, the recommended way to use this is as a wrapper around your
store's configuration. This returns a promise so- if you choose- you can wait
for previous state to be loaded (the time added is negligible)

```
const Vue = require('vue')
const Vuex = require('vuex')
const persist = require('vuex-indexeddb-persist')

Vue.use(Vuex)

const storeConfig = {
  state: {..},
  modules: {..},
  plugins: {..}
}

persist('myVueApp', 1)(storeConfig)
  .then(start)
  .catch(start)
  
function start () {
  const vm = new Vue({
    store: new Vuex.Store(storeConfig),
    ..
  })
  
  vm.$mount('#app')
}
```



