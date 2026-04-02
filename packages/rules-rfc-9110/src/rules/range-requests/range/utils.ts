export type ByteRange = {
  start: number;
  end: number;
};

export function parseRangeHeader(header: string | string[]): ByteRange[] {
  if (Array.isArray(header)) {
    return header.flatMap(parseRangeHeader);
  }

  const [, rangesString] = header.match(/bytes=(.+)/) ?? [];

  if (!rangesString) {
    return [];
  }

  return rangesString.split(',').map((part) => {
    const [start, end] = part
      .trim()
      .split('-')
      .filter((x) => x !== '')
      .map(Number);

    if (typeof start === 'undefined' || typeof end === 'undefined') {
      throw new Error('Invalid range');
    }

    return { start, end };
  });
}
