// Fixture: a multi-file module. The `./helper.js` specifier is the NodeNext convention — it
// names the *emitted* file, while only `helper.ts` exists on disk.
import { helperMarker } from './helper.js';

export default helperMarker;
