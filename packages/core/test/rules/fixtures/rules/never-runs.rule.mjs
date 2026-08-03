// A hand-constructed rule object that bypasses the httpRule builder: it
// declares an executable type but has no execution function.
export default {
  meta: {
    name: 'never-runs',
    severity: 'error',
    type: ['static'],
    tags: [],
    options: {},
  },
};
