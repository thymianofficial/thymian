// Fixture: the jiti dispatch branch reaching the same shared dependency. Declares an interface
// rather than annotating a literal, so the file is genuinely TypeScript without tripping
// `no-inferrable-types`.
import dep from './shared-dep.js';

interface SharedRule {
  name: string;
  dep: unknown;
}

const rule: SharedRule = { name: 'ts-rule', dep };

export default rule;
