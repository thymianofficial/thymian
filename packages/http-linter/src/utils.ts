export function createRegExpFromOriginWildcard(pattern: string): RegExp {
  const regexString = `${pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')}/?(:\\d{1,5})?$`;
  return new RegExp(regexString);
}
