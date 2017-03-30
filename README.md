=# Vuex-VIP

Vuex IndexedDB Persistence

VIP provides hot-reloading without having to use any sort of Browserify or
Webpack plugin- and no mucking about with specific hot-reloading integrations API.
Just persist your state!

### Motivation

When using Vuex, all that you really need for the "hot-reloading" functionality
is to save your store's state between reloads. This module does exactly that.

There are already some nice modules for persistence with Vue, however this is
_:sparkles: da best ever becuz :sparkles:_:

**Tiny!**
This module has only one small utility funciton as a dependency, and
the total size after minification is < 5kb!

**Performant**
Persistence writes are bottlenecked so they only happen 250ms after store commits
have ended (If the store is being continually mutated for 7 seconds, the write will
take place at 7.25 seconds).

**Smart state-reloading**
It is super annoying when persistence reloads old state
even though you've changed what initial state a store will have. VIP will
automatically refresh your reloaded state instead of overwriting if it detects
you've made changes to what your store's initial state is. If you divide your
state between modules, this is on a per-module basis.


### Usage

Initiate VIP by providing a name and version for the indexedDB instance

```
const Vue = require(‘vue’)
const Vuex = require(‘vex’)
const vip = require('vuex-vip’)(‘MyVueApp’, 1)

Vue.use(Vuex)
```

Wrap your Vuex store configuration

```
const storeConfig = {..}

vip(storeConfig)
  .then(function () {
    const vm = new Vue({
      storeConfig,
      template: ..,
      methods: …
    })

    vm.$mount('#app')
  })
```

IndexedDB reads are asynchronous, so it is recommended you wrap your app-start
in the `then` block of the returned promise. This is a very fast
read and the time added to startup is negligible.

**Important**
VIP requires an environment with Promise support currently. If `window.Promise` is
available, it will use that. Otherwise, you can pass in whatever [Promise polyfill](https://www.npmjs.com/package/es6-promise)
you are using as the _third_ argument to initialization (after your database version
number)

### Caveats
You store's state should be entirely serializable as JSON.

Vuex technically allows you to add whatever into your store- even objects
that aren't serializable as JSON. This will be persisted differently in
indexedDB than in your store, which is not desirable behavior.

It is best practice to only store serializable objects in your Vuex store anyway
(doing otherwise can break your dev tools time-travel debugging ability).
For non-serializable projections of your state, use Vue's `computed` feature.

### Production

You probably don't want to use this in production (yet!), so I recommend
conditionally assigning vip to an empty Promise

```
const vip = process.env.NODE_ENV === 'development' ?
  require('vuex-vip')('MyVueApp', 1)
  : Promise.resolve()
```

You can add in environment variables via Webpack, or Browserify (for Browserify,
check out [envify](https://github.com/hughsk/envify)).

### License
[The Unlicense](http://unlicense.org/)