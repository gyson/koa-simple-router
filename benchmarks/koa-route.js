// copy && modified from koajs/route

'use strict'

/**
 * Module dependencies.
 */

const pathToRegexp = require('path-to-regexp')
const methods = require('methods')

methods.forEach(function (method) {
  module.exports[method] = create(method)
})

module.exports.del = module.exports.delete
module.exports.all = create()

function create (method) {
  if (method) method = method.toUpperCase()

  return (path, fn, opts) => {
    const re = pathToRegexp(path, opts)

    return (ctx, next) => {
      // method
      if (!matches(ctx, method)) return next()

      // use optimized code
      // https://github.com/koajs/route/pull/40/files
      const m = re.exec(ctx.path)

      // path
      if (m) {
        const args = m.slice(1).map(decode)
        args.unshift(ctx)
        args.push(next)
        return fn.apply(undefined, args)
      }

      // miss
      return next()
    }
  }
}

/**
 * Decode value.
 */

function decode (val) {
  if (val) return decodeURIComponent(val)
}

/**
 * Check request method.
 */

function matches (ctx, method) {
  if (!method) return true
  if (ctx.method === method) return true
  if (method === 'GET' && ctx.method === 'HEAD') return true
  return false
}
