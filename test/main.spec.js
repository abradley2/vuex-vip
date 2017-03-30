const persist = require('../dist/vuex-indexeddb-persist')

var vm
var store
var dbName = 'vipTest'
var version = 1

beforeEach(function () {
  const Vue = require('vue/dist/common.js')
  const Vuex = require('vuex')
  
  Vue.use(Vuex)
  
  store = {
    state: {
      name: 'Tony',
      obj: {
        nestedString: 'hello',
        nestedArray: ['chunky']
      }
    },
    modules: {
      moduleA: {
        name: 'Bradley',
        obj: {
          nestedString: 'world',
          nestedArray: ['bacon']
        }
      }
    }
  }
  return persist(dbName, version)(store)
    .then(function () {
      vm = new Vue({
        store: new Vuex.Store(store)
        template: '<div>Hello</div>',
        methods: {
        }
      })
    })
})