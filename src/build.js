// Build identity. The release workflow (.github/workflows/release.yml) overwrites
// these at build time. CHANNEL is 'prod' (default) or 'dev'; BUILD_ID is the
// commit SHA the build was produced from — used to detect a newer dev build.
export const CHANNEL = 'prod';
export const BUILD_ID = 'local';
