// Fixture: erasable-syntax-only TypeScript. Loads today by accident via Node's type stripping —
// kept under test so the accidental case becomes a specified one.
interface Marker {
  readonly value: string;
}

const marker: Marker = { value: 'ts-plugin' };

export default {
  name: marker.value,
  version: '1.0.0',
  plugin: async () => undefined,
};
