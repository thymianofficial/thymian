// Fixture: non-erasable syntax. An `enum` emits a runtime object, so type stripping can never
// support this file — it is the case that requires a real transform (jiti).
enum Flavour {
  Thyme = 'thyme',
}

export default {
  name: `enum-plugin-${Flavour.Thyme}`,
  version: '1.0.0',
  plugin: async () => undefined,
};
