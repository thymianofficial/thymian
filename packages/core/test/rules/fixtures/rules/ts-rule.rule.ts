// A minimal TypeScript rule fixture — loads via jiti, no build step (AC1).
// `informational` needs no execution function, so this fixture is valid on
// its own (unlike `empty-type`/`no-type`, which exist specifically to be
// invalid).
export default {
  meta: {
    name: 'ts-rule',
    severity: 'error' as const,
    type: ['informational'],
    tags: [],
    options: {},
  },
};
