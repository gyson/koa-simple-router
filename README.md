
# koa-simple-router [![build status](https://travis-ci.org/gyson/koa-simple-router.svg)](https://travis-ci.org/gyson/koa-simple-router)

Simple router for koa v2

## Installation

```
$ npm install koa-simple-router
```

## Usage

```js
const Koa = require('koa') // koa 2.0
const router = require('koa-simple-router')

let app = new Koa()

app.use(router(_ => {
  _.get('/', (ctx, next) => {
    ctx.body = 'home page'
  })

  _.get('/hello', (ctx, next) => {
    // ...
  })
})
```

## License

MIT
