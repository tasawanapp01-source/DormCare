/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CompressionResult {
  dataUrl: string;
  sizeBytes: number;
  sizeKb: number;
  originalSizeBytes: number;
}

export const MAX_IMAGES_PER_TICKET = 2;
export const MAX_IMAGE_SIZE_KB = 150; // Target max 150 KB per image
export const MAX_DOCUMENT_ESTIMATED_KB = 700; // Strict limit under Firestore 1 MiB doc limit

/**
 * Compresses an image file in browser using HTML5 Canvas
 * Resizes max dimensions to 1024x1024 and reduces quality to stay under 150 KB
 */
export async function compressImage(
  file: File,
  maxDimension = 1024,
  initialQuality = 0.72
): Promise<CompressionResult> {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (JPEG, PNG, WebP)');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('รูปภาพเสียหายหรือไม่รองรับ'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize down to fit maxDimension while preserving aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('ไม่สามารถประมวลผล Canvas บนเบราว์เซอร์นี้ได้'));
          return;
        }

        // Draw image onto canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Try compress to JPEG with quality adjustment
        let currentQuality = initialQuality;
        let mimeType = 'image/jpeg';
        let dataUrl = canvas.toDataURL(mimeType, currentQuality);
        let sizeBytes = Math.round((dataUrl.length * 3) / 4);

        // Iteratively lower quality or scale down if still > 150 KB
        let attempts = 0;
        while (sizeBytes > MAX_IMAGE_SIZE_KB * 1024 && attempts < 4) {
          currentQuality -= 0.15;
          if (currentQuality < 0.3) {
            // Further scale down canvas
            const scaleFactor = 0.8;
            canvas.width = Math.round(canvas.width * scaleFactor);
            canvas.height = Math.round(canvas.height * scaleFactor);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentQuality = 0.6;
          }
          dataUrl = canvas.toDataURL(mimeType, currentQuality);
          sizeBytes = Math.round((dataUrl.length * 3) / 4);
          attempts++;
        }

        const sizeKb = Math.round(sizeBytes / 1024);

        if (sizeKb > MAX_IMAGE_SIZE_KB + 20) {
          reject(
            new Error(
              `รูปภาพมีขนาดหลังบีบอัด ${sizeKb} KB ซึ่งเกินโควต้าที่กำหนด (${MAX_IMAGE_SIZE_KB} KB) กรุณาถ่ายใหม่หรือลดขนาดรูป`
            )
          );
          return;
        }

        resolve({
          dataUrl,
          sizeBytes,
          sizeKb,
          originalSizeBytes: file.size,
        });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Calculates estimated document size for safety checks
 */
export function estimateWorkOrderSizeKb(workOrderData: Record<string, unknown>): number {
  const jsonString = JSON.stringify(workOrderData);
  // 1 char roughly 1-2 bytes in UTF-8
  const estimatedBytes = new Blob([jsonString]).size;
  return Math.round(estimatedBytes / 1024);
}
