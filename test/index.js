'use strict'

/* global describe, it */

const assert = require('assert')
const router = require('../index')
const compose = require('koa-compose')

function test (name, mw, ctx, next) {
  it(name, done => {
    ctx.done = done
    compose([mw])(ctx, next).catch(done)
  })
}

describe('simple router', () => {
  let mw = router(_ => {
    _.get('/path/:to/:dest', ctx => {
      assert.equal(ctx.id, 0)
      assert.equal(ctx.params.to, 'to')
      assert.equal(ctx.params.dest, 'dest')
      ctx.done()
    })
    _.get('/:yy', ctx => {
      assert.equal(ctx.id, 1)
      assert.equal(ctx.params.yy, 'yy')
      ctx.done()
    })
  })

  test('GET /path/to/dest', mw, {id: 0, method: 'GET', path: '/path/to/dest'})

  test('GET /yy', mw, {id: 1, method: 'GET', path: '/yy'})
})

describe('prefix router', () => {
  let mw = router('/api', _ => {
    _.get('/hello', ctx => {
      assert.equal(ctx.id, 0)
      ctx.done()
    })
  })

  test('GET /api/hello', mw, {id: 0, method: 'GET', path: '/api/hello'})

  let mw2 = router('/api/:user', _ => {
    _.get('/:count', (ctx, next) => {
      assert.equal(ctx.id, 1)
      assert.equal(ctx.params.user, 'gyson')
      assert.equal(ctx.params.count, '10')
      return next()
    })
    _.get('/10', ctx => {
      ctx.done()
    })
  })

  test('GET /api/gyson/10', mw2, {id: 1, method: 'GET', path: '/api/gyson/10'})
})

describe('nested router', t => {
  let mw = router(_ => {
    _.router('/path', _ => {
      _.router('/:to', _ => {
        _.get('/:dest', ctx => {
          assert.equal(ctx.id, 0)
          assert.equal(ctx.params.to, 'to')
          assert.equal(ctx.params.dest, 'dest')
          ctx.done()
        })
      })
    })
    _.router('/test2', _ => {
      _.router('/:hello', _ => {
        _.get('/:cool?', ctx => {
          assert.equal(ctx.id, 1)
          assert.equal(ctx.params.hello, 'hello')
          assert.equal(ctx.params.cool, 'cool')
          ctx.done()
        })
        _.post('/:cool?', ctx => {
          assert.equal(ctx.id, 2)
          assert.equal(ctx.params.hello, 'hello')
          assert.equal(ctx.params.cool, undefined)
          ctx.done()
        })
        _.delete('/', ctx => {
          assert.equal(ctx.id, 3)
          ctx.done()
        })
      })
      _.delete('/', ctx => {
        assert.equal(ctx.id, 4)
        ctx.done()
      })
    })
  })

  test('GET /path/to/dest', mw, {id: 0, method: 'GET', path: '/path/to/dest'})

  test('GET /test2/hello/cool', mw, {id: 1, method: 'GET', path: '/test2/hello/cool'})

  test('POST /test2/hello', mw, {id: 2, method: 'POST', path: '/test2/hello'})

  test('DELETE /test2/hello', mw, {id: 3, method: 'DELETE', path: '/test2/hello'})

  test('DELETE /test2/', mw, {id: 4, method: 'DELETE', path: '/test2/'})
})
