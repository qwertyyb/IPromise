function isFunction(arg) {
  return typeof arg === 'function'
}

function IPromise(fn) {
  this.status = 'pending',
  this.value = undefined
  this._resolveList = []
  this._rejectList = []

  
  const reject = (err) => {
    if (this.status !== 'pending') {
      return
    }
    this.status = 'rejected',
    this.value = err
    this._rejectList.forEach(reject => reject(err))
  }

  const resolve = (res) => {
    if (this.status !== 'pending') {
      return
    }
    this.status = 'resolved'
    this.value = res
    this._resolveList.forEach(then => then(res))
  }
  try {
    fn(resolve, reject)
  } catch(err) {
    reject(err)
  }
}

IPromise.prototype.then = function(onResolve, onReject) {
  const p = new IPromise((resolve, reject) => {
    const resolveHandler = () => {
      try {
        let val = isFunction(onResolve) ? onResolve(this.value) : undefined
        resolve(val)
      } catch(err) {
        reject(err)
      }
    }
    const rejectHandler = () => {
      if (onReject) {
        try {
          const val = onReject(this.value)
          resolve(val)
        } catch(err) {
          reject(err)
        }
      } else {
        reject(this.value)
      }
    }
    if (this.status === 'resolved') {
      resolveHandler()
      return
    }
    if (this.status === 'rejected') {
      rejectHandler()
      return
    }
    this._resolveList.push(resolveHandler)
    this._rejectList.push(rejectHandler)
  })
  return p
}

IPromise.prototype.catch = function(errHandler) {
  const p = this.then(null, errHandler)
  return p
}

IPromise.prototype.finally = function(fn) {
  return this.then(
    value => IPromise.resolve(fn()).then(() => value),
    reason => IPromise.resolve(fn()).then(() => { throw reason }),
  )
}

// static methods
IPromise.all = function(list) {
  const result = new Array(list.length)
  let total = 0
  return new IPromise((resolve, reject) => {
    list.forEach((item, index) => {
      item.then(res => {
        result[index] = res
        total++
        if (total === list.length) {
          resolve(result)
        }
      }).catch((err) => {
        reject(err)
      })
    })
  })
}
IPromise.race = function(list) {
  return new IPromise((resolve, reject) => {
    list.forEach(item => {
      item.then(res => {
        resolve(res)
      }).catch(err => {
        reject(err)
      })
    })
  })
}
IPromise.resolve = val => new IPromise((resolve) => resolve(val))
IPromise.reject = val => new IPromise((resolve, reject) => reject(val))
