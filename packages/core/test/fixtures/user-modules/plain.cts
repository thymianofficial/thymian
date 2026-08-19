// Fixture: explicit CommonJS TypeScript extension.
interface Marker {
  readonly value: string;
}

const marker: Marker = { value: 'plain-cts' };

export default marker.value;
