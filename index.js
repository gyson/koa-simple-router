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
        return ro._lookup(ctx, next, ctx.method, ctx.path)
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

      return ro._lookup(ctx, next, ctx.method, path)
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
  this._map = {}
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
      this._map['HEAD'] = this._map['HEAD'] || [].concat(this._all)
      this._map['HEAD'].push(re)
    }

    this._map[METHOD] = this._map[METHOD] || [].concat(this._all)
    this._map[METHOD].push(re)

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

  for (let METHOD of Object.keys(this._map)) {
    this._map[METHOD].push(re)
  }
  this._all.push(re)

  return this
}

function objectToMiddleware (obj) {
  // object mode
  let map = {}
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
    // assert it's METHODS.indexof > 0
    map[key.toUpperCase()] = mw
  }
  if (map['GET'] && !map['HEAD']) {
    map['HEAD'] = map['GET']
  }
  if (!map['OPTIONS']) {
    map['OPTIONS'] = (ctx, next) => {
      ctx.status = 200
      ctx.set('Allow', allowed)
    }
  }
  let allowed = Object.keys(map).join(', ')
  return (ctx, next) => {
    let mw = map[ctx.method]
    if (mw) {
      return mw(ctx, next)
    }
    ctx.status = 405
    ctx.set('Allow', allowed)
  }
}

Router.prototype._lookup = function (ctx, next, method, path) {
  let group = this._map[method] || this._all
  let index = -1
  return dispatch(0)
  function dispatch (i) {
    if (i <= index) {
      return Promise.reject(new Error('next() called multiple times'))
    }
    let res = null
    while (i < group.length) {
      res = group[i].exec(path)
      if (res == null) {
        i += 1
      } else {
        break
      }
    }
    index = i
    if (res == null) {
      return next()
    }
    setParams(ctx, group[i].keys, res)
    return tryCatch(group[i].mw, ctx, () => dispatch(i + 1))
  }
}

function tryCatch (mw, ctx, next) {
  try {
    return Promise.resolve(mw(ctx, next))
  } catch (e) {
    return Promise.reject(e)
  }
}
