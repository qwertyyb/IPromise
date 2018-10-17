纸上得来终觉浅，绝知此事要躬行

手写 `Promise` 实现 (IPromise)

## 实现过程
首先看一下新建一个Promise的实现
```js
new Promise((resolve, reject) => {
  setTimeout(resolve, 500, 'resolved')
})
```
根据Promise规范，Promise有三种状态——pending、rejected、resolved

三种状态的转换过程是

当Promise被创建时状态为pending

当reject被调用时：pending -> rejected

当resolve被调用时：pending -> resolved

状态的转换过程是单向并且不可重复改变的

首先需要明确的是，Promise接受一个参数，而这个参数是一个函数，函数接受两个参数，而这两个参数其实就是两个回调函数。当函数执行成功的时候，执行resolve这个回调，当调用失败时，执行reject这个回调

所以在Promise的构造函数中，在执行传入函数的时候把改变状态的两个函数传为参数传入，可写出如下的代码
```js
function Promise(fn) {
  this.status = 'pending'
  this.value = undefined  // 一般而言，status为resolved时为预期返回值；rejected时为出错原因，数据类型一般为Error

  const resolve = (res) => {
    if (this.status !== 'pending') {
      return
    }
    this.status = 'resolved'
    this.value = res
  }

  const reject = (reason) => {
    if (this.status !== 'pending') {
      return
    }
    this.status = 'rejected'
    this.value = reason
  }
  try {
    /* 注意这里
    * 当函数在执行时出错时，Promise的状态会变为rejected
    */
    fn(resolve, reject)
  } catch(err) {
    reject(err)
  }
}
```
### then的实现
根据规范，Promise对象的then方法接受两个函数参数onResolve和onReject, 同时then方法返回一个Promise以供链式调用，所以then方法的结构是这样的
```js
Promise.prototype.then = function(onResolve, onReject) {
  console.log(this.status) // 输出当前的状态
  const P = this.constructor
  // (code 1)···
  return new P((resolve, reject) => {
    // (code 2)···
  })
}
```
重点在于onResolve和onReject的调用时机

先考虑Promise的传入函数为同步的情况，即在调用then方法的时候，Promise实例的状态已经变为resolved或者rejected，也即上面代码中的this.status为resolved或者rejected

当前的Promise实例状态为resolved时，要调用onResolve,把this.value作为参数。如果onResolve正常调用并且没有抛出错误时，则then返回的Promise实例resolve, 值为onResolve的返回值；如果onResolve在调用期间出错，则then返回的Promise实例reject

当前的Promise实例状态为rejected时，要调用onReject方法，把this.value作为参数。如果onReject正常执行并且没有抛出错误时，则then返回的Promise实例resolve，值为onReject的返回值；如果onReject在调用期间抛出错误，则then返回的Promise实例reject

如果resolve为null或undefined, 并且Promise实例resolved，则then返回的Promise实例直接resolve()

如果reject为null或undefined, 并且Promise实例rejected, 则then返回的Promise实例直接reject(this.value)

弄清楚了关系就可以梳理代码写出如下的代码
```js
Promise.prototype.then = function(onResolve, onReject) {
  return new Promise((resolve, reject) => {
    const resolveHandler = (value) => {
      try {
        value = onResolve ? onResolve(value) : undefined
        resolve(value)
      } catch(err) {
        reject(err)
      }
    }
    const rejectHandler = (reason) => {
      if (onReject) {
        try {
          const val = onReject(reason)
          resolve(val)
        } catch(err) {
          reject(err)
        }
      } else {
        reject(reason)
      }
    }
    if (this.status === 'resolved') {
      resolveHandler(this.value)
      return
    }
    if (this.status === 'rejected') {
      rejectHandler(this.value)
    }
  })
}
```
到目前为止，当fn为一个同步函数时，Promise执行是正常的，但是如果是异步的，then方法就失效了。

分析代码可知，当fn是异步函数，在执行then时，Promise实例的状态是pending, 所以then方法不知道当前应该执行onResolve还是onReject。

当状态为pending时，then方法应该把onResolve和onReject存放到Promise实例中，然后在resolve和reject时调用，因为一个Promise实例可以多次执行then方法，所以会有多个onResolve和onRejct函数，对应的在Promise实例中，onResolveList和onRejectList也应该是一个队列

修改Promise的构造函数如下：
```js
function Promise(fn) {
  this.status = 'pending'
  this.value = undefined  // 一般而言，status为resolved时为预期返回值；rejected时为出错原因，数据类型一般为Error

  this._onResolveList = []
  this._onRejectList = []

  const resolve = (res) => {
    if (this.status !== 'pending') {
      return
    }
    this.status = 'resolved'
    this.value = res
    this._onResolveList.forEach(onResolve => onResolve(res))
  }

  const reject = (reason) => {
    if (this.status !== 'pending') {
      return
    }
    this.status = 'rejected'
    this.value = reason
    this._onReject.forEach(onReject => onReject(reason))
  }
  try {
    /* 注意这里
    * 当函数在执行时出错时，Promise的状态会变为rejected
    */
    fn(resolve, reject)
  } catch(err) {
    reject(err)
  }
}
```
修改Promise的then方法的代码如下
```js
Promise.prototype.then = function(onResolve, onReject) {
  return new Promise((resolve, reject) => {
    const resolveHandler = (value) => {
      try {
        value = onResolve ? onResolve(value) : undefined
        resolve(value)
      } catch(err) {
        reject(err)
      }
    }
    const rejectHandler = (reason) => {
      if (onReject) {
        try {
          const val = onReject(reason)
          resolve(val)
        } catch(err) {
          reject(err)
        }
      } else {
        reject(reason)
      }
    }
    if (this.status === 'resolved') {
      resolveHandler(this.value)
      return
    }
    if (this.status === 'rejected') {
      rejectHandler(this.value)
      return
    }
    // 状态为pending时，把函数添加到队列中，等待resolve或者reject函数的调用
    this._onResolveList.push(resolveHandler)
    this._onRejectList.push(rejectHandler)
  })
}
```