// MODULE 10.3 — QR Code Service

import QRCode from 'qrcode';

/**
 * Generates a QR code PNG data URL for the given form.
 * The encoded URL will be: `${baseUrl}/f/${formId}`
 */
export async function generateQrCode(formId: string, baseUrl: string): Promise<string> {
  const url = `${baseUrl}/f/${formId}`;
  return QRCode.toDataURL(url);
}
