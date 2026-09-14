// Genuinely invalid JavaScript (unterminated object literal) — must throw a
// real SyntaxError at import time, not merely be an unusual-but-valid file.
export default {
  meta: {
