'use strict'

const test = require('tape')
const router = require('./index')

test('koa-simple-router', t => {
  t.plan(5)

  let mw = router(_ => {
    _.get('/path/:to/:dest', ctx => {
      t.equal(ctx.id, 0)
      t.equal(ctx.params.to, 'to')
      t.equal(ctx.params.dest, 'dest')
    })

    _.get('/:yy', ctx => {
      t.equal(ctx.id, 1)
      t.equal(ctx.params.yy, 'yy')
    })
  })

  mw({id: 0, method: 'GET', path: '/path/to/dest'}, next)
  mw({id: 1, method: 'GET', path: '/yy'}, next)

  function next () {
    return Promise.resolve()
  }
})

// TODO: more ...
