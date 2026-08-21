// Fixture: default export missing `version` — drives the "does not default export a valid
// Thymian plugin" CLIError (AC6/AC7).
export default {
  name: 'not-a-plugin',
  plugin: async () => undefined,
};
