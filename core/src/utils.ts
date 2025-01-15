export function timeoutPromise<T>(
  promise: Promise<T>,
  toWait = 5000,
  err?: Error
): Promise<T> {
  let timoutId: NodeJS.Timeout;

  return Promise.race<T>([
    promise,
    new Promise((_, reject) => {
      timoutId = setTimeout(
        () => reject(err ?? new Error(`Promise timed out after ${toWait} ms.`)),
        toWait
      );
    }),
  ]).finally(() => clearTimeout(timoutId));
}
