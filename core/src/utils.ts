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

export function isRecord(
  value: unknown
): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && !Array.isArray(value) && value !== null;
}

export function matchObjects(source: unknown, target: unknown): boolean {
  if (!isRecord(source) || !isRecord(target)) return false;

  return Object.entries(target).every(
    ([key, value]) => key in source && source[key] === value
  );
}

export type KeysWithStringOrNumberValue<T> = keyof {
  [P in keyof T as T[P] extends (string | undefined) | (number | undefined)
    ? P
    : never]: P;
};

export type StringAndNumberProperties<T> = Partial<{
  [key in KeysWithStringOrNumberValue<T>]: T[key];
}>;

export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export function zipArrays<A, B>(as: A[], bs: B[]): [A, B][] {
  if (as.length !== bs.length) {
    throw new Error('as.length !== bs.length');
  }

  return bs.map((b, i) => [as[i]!, b]);
}
