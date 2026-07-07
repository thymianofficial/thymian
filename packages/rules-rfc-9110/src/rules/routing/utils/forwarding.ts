type HeaderValue = string | string[] | undefined;

export function headerValues(value: HeaderValue): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function equalHeaderValues(a: HeaderValue, b: HeaderValue): boolean {
  const normalize = (value: HeaderValue): string[] =>
    headerValues(value)
      .map((entry) => entry.trim())
      .sort();
  const left = normalize(a);
  const right = normalize(b);
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

export function connectionOptionNames(value: HeaderValue): string[] {
  return headerValues(value)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function parseMaxForwards(value: HeaderValue): number | undefined {
  const first = headerValues(value)[0];
  if (first === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(first.trim(), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
