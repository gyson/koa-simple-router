/* global describe, it */

'use strict'

const Koa = require('koa')
const assert = require('assert')
const router = require('./index')
const request = require('supertest')

describe('router(init)', () => {
  let app = new Koa()

  app.use(router(_ => _
    .get('/:user/:id', ctx => {
      assert.equal(ctx.params.user, 'gyson')
      assert.equal(ctx.params.id, '7')
      ctx.body = 'matched'
    })
  ))

  app.use(ctx => {
    ctx.status = 404
    ctx.body = 'not matched'
  })

  let handler = app.callback()

  it('should match GET /gyson/7', done => {
    request(handler)
      .get('/gyson/7')
      .expect(200, 'matched')
      .end(done)
  })

  it('should not match GET /unknown/dest/path', done => {
    request(handler)
      .get('/unknown/dest/path')
      .expect(404, 'not matched')
      .end(done)
  })
})

describe('router(options, init)', () => {
  let app = new Koa()

  app.use(router({ prefix: '/api' }, _ => {
    _.get('/hello', ctx => {
      ctx.body = 'foo'
    })
  }))

  it('should match GET /api/hello', done => {
    request(app.callback())
      .get('/api/hello')
      .expect(200, 'foo')
      .end(done)
  })

  it('should not match GET /', done => {
    request(app.callback())
      .get('/')
      .expect(404)
      .end(done)
  })

  let app2 = new Koa()

  app2.use(router({ prefix: '/api/:user' }, _ => {
    _.get('/:count', (ctx, next) => {
      assert.equal(ctx.params.user, 'gyson')
      assert.equal(ctx.params.count, '10')
      ctx.body = [1]
      return next()
    })
    _.get('/10', ctx => {
      ctx.body.push(2)
    })
  }))

  it('should match GET /api/gyson/10', done => {
    request(app2.callback())
      .get('/api/gyson/10')
      .expect(200, [1, 2])
      .end(done)
  })

  describe('should be able to setting strict', () => {
    let app = new Koa()

    app.use(router({ strict: true }, _ => {
      _.get('/abc', ctx => {
        ctx.body = 'abc'
      })
    }))

    it('should match GET /abc', done => {
      request(app.callback())
        .get('/abc')
        .expect(200, 'abc')
        .end(done)
    })

    it('should not match GET /abc/ with { strict: true }', done => {
      request(app.callback())
        .get('/abc/')
        .expect(404)
        .end(done)
    })
  })
})

describe('_.verb(path, mw)', () => {
  let app = new Koa()

  app.use((ctx, next) => {
    ctx.body = []
    return next()
  })

  app.use(router(_ => _
    .get('/path',
      (ctx, next) => {
        ctx.body.push(0)
        return next().catch(e => {
          ctx.body.push(2)
        })
      },
      (ctx, next) => {
        ctx.body.push(1)
        throw new Error()
      }
    )
    .post('/path2', (ctx, next) => {
      ctx.body.push(4)
    })
    .delete('/path3', (ctx, next) => {
      ctx.body.push(5)
      return next()
    })
  ))

  app.use(ctx => {
    ctx.body.push(-1)
  })

  let handler = app.callback()

  it('should match GET /path', done => {
    request(handler)
      .get('/path')
      .expect(200, [0, 1, 2])
      .end(done)
  })

  it('should match POST /path2', done => {
    request(handler)
      .post('/path2')
      .expect(200, [4])
      .end(done)
  })

  it('should match DELETE /path3', done => {
    request(handler)
      .delete('/path3')
      .expect(200, [5, -1])
      .end(done)
  })
})

describe('_.all(path, mw)', () => {
  let app = new Koa()

  app.use(router(_ => {
    _.all('/hello', {
      get: ctx => {
        ctx.body = 'GET IT'
      },
      post: ctx => {
        ctx.body = 'POST IT'
      }
    })
  }))

  let handler = app.callback()

  it('should match GET /hello', done => {
    request(handler)
      .get('/hello')
      .expect(200, 'GET IT')
      .end(done)
  })

  it('should match HEAD /hello', done => {
    request(handler)
      .head('/hello')
      .expect(200)
      .end(done)
  })

  it('should match POST /hello', done => {
    request(handler)
      .post('/hello')
      .expect(200, 'POST IT')
      .end(done)
  })

  it('should match OPTIONS /hello', done => {
    request(handler)
      .options('/hello')
      .expect(200)
      .expect(res => {
        let allowed = res.headers['allow'].split(', ').sort()
        assert.deepEqual(allowed, ['GET', 'HEAD', 'OPTIONS', 'POST'])
      })
      .end(done)
  })

  it('should match DELETE /hello', done => {
    request(handler)
      .delete('/hello')
      .expect(405)
      .end(done)
  })

  it('should throw with _.all(path, { invalidMethod: x })', () => {
    assert.throws(() => {
      router(_ => {
        _.all('/path', {
          invalidMethod: (ctx, next) => {}
        })
      })
    })
  })
})

describe('_.param(name, mw)', () => {
  it('should only be called once', done => {
    let app = new Koa()

    app.use(router(_ => {
      _.param('user', (ctx, next) => {
        ctx.body = [ctx.params.user, 1]
        return next()
      })
      _.get('/:user', (ctx, next) => {
        ctx.body.push(2)
        return next()
      })
      _.get('/:user', (ctx, next) => {
        ctx.body.push(3)
      })
    }))

    request(app.callback())
      .get('/hello')
      .expect(200, ['hello', 1, 2, 3])
      .end(done)
  })

  it('should be called even in prefix', done => {
    let app = new Koa()

    app.use(router({ prefix: '/api/:user' }, _ => {
      _.param('user', (ctx, next) => {
        ctx.body = [ctx.params.user, 1]
        return next()
      })
      _.get('/hello', (ctx, next) => {
        ctx.body.push(2)
        return next()
      })
      _.get('/:yes', (ctx, next) => {
        ctx.body.push(3)
        ctx.body.push(ctx.params.yes)
      })
    }))

    request(app.callback())
      .get('/api/gyson/hello')
      .expect(200, ['gyson', 1, 2, 3, 'hello'])
      .end(done)
  })

  it('should not call it', done => {
    let app = new Koa()

    app.use(router(_ => {
      _.param('user', (ctx, next) => {
        ctx.body = 'no'
      })
      _.get(['/hello', '/okk/:user'], (ctx, next) => {
        ctx.body = 'yes'
      })
    }))

    request(app.callback())
      .get('/hello')
      .expect(200, 'yes')
      .end(done)
  })
})

describe('compound router', () => {
  let app = new Koa()

  app.use(router({ prefix: '/api/:username' }, _ => {
    _.get('/do-abc', ctx => {
      assert.equal(ctx.params.username, 'gyson')
      ctx.body = [1, 2, 3]
    })
  }))

  app.use(router(_ => {
    _.get('/path/:to/:dest', ctx => {
      assert.equal(ctx.params.to, 'to')
      assert.equal(ctx.params.dest, 'dest')
      ctx.body = 'xxx'
    })
    _.get('/:yy', ctx => {
      assert.equal(ctx.params.yy, 'yy')
      ctx.body = 'yyy'
    })
  }))

  let handler = app.callback()

  it('should match GET /api/gyson/do-abc', done => {
    request(handler)
      .get('/api/gyson/do-abc')
      .expect(200, [1, 2, 3])
      .end(done)
  })

  it('should match GET /path/to/dest', done => {
    request(handler)
      .get('/path/to/dest')
      .expect(200, 'xxx')
      .end(done)
  })

  it('should match GET /yy', done => {
    request(handler)
      .get('/yy')
      .expect(200, 'yyy')
      .end(done)
  })
})
