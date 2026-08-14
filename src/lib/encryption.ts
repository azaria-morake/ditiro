import CryptoJS from 'crypto-js';

const SALT = "DITIRO_ENCRYPTION_SALT_2026_SECURE";

/**
 * Encrypts a JSON serializable object using AES key derived from the user UID.
 */
export const encryptData = (data: any, uid: string): string => {
  const secretKey = CryptoJS.SHA256(uid + SALT).toString();
  return CryptoJS.AES.encrypt(JSON.stringify(data), secretKey).toString();
};

/**
 * Decrypts an encrypted payload back into an object using AES key derived from the user UID.
 */
export const decryptData = (encryptedText: string, uid: string): any => {
  try {
    const secretKey = CryptoJS.SHA256(uid + SALT).toString();
    const bytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) return null;
    return JSON.parse(decryptedString);
  } catch (err) {
    console.error("[decryptData] Decryption failed:", err);
    return null;
  }
};
