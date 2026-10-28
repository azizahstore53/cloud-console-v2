import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16; // For AES, this is always 16 bytes

/**
 * Encryption Utility for sensitive data (like SSH Private Keys).
 *
 * We use AES-256-CBC. The encrypted string is stored as:
 * iv_hex:encrypted_data_hex
 */
export class EncryptionService {
  private static get key() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
      throw new Error("ENCRYPTION_KEY is not defined in environment variables.");
    }
    // Ensure the key is exactly 32 bytes for aes-256
    return crypto.createHash("sha256").update(secret).digest();
  }

  static encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    return `${iv.toString("hex")}:${encrypted}`;
  }

  static decrypt(encryptedText: string): string {
    const [ivHex, dataHex] = encryptedText.split(":");
    if (!ivHex || !dataHex) {
      throw new Error("Invalid encrypted text format. Expected 'iv:data'");
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);

    let decrypted = decipher.update(dataHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }
}
