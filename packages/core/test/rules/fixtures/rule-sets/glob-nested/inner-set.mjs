// A rule set matched by another rule set's glob (glob-nested/outer.mjs) —
// nesting must be rejected before this is ever loaded as rules.
export default {
  name: 'glob-nested-inner',
  rules: [
    {
      meta: {
        name: 'glob-nested-inner-rule',
        severity: 'error',
        type: ['informational'],
        tags: [],
        options: {},
      },
    },
  ],
};
