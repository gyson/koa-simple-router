'use strict'

const assert = require('assert')
const methods = require('methods')
const compose = require('koa-compose')
const pathToRegexp = require('path-to-regexp')

//
// router({ prefix: '/path', ...setting }, _ => { })
//
module.exports = function router (options, init) {
  return new Router(options, init)._routes()
}

class Layer {
  constructor (router, path, array) {
    assert(array.every(x => typeof x === 'function'))

    this.router = router
    this.middleware = undefined
    this.array = array
    this.keys = []
    this.regexp = pathToRegexp(path, this.keys, router._options)
    this.recompile()
  }

  recompile () {
    let arr = this.keys.filter(key => this.router._params.has(key.name))
                       .map(key => this.router._params.get(key.name))
                       .concat(this.array)
    this.middleware = arr.length === 1 ? arr[0] : compose(arr)
  }
}

class Router {
  constructor (options, fn) {
    if (typeof options === 'function') {
      fn = options
      options = null
    }

    options = Object.assign({
      prefix: null,
      sensitive: false,
      strict: false,
      end: true
    }, options)

    this._options = options
    this._params = new Map()
    this._map = new Map()
    this._all = []
    this._stack = []
    this._prefix = null

    let prefix = options.prefix
    if (prefix) {
      assert(typeof prefix === 'string', 'prefix should be a string')
      assert(prefix.slice(-1) !== '/', 'prefix should not end with "/"')

      this._prefix = new Layer(this, `${prefix}/:rest*`, [])
      this._prefix.keys.pop()
    }

    for (let method of methods) {
      this[method] = function (path) {
        let layer = new Layer(this, path, Array.from(arguments).slice(1))

        let METHOD = method.toUpperCase()
        if (METHOD === 'GET') {
          if (!this._map.has('HEAD')) {
            this._map.set('HEAD', [].concat(this._all))
          }
          this._map.get('HEAD').push(layer)
        }
        if (!this._map.has(METHOD)) {
          this._map.set(METHOD, [].concat(this._all))
        }
        this._map.get(METHOD).push(layer)
        this._stack.push(layer)

        return this
      }
    }

    fn(this)
  }

  all (path) {
    let layer = new Layer(this, path, Array.from(arguments).slice(1).map(
      obj => typeof obj === 'function' ? obj : this._convertObjectToMiddleware(obj)
    ))

    this._map.forEach(value => value.push(layer))
    this._all.push(layer)
    this._stack.push(layer)

    return this
  }

  param (name) {
    let arr = Array.from(arguments).slice(1)

    assert(typeof name === 'string')
    assert(!this._params.has(name))
    assert(arr.every(x => typeof x === 'function'))

    let mw = arr.length === 1 ? arr[0] : compose(arr)

    let symbol = Symbol()

    this._params.set(name, (ctx, next) => {
      if (ctx[symbol] || ctx.params[name] == null) {
        return next()
      }
      ctx[symbol] = true
      return mw(ctx, next)
    })

    this._stack.forEach(layer => {
      if (layer.keys.some(key => key.name === name)) {
        layer.recompile()
      }
    })

    if (this._prefix) {
      if (this._prefix.keys.some(key => key.name === name)) {
        this._prefix.recompile()
      }
    }

    return this
  }

  _routes () {
    if (!this._prefix) {
      return (ctx, next) => {
        return this._lookup(ctx, next, ctx.path)
      }
    }

    return (ctx, next) => {
      let res = this._prefix.regexp.exec(ctx.path)
      if (res == null) {
        return next()
      }
      this._setParams(ctx, this._prefix.keys, res)

      let path = res[res.length - 1] || '/'
      if (path[0] !== '/') {
        path = '/' + path
      }

      let mw = this._prefix.middleware
      if (mw) {
        return mw(ctx, () => {
          try {
            return Promise.resolve(this._lookup(ctx, next, path))
          } catch (e) {
            return Promise.reject(e)
          }
        })
      }

      return this._lookup(ctx, next, path)
    }
  }

  _lookup (ctx, next, path) {
    let method = ctx.method
    let group = this._map.has(method) ? this._map.get(method) : this._all
    let index = -1
    let dispatch = i => {
      if (i <= index) {
        throw new Error('next() called multiple times')
      }
      while (i < group.length) {
        let layer = group[i]
        let res = layer.regexp.exec(path)
        if (res == null) {
          i += 1
        } else {
          index = i
          this._setParams(ctx, layer.keys, res)
          let mw = layer.middleware
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
    return dispatch(0)
  }

  _convertObjectToMiddleware (obj) {
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

  _setParams (ctx, keys, result) {
    ctx.params = ctx.params || {}

    for (let j = 0; j < keys.length; j++) {
      let param = result[j + 1]
      if (param) {
        ctx.params[keys[j].name] = this._safeDecodeURIComponent(param)
      }
    }
  }

  _safeDecodeURIComponent (str) {
    try {
      return decodeURIComponent(str)
    } catch (e) {
      return str
    }
  }
}
