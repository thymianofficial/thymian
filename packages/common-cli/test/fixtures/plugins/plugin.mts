// Fixture: explicit ESM TypeScript extension.
interface Marker {
  readonly value: string;
}

const marker: Marker = { value: 'plugin-mts' };

export default {
  name: marker.value,
  version: '1.0.0',
  plugin: async () => undefined,
};
