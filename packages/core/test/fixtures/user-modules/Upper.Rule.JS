// Fixture: a genuine JavaScript module whose extension is UPPER-CASE on disk (#690). It resolves
// on a case-insensitive volume, and neither Node nor jiti can load it — `ERR_UNKNOWN_FILE_EXTENSION`
// either way — so the seam must refuse it and say WHY. The file name is literal, so the case holds
// on case-sensitive filesystems too.
const marker = 'upper-rule-js';

export default marker;
