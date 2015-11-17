## info

    Time:       Tue Nov 17 2015 13:10:43 GMT-0500 (EST)
    Machine:    darwin, x64, Intel(R) Core(TM) i7-3720QM CPU @ 2.60GHz x 8
    Nodejs:     5.0.0
    V8:         4.6.85.28

## bench

* all tests use `Bluebird` as Promise polyfill
* use `wrk` to test the Requests/sec (higher is better) for 1, 50, 100, 150, 200 routes.

## stats

|   n | koa-route | koa-simple-router |
|:----|----------:|------------------:|
|   1 |  10751.19 |          10791.69 |
|  50 |   8081.09 |           9899.73 |
| 100 |   6698.71 |           9209.23 |
| 150 |   5827.95 |           8475.72 |
| 200 |   5166.77 |           7685.86 |
