// Internal re-export of the AJV validate function for use within the rules module.
// This avoids importing from the subpath export '@thymian/core/ajv' within the same package.
export { validate } from '../ajv.js';
