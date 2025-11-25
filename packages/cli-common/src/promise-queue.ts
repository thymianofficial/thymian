export class PromiseQueue {
  private promise = Promise.resolve();
  private counter = 0;

  add<T>(fn: () => Promise<T>): Promise<T> {
    ++this.counter;
    return new Promise((resolve, reject) => {
      this.promise = this.promise.then(async () => {
        try {
          resolve(await fn());
        } catch (e) {
          reject(e);
        } finally {
          --this.counter;
        }
      });
    });
  }

  size(): number {
    return this.counter;
  }
}
