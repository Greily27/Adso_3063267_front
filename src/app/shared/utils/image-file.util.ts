export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export function fileToCompressedImageDataUrl(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const maxWidth = options.maxWidth ?? 512;
  const maxHeight = options.maxHeight ?? 512;
  const quality = options.quality ?? 0.72;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selecciona un archivo de imagen válido.'));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const ratio = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        reject(new Error('No se pudo procesar la imagen.'));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen seleccionada.'));
    };

    image.src = objectUrl;
  });
}
