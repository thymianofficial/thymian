// Fixture: a declaration file spelled with a capital `D`. A case-sensitive guard would miss this
// and hand an empty module to the caller; the file name is literal so the case holds on
// case-sensitive filesystems too.
declare const legacyMarker: string;

export default legacyMarker;
