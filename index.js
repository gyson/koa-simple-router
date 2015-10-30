'use strict'

const methods = require('methods')
const compose = require('koa-compose')
const pathToRegexp = require('path-to-regexp')

const RAW = Symbol()

module.exports = setting({
  // same default as `path-to-regexp`
  sensitive: false,
  strict: false,
  end: true
})

function setting (options) {
  router.setting = setting
  Object.assign(router, options)
  return router
  function router (prefix, fn) {
    if (typeof prefix === 'function') {
      fn = prefix
      prefix = '/'
    }
    let re = prefixToRegexp(prefix, router)
    let ro = new Router(options, fn)

    return (ctx, next) => {
      let path = ctx.path
      if (prefix !== '/') {
        let res = re.exec(path)
        if (res == null) {
          return next()
        }
        setParams(ctx, re.keys, res)
        path = res[res.length - 1] || '/'
        if (path[0] !== '/') {
          path = '/' + path
        }
      }
      return ro._lookup(ctx, next, ctx.method, path)
    }
  }
}

function prefixToRegexp (prefix, options) {
  if (prefix.slice(-1) !== '/') {
    prefix += '/'
  }
  let re = pathToRegexp(prefix + ':rest*', null, options)
  re.keys.pop()
  return re
}

function setParams (ctx, keys, result) {
  if (!ctx.params) {
    ctx.params = {}
  }
  ctx.params[RAW] = result
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

class Router {
  constructor (options, fn) {
    this._options = options
    this._map = {}
    this._all = []
    for (let method of methods) {
      this[method] = function (path, mw) {
        if (arguments.length > 2) {
          mw = compose(Array.from(arguments).slice(1))
        }
        let re = pathToRegexp(path, null, this._options)
        return this._register(re, mw, method)
      }
    }
    fn(this)
  }

  all (path, mw) {
    if (arguments.length > 2) {
      mw = compose(Array.from(arguments).slice(1))
    }
    let re = pathToRegexp(path, null, this._options)
    return this._register(re, mw)
  }

  router (prefix, fn) {
    // no prefix
    if (typeof prefix === 'function') {
      prefix(this)
      return this
    }
    // with prefix
    let re = prefixToRegexp(prefix, this._options)
    let ro = new Router(this._options, fn)

    return this._register(re, (ctx, next) => {
      let raw = ctx.params[RAW]
      let path = raw[raw.length - 1] || '/'
      if (path[0] !== '/') {
        path = '/' + path
      }
      return ro._lookup(ctx, next, ctx.method, path)
    })
  }

  // with default HEAD and OPTIONS method
  map (path, obj) {
    let map = {}
    for (let key of Object.keys(obj)) {
      let mw = obj[key]
      if (Array.isArray(mw)) {
        mw = compose(mw)
      }
      if (typeof mw !== 'function') {
        throw new Error(mw + ' is not array or function (middleware)')
      }
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
    return this.all(path, (ctx, next) => {
      let method = ctx.method
      let mw = map[method]
      if (mw) {
        return mw(ctx, next)
      }
      ctx.status = 405
      ctx.set('Allow', allowed)
    })
  }

  _register (re, mw, method) {
    if (typeof mw !== 'function') {
      throw new TypeError(mw + ' is not middleware function')
    }
    re.mw = mw
    if (method) {
      method = method.toUpperCase()
      if (!this._map[method]) {
        this._map[method] = [].concat(this._all)
      }
      this._map[method].push(re)
    } else {
      // .all
      for (let method of Object.keys(this._map)) {
        this._map[method].push(re)
      }
      this._all.push(re)
    }
    return this
  }

  _lookup (ctx, next, method, path) {
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
}

function tryCatch (mw, ctx, next) {
  try {
    return Promise.resolve(mw(ctx, next))
  } catch (e) {
    return Promise.reject(e)
  }
}
