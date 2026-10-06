import QRCode from 'qrcode';
import crypto from 'crypto';
import { authenticator } from 'otplib';

/**
 * TwoFactorService
 * ---------------------------------------------------------------------------
 * Handles TOTP (Time-based One-Time Password) generation and verification.
 */
export class TwoFactorService {
  /**
   * Generates a new TOTP secret for a user.
   */
  async generateSecret(userEmail: string): Promise<{ secret: string; otpauthUrl: string }> {
    const secret = authenticator.generateSecret();
    const serviceName = 'Cloud Console';

    const otpauthUrl = authenticator.keyuri(userEmail, serviceName, secret);

    return { secret, otpauthUrl };
  }

  /**
   * Generates a QR code data URL from the otpauth URL.
   */
  async generateQrCode(otpauthUrl: string): Promise<string> {
    return await QRCode.toDataURL(otpauthUrl);
  }

  /**
   * Verifies a provided 6-digit token against a secret.
   */
  verifyToken(token: string, secret: string): boolean {
    try {
      // window: 1 gives +/- 30s tolerance for clock drift between the
      // server and the phone running the authenticator app.
      authenticator.options = { window: 1 };
      const cleanedToken = token.trim().replace(/\s+/g, '');
      return authenticator.verify({ token: cleanedToken, secret });
    } catch (err) {
      return false;
    }
  }

  /**
   * Generates single-use backup codes for when the authenticator device is
   * lost. Uses crypto.randomBytes — NOT Math.random(), which is not
   * cryptographically secure and is the wrong source of randomness for
   * anything that functions as a login credential.
   */
  generateRecoveryCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5, 10)}`);
    }
    return codes;
  }

  /** SHA-256 of a normalized code — what actually gets stored, never the code itself. */
  hashRecoveryCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
  }

  hashRecoveryCodes(codes: string[]): string {
    return codes.map((c) => this.hashRecoveryCode(c)).join(',');
  }

  /**
   * Checks `input` against the stored, comma-separated list of HASHED
   * recovery codes. On success, returns the list with that code removed —
   * the caller must persist `remaining` so the same code can't be replayed.
   */
  verifyAndConsumeRecoveryCode(
    input: string,
    storedHashes: string | null
  ): { valid: boolean; remaining: string; codesLeft: number } {
    const hashes = (storedHashes ?? '').split(',').map((h) => h.trim()).filter(Boolean);
    const hash = this.hashRecoveryCode(input);
    const idx = hashes.indexOf(hash);

    if (idx === -1) return { valid: false, remaining: storedHashes ?? '', codesLeft: hashes.length };

    hashes.splice(idx, 1);
    return { valid: true, remaining: hashes.join(','), codesLeft: hashes.length };
  }
}

export const twoFactorService = new TwoFactorService();
