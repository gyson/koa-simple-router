'use strict'

const child = require('child_process')
const sprintf = require('sprintf-js').sprintf

const PORT = 3333

function bench (script) {
  let output = child.execSync(`
    node -e "${script}" &
    pid=$!

    sleep 2

    wrk 'http://localhost:${PORT}/hello' -d 5 -c 50 -t 8 | grep 'Requests/sec'

    kill $pid
  `, {
    cwd: __dirname
  }).toString()
  return /\d+(?:.\d+)?/.exec(output)[0]
}

function benchKoaRoute (n) {
  let result = bench(`(function () {
    'use strict'

    const Koa = require('koa')
    const _ = require('./koa-route')
    const app = new Koa()

    for (let i = 0; i < ${n}; i++) {
      app.use(_.get('/randome/' + i, ctx => {}))
      app.use(_.post('/randome/' + i, ctx => {}))
    }

    app.use(ctx => ctx.body = 'hello')

    app.listen(${PORT})
  })()`)
  return result
}

function benchKoaSimpleRouter (n) {
  let result = bench(`(function () {
    'use strict'

    const Koa = require('koa')
    const router = require('../index')
    const app = new Koa()

    app.use(router(_ => {
      for (let i = 0; i < ${n}; i++) {
        _.get('/randome/' + i, ctx => {})
        _.post('/randome/' + i, ctx => {})
      }
    }))

    app.use(ctx => ctx.body = 'hello')

    app.listen(${PORT})
  })()`)
  return result
}

console.log(`
|    n | koa-route | koa-simple-router |
|:-----|----------:|------------------:|`)

for (let n of [1, 10, 50, 100]) {
  console.log(sprintf('| %4s | %9s | %17f |', n, benchKoaRoute(n), benchKoaSimpleRouter(n)))
}
