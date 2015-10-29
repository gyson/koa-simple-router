'use strict'

const methods = require('methods')
const compose = require('koa-compose')
const pathToRegexp = require('path-to-regexp')

module.exports = setting({
  // same default as `path-to-regexp`
  sensitive: false,
  strict: false,
  end: true
})

function setting (options) {
  router.setting = setting
  return router
  function router (prefix, fn) {
    if (typeof prefix === 'function') {
      fn = prefix
      prefix = '/'
    }
    let re = prefixToRegexp(prefix, options)
    let ro = new Router(options, fn)

    return (ctx, next) => {
      let path = ctx.path
      if (prefix !== '/') {
        let res = re.exec(path)
        if (res == null) {
          return next()
        }
        setParams(ctx, re.keys, res)

        path = res[res.length - 1]
        if (!path) {
          path = '/'
        }
        if (path[0] !== '/') {
          path = '/' + path
        }
      }
      return ro._lookup(ctx, next, ctx.method, path)
    }
  }
}

function Router (options, fn) {
  this._options = options
  this._map = {}
  this._all = []
  fn(this)
}

for (let method of methods) {
  Router.prototype[method] = function (path, mw) {
    if (arguments.length > 2) {
      mw = compose(Array.from(arguments).slice(1))
    }

    let re = pathToRegexp(path, null, this._options)
    re.mw = mw

    let METHOD = method.toUpperCase()
    if (!this._map[METHOD]) {
      this._map[METHOD] = [].concat(this._all)
    }
    this._map[METHOD].push(re)

    return this
  }
}

Router.prototype.all = function (path, mw) {
  if (arguments.length > 2) {
    mw = compose(Array.from(arguments).slice(1))
  }

  let re = pathToRegexp(path, null, this._options)
  re.mw = mw

  for (let method of Object.keys(this._map)) {
    this._map[method].push(re)
  }
  this._all.push(re)

  return this
}

Router.prototype.router = function (prefix, fn) {
  // no prefix
  if (typeof prefix === 'function') {
    prefix(this)
    return this
  }
  // with prefix
  let re = prefixToRegexp(prefix, this._options)
  let router = new Router(this._options, fn)

  return this.all('*', (ctx, next) => {
    let path = ctx.params[0]
    ctx.params[0] = undefined

    let res = re.exec(path)
    if (res == null) {
      return next()
    }
    setParams(ctx, re.keys, res)

    let subpath = res[res.length - 1]
    if (!subpath) {
      subpath = '/'
    }
    if (subpath[0] !== '/') {
      subpath = '/' + subpath
    }
    return router._lookup(ctx, next, ctx.method, subpath)
  })
}

// with default HEAD and OPTIONS method
Router.prototype.map = function (path, obj) {
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
  for (let j = 0; j < keys.length; j++) {
    let param = result[j + 1]
    if (param) {
      ctx.params[keys[j].name] = safeDecodeURIComponent(param)
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

function safeDecodeURIComponent (str) {
  try {
    return decodeURIComponent(str)
  } catch (e) {
    return str
  }
}
