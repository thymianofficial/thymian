// Fixture: self-match removal must not swallow story 34.2's non-module guard. After this file is
// dropped the glob still holds `NOTES.md`, so the "matched but none loadable" throw still fires.
export default {
  name: 'self-with-nonmodule',
  pattern: './**/*',
};
