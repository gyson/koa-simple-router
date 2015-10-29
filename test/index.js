'use strict'

const test = require('tape')
const router = require('../index')
const compose = require('koa-compose')

test('simple router', t => {
  t.plan(5)

  let mw = compose([
    router(_ => {
      _.get('/path/:to/:dest', ctx => {
        t.same(ctx.id, 0)
        t.same(ctx.params.to, 'to')
        t.same(ctx.params.dest, 'dest')
      })
      _.get('/:yy', ctx => {
        t.same(ctx.id, 1)
        t.same(ctx.params.yy, 'yy')
      })
    })
  ])

  mw({id: 0, method: 'GET', path: '/path/to/dest'})
  mw({id: 1, method: 'GET', path: '/yy'})
})

test('prefix router', t => {
  t.plan(5)

  let mw = compose([
    router('/api', _ => {
      _.get('/hello', ctx => {
        t.same(ctx.id, 0)
      })
    })
  ])

  mw({id: 0, method: 'GET', path: '/api/hello'})

  let mw2 = compose([
    router('/api/:user', _ => {
      _.get('/:count', (ctx, next) => {
        t.same(ctx.id, 1)
        t.same(ctx.params.user, 'gyson')
        t.same(ctx.params.count, '10')
        return next()
      })
      _.get('/10', ctx => {
        t.pass()
      })
    })
  ])

  mw2({id: 1, method: 'GET', path: '/api/gyson/10'})
})

test('nested router', t => {
  t.plan(11)

  let mw = compose([
    router(_ => {
      _.router('/path', _ => {
        _.router('/:to', _ => {
          _.get('/:dest', ctx => {
            t.same(ctx.id, 0)
            t.same(ctx.params.to, 'to')
            t.same(ctx.params.dest, 'dest')
          })
        })
      })
      _.router('/test2', _ => {
        _.router('/:hello', _ => {
          _.get('/:cool?', ctx => {
            t.same(ctx.id, 1)
            t.same(ctx.params.hello, 'hello')
            t.same(ctx.params.cool, 'cool')
          })
          _.post('/:cool?', ctx => {
            t.same(ctx.id, 2)
            t.same(ctx.params.hello, 'hello')
            t.same(ctx.params.cool, undefined)
          })
          _.delete('/', ctx => {
            t.same(ctx.id, 3)
          })
        })
        _.delete('/', ctx => {
          t.same(ctx.id, 4)
        })
      })
    })
  ])

  mw({id: 0, method: 'GET', path: '/path/to/dest'})
  mw({id: 1, method: 'GET', path: '/test2/hello/cool'})
  mw({id: 2, method: 'POST', path: '/test2/hello'})
  mw({id: 3, method: 'DELETE', path: '/test2/hello'})
  mw({id: 4, method: 'DELETE', path: '/test2/'})
})
