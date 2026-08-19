// Fixture: explicit ESM TypeScript extension.
interface Marker {
  readonly value: string;
}

const marker: Marker = { value: 'plain-mts' };

export default marker.value;
