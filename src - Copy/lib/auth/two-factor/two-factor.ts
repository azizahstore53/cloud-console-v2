import QRCode from 'qrcode';

// Using require for otplib to avoid ESM/CommonJS compatibility issues in Next.js
const { authenticator } = require('otplib');

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
      return authenticator.verify({ token, secret });
    } catch (err) {
      return false;
    }
  }

  /**
   * Generates random recovery codes for the user.
   */
  generateRecoveryCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }
}

export const twoFactorService = new TwoFactorService();
