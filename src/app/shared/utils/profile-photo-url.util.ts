import { API_BASE_URL } from '../../core/config/api.config';

const LOCAL_API_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

export function resolveProfilePhotoUrl(photo?: string | null): string {
  const resolvedUrl = resolveApiImageUrl(photo);
  const normalizedPhoto = photo?.trim().toLowerCase();

  if (normalizedPhoto === 'default.jpg' || normalizedPhoto?.includes('colplinista')) {
    return '';
  }

  return resolvedUrl;
}

export function resolveApiImageUrl(image?: string | null): string {
  const cleanPhoto = image?.trim();

  if (!cleanPhoto) return '';

  if (isRawBase64Image(cleanPhoto)) {
    return `data:image/${getBase64ImageType(cleanPhoto)};base64,${cleanPhoto}`;
  }

  if (cleanPhoto.startsWith('data:image/') || cleanPhoto.startsWith('blob:')) {
    return cleanPhoto;
  }

  if (/^https?:\/\//i.test(cleanPhoto)) {
    try {
      const parsedUrl = new URL(cleanPhoto);

      if (LOCAL_API_HOSTS.has(parsedUrl.hostname)) {
        return `${API_BASE_URL}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
      }
    } catch {
      return '';
    }

    return cleanPhoto;
  }

  const normalizedPath = cleanPhoto
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
    .replace(/^\/+/, '');

  const uploadsIndex = normalizedPath.toLowerCase().lastIndexOf('uploads/');
  const relativePhotoPath = uploadsIndex >= 0
    ? normalizedPath.slice(uploadsIndex)
    : normalizedPath;
  const staticPhotoPath = relativePhotoPath.startsWith('uploads/')
    ? relativePhotoPath
    : `uploads/${relativePhotoPath}`;

  return `${API_BASE_URL}/${staticPhotoPath}`;
}

function isRawBase64Image(value: string) {
  return /^(\/9j\/|iVBORw0KGgo|R0lGODlh|UklGR)/.test(value);
}

function getBase64ImageType(value: string) {
  if (value.startsWith('iVBORw0KGgo')) return 'png';
  if (value.startsWith('R0lGODlh')) return 'gif';
  if (value.startsWith('UklGR')) return 'webp';

  return 'jpeg';
}
