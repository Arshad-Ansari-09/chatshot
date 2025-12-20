/**
 * Compress and resize images for efficient upload and display
 * Similar to WhatsApp's approach for optimized media sharing
 */

interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  outputType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.8,
  outputType: 'image/jpeg',
};

/**
 * Compress an image file using canvas
 */
export const compressImage = (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const { maxWidth, maxHeight, quality, outputType } = { ...DEFAULT_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    // Skip compression for non-image files
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    // Skip compression for GIFs to preserve animation
    if (file.type === 'image/gif') {
      resolve(file);
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth! || height > maxHeight!) {
        const ratio = Math.min(maxWidth! / width, maxHeight! / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Use high-quality image smoothing
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // If compressed size is larger than original, use original
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^/.]+$/, '.jpg'),
            { type: outputType, lastModified: Date.now() }
          );

          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Create a thumbnail for quick loading
 */
export const createThumbnail = (
  file: File,
  maxSize: number = 200
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'));
      return;
    }

    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;
      
      const ratio = Math.min(maxSize / width, maxSize / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);

      canvas.width = width;
      canvas.height = height;

      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);
      }

      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };

    img.onerror = () => {
      reject(new Error('Failed to create thumbnail'));
    };

    img.src = URL.createObjectURL(file);
  });
};

/**
 * Batch compress multiple files with progress tracking
 */
export const compressFiles = async (
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<File[]> => {
  const compressedFiles: File[] = [];
  const total = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    if (file.type.startsWith('image/')) {
      const compressed = await compressImage(file);
      compressedFiles.push(compressed);
    } else {
      compressedFiles.push(file);
    }

    onProgress?.(i + 1, total);
  }

  return compressedFiles;
};
