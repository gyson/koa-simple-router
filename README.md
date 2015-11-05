
# koa-simple-router

[![npm version](https://img.shields.io/npm/v/koa-simple-router.svg)](https://npmjs.org/package/koa-simple-router)
[![build status](https://travis-ci.org/gyson/koa-simple-router.svg)](https://travis-ci.org/gyson/koa-simple-router)

Simple and fast router for koa 2.x

## Features

* support prefix
* support auto OPTIONS and 405 response
* use [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) to parse url
* use express style routing ( `.get`, `.put`, `.post`, `.all`, etc )
* use loop to iterate through multiple routes instead of recursive calls
  * better performance
  * prevent max call stack error with large number of routes

## Installation

```
$ npm install koa-simple-router
```

## Usage

```js
const Koa = require('koa') // koa 2.x
const router = require('koa-simple-router')

let app = new Koa()

app.use(router(_ => {
  _.get('/', (ctx, next) => {
    ctx.body = 'hello'
  })
  _.post('/name/:id', (ctx, next) => {
    // ...
  })
})
```

## API

### `router(init)`

Create a router middleware with init function.

```js
const Koa = require('koa')
const router = require('koa-simple-router')
const app = new Koa()

app.use(router(_ => {
  _.get('/', (ctx, next) => {

  })
  _.post('/path', (ctx, next) => {

  })
}))
```

### `router(prefix, init)`

Create a router middleware with prefix string and init function.

```js
const Koa = require('koa')
const router = require('koa-simple-router')
const app = new Koa()

app.use(router('/api', _ => {
  _.get('/:user/id', (ctx, next) => {

  })
  _.post('/:user/id', (ctx, next) => {

  })
}))
```

### `router.setting(options)`

Return another router function with different options.

Default options is `{sensitive: false, strict: false, end: true}` ( same as [`path-to-regexp`](https://github.com/pillarjs/path-to-regexp) )

```js
const Koa = require('koa')
const router = require('router')
const app = new Koa()

const strictRouter = router.setting({
  sensitive: true,
  strict: true
})

app.use(strictRouter(_ => {
  _.get('/strict-and-CASE-SENSITIVE', (ctx, next) => {

  })
}))
```

### `_.verb(path, ...mw)`

```js
app.use(router(_ => {
  _.get('/path',
    (ctx, next) => {},
    (ctx, next) => {},
    (ctx, next) => {}
  )
}))
```

### `_.all(path, ...[mw | obj])`

Middleware mode: works just like `_.verb(path, ...mw)` but ignore `ctx.method`

```js
app.use(router(_ => {
  _.all('/path/to/:recource', (ctx, next) => {

  })
}))
```

Object mode: accept an object with method as key and middleware or array of middleware as value

* auto `HEAD` response if `GET` present
* auto `OPTIONS` response with `Allow` header
* auto 405 response with `Allow` header

```js
app.use(router(_ => {
  _.all('/path/to/:recource', {
    get: (ctx, next) => {

    },
    post: (ctx, next) => {

    }
    // Allow: GET, HEAD, POST, OPTIONS
  })
  //
  // you can mix middleware and object
  //
  _.all('/path2/to/:dest', authMiddleware, {
    get: (ctx, next) => {

    },
    post: (ctx, next) => {

    },
    put: (ctx, next) => {

    },
    delete: (ctx, next) => {

    }
    // Allow: GET, HEAD, POST, PUT, DELETE, OPTIONS
  })
}))
```

### `_.param(param, ...mw)`

Register middleware for named route parameters.

```js
app.use(router(_ => {
  _.param('user', async (ctx, next) => {
    ctx.user = await User.find(ctx.params.user)
    // ...
    return next()
  })

  _.get('/:user/do-x', (ctx, next) => {

  })

  _.post('/:user/do-y', (ctx, next) => {

  })
}))

```

## License

MIT
