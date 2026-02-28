import crypto from "crypto";

/**
 * Encryption service for sensitive license data
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = "aes-256-gcm";
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Get the encryption key from environment or derive from secret
 */
function getEncryptionKey(): Buffer {
  const encryptionSecret = process.env.LICENSE_ENCRYPTION_KEY;
  
  if (!encryptionSecret) {
    // Fallback: derive key from a master secret
    // In production, always set LICENSE_ENCRYPTION_KEY
    const masterSecret = process.env.APP_SECRET || "default-insecure-secret-change-in-production";
    return crypto.scryptSync(masterSecret, "license-salt", 32);
  }

  // If the key is less than 32 bytes, derive it
  if (encryptionSecret.length < 32) {
    return crypto.scryptSync(encryptionSecret, "salt", 32);
  }

  // Otherwise, take the first 32 bytes
  return Buffer.from(encryptionSecret.slice(0, 32), "utf-8");
}

/**
 * Encrypt a string value
 */
export function encryptField(plaintext: string | null): string | null {
  if (!plaintext) {
    return null;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf-8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data
    // Format: IV(hex) + AUTHTAG(hex) + ENCRYPTED(hex)
    return iv.toString("hex") + authTag.toString("hex") + encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}

/**
 * Decrypt a string value
 */
export function decryptField(encrypted: string | null): string | null {
  if (!encrypted) {
    return null;
  }

  try {
    const key = getEncryptionKey();

    // Extract IV (24 hex chars = 12 bytes), authTag (32 hex chars = 16 bytes), and encrypted data
    const iv = Buffer.from(encrypted.slice(0, IV_LENGTH * 2), "hex");
    const authTag = Buffer.from(
      encrypted.slice(IV_LENGTH * 2, IV_LENGTH * 2 + TAG_LENGTH * 2),
      "hex"
    );
    const encryptedData = encrypted.slice(IV_LENGTH * 2 + TAG_LENGTH * 2);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf-8");
    decrypted += decipher.final("utf-8");

    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
}

/**
 * Create a masked version of encrypted text for display
 * Shows first 8 chars, then ****, then last 4 chars
 */
export function maskField(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.length <= 12) {
    return "****";
  }

  const start = value.substring(0, 8);
  const end = value.substring(value.length - 4);
  return `${start}****${end}`;
}
