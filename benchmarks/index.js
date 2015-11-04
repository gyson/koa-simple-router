'use strict'

const os = require('os')
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

const useBluebird = `global.Promise = require('bluebird')`

function benchKoaRoute (n) {
  let result = bench(`(function () {
    'use strict'

    ${useBluebird}
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

    ${useBluebird}
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
## info

    Time:       ${new Date()}
    Machine:    ${os.platform()}, ${os.arch()}, ${os.cpus()[0].model} x ${os.cpus().length}
    Nodejs:     ${process.versions.node}
    V8:         ${process.versions.v8}

## bench

* all tests use \`Bluebird\` as Promise polyfill
* use \`wrk\` to test the Requests/sec (higher is better) for 1, 25, 50, 75, 100 routes.

## stats

|   n | koa-route | koa-simple-router |
|:----|----------:|------------------:|`)

for (let n of [1, 50, 100, 150, 200]) {
  console.log(sprintf('| %3s | %9s | %17f |', n, benchKoaRoute(n), benchKoaSimpleRouter(n)))
}
