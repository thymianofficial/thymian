export function printStackTraces(
  err: unknown,
  jsonEnabled: boolean,
  logJsonFn: (data: unknown) => void,
): void {
  if (err instanceof Error) {
    if (jsonEnabled && err.cause) {
      logJsonFn(err.cause);
    } else if (err.cause) {
      console.log(err.cause);
    }
    printStackTraces(err.cause, jsonEnabled, logJsonFn);
  }
}
