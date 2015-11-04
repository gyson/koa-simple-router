'use strict'

const assert = require('assert')
const methods = require('methods')
const compose = require('koa-compose')
const pathToRegexp = require('path-to-regexp')

module.exports = setting({
  // same default as `path-to-regexp`
  sensitive: false,
  strict: false,
  end: true
})

// should use `.config()` ?
function setting (options) {
  router.setting = setting
  return router
  function router (prefix, fn) {
    if (typeof prefix === 'function') {
      fn = prefix
      prefix = null
    }

    let ro = new Router(options, fn)

    if (!prefix) {
      return (ctx, next) => {
        return ro._lookup(ctx, next, ctx.path)
      }
    }

    if (prefix.slice(-1) !== '/') {
      prefix += '/'
    }

    let re = pathToRegexp(prefix + ':rest*', null, options)
    re.keys.pop()

    return (ctx, next) => {
      let res = re.exec(ctx.path)
      if (res == null) {
        return next()
      }
      setParams(ctx, re.keys, res)

      let path = res[res.length - 1] || '/'
      if (path[0] !== '/') {
        path = '/' + path
      }

      return ro._lookup(ctx, next, path)
    }
  }
}

function setParams (ctx, keys, result) {
  ctx.params = ctx.params || {}

  for (let j = 0; j < keys.length; j++) {
    let param = result[j + 1]
    if (param) {
      ctx.params[keys[j].name] = safeDecodeURIComponent(param)
    }
  }
}

function safeDecodeURIComponent (str) {
  try {
    return decodeURIComponent(str)
  } catch (e) {
    return str
  }
}

function Router (options, fn) {
  this._options = options
  this._map = new Map()
  this._all = []
  fn(this)
}

for (let method of methods) {
  Router.prototype[method] = function (path) {
    let arr = Array.from(arguments).slice(1)

    assert(arr.length !== 0)
    assert(arr.every(x => typeof x === 'function'))

    let re = pathToRegexp(path, null, this._options)

    re.mw = arr.length > 1 ? compose(arr) : arr[0]

    let METHOD = method.toUpperCase()

    if (METHOD === 'GET') {
      if (!this._map.has('HEAD')) {
        this._map.set('HEAD', [].concat(this._all))
      }
      this._map.get('HEAD').push(re)
    }

    if (!this._map.has(METHOD)) {
      this._map.set(METHOD, [].concat(this._all))
    }
    this._map.get(METHOD).push(re)

    return this
  }
}

Router.prototype.all = function (path) {
  let arr = Array.from(arguments).slice(1).map(obj => {
    if (typeof obj === 'function') {
      return obj // just middleware
    }
    return objectToMiddleware(obj)
  })

  assert(arr.length !== 0)
  assert(arr.every(x => typeof x === 'function'))

  let re = pathToRegexp(path, null, this._options)

  re.mw = arr.length > 1 ? compose(arr) : arr[0]

  this._map.forEach(value => value.push(re))
  this._all.push(re)

  return this
}

function objectToMiddleware (obj) {
  // object mode
  let map = new Map()
  for (let key of Object.keys(obj)) {
    let mw = obj[key]
    if (Array.isArray(mw)) {
      mw = compose(mw)
    }
    if (typeof mw !== 'function') {
      throw new Error(mw + ' is not array or function (middleware)')
    }
    if (methods.indexOf(key.toLowerCase()) < 0) {
      throw new Error(`invalid method "${key}"`)
    }
    map.set(key.toUpperCase(), mw)
  }
  if (map.has('GET') && !map.has('HEAD')) {
    map.set('HEAD', map.get('GET'))
  }
  if (!map.has('OPTIONS')) {
    map.set('OPTIONS', (ctx, next) => {
      ctx.status = 200
      ctx.set('Allow', allowed)
    })
  }
  let allowed = Array.from(map.keys()).join(', ')
  return (ctx, next) => {
    let method = ctx.method
    if (map.has(method)) {
      return map.get(method)(ctx, next)
    }
    ctx.status = 405
    ctx.set('Allow', allowed)
  }
}

Router.prototype._lookup = function (ctx, next, path) {
  let method = ctx.method
  let group = this._map.has(method) ? this._map.get(method) : this._all
  let index = -1
  return dispatch(0)
  function dispatch (i) {
    if (i <= index) {
      throw new Error('next() called multiple times')
    }
    while (i < group.length) {
      let res = group[i].exec(path)
      if (res == null) {
        i += 1
      } else {
        index = i
        setParams(ctx, group[i].keys, res)
        let mw = group[i].mw
        return mw(ctx, () => {
          try {
            return Promise.resolve(dispatch(i + 1))
          } catch (e) {
            return Promise.reject(e)
          }
        })
      }
    }
    index = i
    return next()
  }
}
