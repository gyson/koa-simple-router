/* global describe, it */

'use strict'

const assert = require('assert')
const router = require('../index')
const compose = require('koa-compose')

function test (mw, obj) {
  for (let key of Object.keys(obj)) {
    let ctx = {
      method: key.split(' ')[0],
      path: key.split(' ')[1],
      calls: [],

      // for testing _.map({...})
      _head: {},
      set: (key, value) => {
        ctx._head[key] = value
      }
    }
    it(key, () => {
      return compose([mw])(ctx).then(() => {
        obj[key](ctx)
      })
    })
  }
}

describe('router()', () => {
  let mw = router('/api', _ => {
    _.get('/hello', ctx => {
      ctx.calls.push(0)
    })
  })

  test(mw, {
    'GET /api/hello': ctx => {
      assert.deepEqual(ctx.calls, [0])
    }
  })

  let mw2 = router('/api/:user', _ => {
    _.get('/:count', (ctx, next) => {
      assert.equal(ctx.params.user, 'gyson')
      assert.equal(ctx.params.count, '10')
      ctx.calls.push(1)
      return next()
    })
    _.get('/10', ctx => {
      ctx.calls.push(2)
    })
  })

  test(mw2, {
    'GET /api/gyson/10': ctx => {
      assert.deepEqual(ctx.calls, [1, 2])
    }
  })
})

describe('_.verb()', () => {
  let mw = compose([
    router(_ => _
      .get('/path',
        (ctx, next) => {
          ctx.calls.push(0)
          return next().catch(e => {
            ctx.calls.push(2)
          })
        },
        (ctx, next) => {
          ctx.calls.push(1)
          throw new Error()
        }
      )
      .post('/path2', (ctx, next) => {
        ctx.calls.push(4)
      })
      .delete('/path3', (ctx, next) => {
        ctx.calls.push(5)
        return next()
      })
    ),
    (ctx, next) => {
      ctx.calls.push(-1)
    }
  ])

  test(mw, {
    'GET /path': ctx => {
      assert.deepEqual(ctx.calls, [0, 1, 2])
    },
    'POST /path2': ctx => {
      assert.deepEqual(ctx.calls, [4])
    },
    'DELETE /path3': ctx => {
      assert.deepEqual(ctx.calls, [5, -1])
    }
  })
})

describe('_.router()', () => {
  let mw = router(_ => {
    _.router('/path', _ => {
      _.router('/:to', _ => {
        _.get('/:dest', ctx => {
          assert.equal(ctx.params.to, 'to')
          assert.equal(ctx.params.dest, 'dest')
          ctx.calls.push(0)
        })
      })
    })
    _.router('/test2', _ => {
      _.router('/:hello', _ => {
        _.get('/:cool?', ctx => {
          assert.equal(ctx.params.hello, 'hello')
          assert.equal(ctx.params.cool, 'cool')
          ctx.calls.push(1)
        })
        _.post('/:cool?', ctx => {
          assert.equal(ctx.params.hello, 'hello')
          assert.equal(ctx.params.cool, undefined)
          ctx.calls.push(2)
        })
        _.delete('/', ctx => {
          ctx.calls.push(3)
        })
      })
      _.delete('/', ctx => {
        ctx.calls.push(4)
      })
    })
  })

  test(mw, {
    'GET /path/to/dest': ctx => {
      assert.deepEqual(ctx.calls, [0])
    },
    'GET /test2/hello/cool': ctx => {
      assert.deepEqual(ctx.calls, [1])
    },
    'POST /test2/hello': ctx => {
      assert.deepEqual(ctx.calls, [2])
    },
    'DELETE /test2/hello': ctx => {
      assert.deepEqual(ctx.calls, [3])
    },
    'DELETE /test2/': ctx => {
      assert.deepEqual(ctx.calls, [4])
    }
  })
})

describe('_.map()', () => {
  let mw = router(_ => {
    _.map('/hello', {
      get: ctx => {
        ctx.calls.push(0)
      },
      post: ctx => {
        ctx.calls.push(1)
      }
    })
  })

  test(mw, {
    'GET /hello': ctx => {
      assert.deepEqual(ctx.calls, [0])
    },
    'HEAD /hello': ctx => {
      assert.deepEqual(ctx.calls, [0])
    },
    'POST /hello': ctx => {
      assert.deepEqual(ctx.calls, [1])
    },
    'OPTIONS /hello': ctx => {
      assert.deepEqual(ctx.calls, [])
      assert.equal(ctx.status, 200)

      let allowed = ctx._head['Allow'].split(', ').sort()
      assert.deepEqual(allowed, ['GET', 'HEAD', 'OPTIONS', 'POST'])
    },
    'DELETE /hello': ctx => {
      assert.deepEqual(ctx.calls, [])
      assert.equal(ctx.status, 405) // not allowed
    }
  })
})

describe('router.setting()', () => {
  // it('GET /path/to/dest', () => {})
  // let router2 = router.setting({})
  // let router3 = router2.setting({})
  //
  // router2(_ => {
  //   // _
  // })
})

describe('compound router', () => {
  let mw = router(_ => {
    _.get('/path/:to/:dest', ctx => {
      assert.equal(ctx.params.to, 'to')
      assert.equal(ctx.params.dest, 'dest')
      ctx.calls.push(0)
    })
    _.get('/:yy', ctx => {
      assert.equal(ctx.params.yy, 'yy')
      ctx.calls.push(1)
    })
  })

  test(mw, {
    'GET /path/to/dest': ctx => {
      assert.deepEqual(ctx.calls, [0])
    },
    'GET /yy': ctx => {
      assert.deepEqual(ctx.calls, [1])
    }
  })
})
