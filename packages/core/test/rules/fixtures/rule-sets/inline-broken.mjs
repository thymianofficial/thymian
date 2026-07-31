// A rule set with an inline rules array containing a rule that declares an
// executable type but has no execution function.
export default {
  name: 'inline-broken',
  rules: [
    {
      meta: {
        name: 'inline-never-runs',
        severity: 'error',
        type: ['test'],
        tags: [],
        options: {},
      },
    },
  ],
};
