// A hand-constructed rule object declaring an empty type array — it would
// register but could never run in any mode.
export default {
  meta: {
    name: 'empty-type',
    severity: 'error',
    type: [],
    tags: [],
    options: {},
  },
};
