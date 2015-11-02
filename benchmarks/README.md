## info

    Time:       Mon Nov 02 2015 02:01:28 GMT-0500 (EST)
    Machine:    darwin, x64, Intel(R) Core(TM) i7-3720QM CPU @ 2.60GHz x 8
    Nodejs:     5.0.0
    V8:         4.6.85.28

## stats

use `wrk` to test the Requests/sec (higher is better) for 1, 25, 50, 75, 100 routes.

|    n | koa-route | koa-simple-router |
|:-----|----------:|------------------:|
|    1 |   8611.83 |           8498.08 |
|   25 |   7473.29 |           8187.54 |
|   50 |   6846.84 |           7957.94 |
|   75 |   6217.55 |           7654.29 |
|  100 |   5727.27 |           7567.22 |
