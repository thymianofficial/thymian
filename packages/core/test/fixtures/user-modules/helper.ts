// Fixture: imported by `split.ts` as `./helper.js`.
interface Marker {
  readonly value: string;
}

const marker: Marker = { value: 'split-ts-via-helper' };

export const helperMarker = marker.value;
