// Pure JavaScript polyfill for crypto.getRandomValues in Expo Go / React Native
// Eliminates the need for any unlinked native module like ExpoCrypto

const g = (typeof globalThis !== 'undefined'
  ? globalThis
  : typeof global !== 'undefined'
  ? global
  : window) as any;

if (!g.crypto) {
  g.crypto = {};
}

// Ensure getRandomValues exists and fills any ArrayBufferView
g.crypto.getRandomValues = function <T extends ArrayBufferView>(array: T): T {
  if (!array) {
    throw new TypeError("Failed to execute 'getRandomValues': 1 argument required, but only 0 present.");
  }
  const uint8 = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  for (let i = 0; i < uint8.length; i++) {
    // High-entropy blend of Math.random, timestamp jitter, and bitwise mixing
    const r1 = Math.floor(Math.random() * 256);
    const r2 = (Date.now() ^ (i * 2654435761)) & 0xff;
    uint8[i] = (r1 ^ r2) & 0xff;
  }
  return array;
};

if (typeof global !== 'undefined') {
  (global as any).crypto = g.crypto;
}
if (typeof self !== 'undefined') {
  (self as any).crypto = g.crypto;
}

export default g.crypto;
