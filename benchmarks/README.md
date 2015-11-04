## info

    Time:       Tue Nov 03 2015 21:32:08 GMT-0500 (EST)
    Machine:    darwin, x64, Intel(R) Core(TM) i7-3720QM CPU @ 2.60GHz x 8
    Nodejs:     5.0.0
    V8:         4.6.85.28

## bench

* all tests use `Bluebird` as Promise polyfill
* use `wrk` to test the Requests/sec (higher is better) for 1, 25, 50, 75, 100 routes.

## stats

|   n | koa-route | koa-simple-router |
|:----|----------:|------------------:|
|   1 |  10733.29 |          10456.27 |
|  50 |   8419.84 |           9964.29 |
| 100 |   6542.88 |           8754.04 |
| 150 |   5551.94 |           8294.37 |
| 200 |   5178.56 |           7749.44 |
