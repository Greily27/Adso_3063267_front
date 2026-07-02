import { describe, expect, it } from 'vitest';
import { API_BASE_URL } from '../../core/config/api.config';
import { resolveApiImageUrl, resolveProfilePhotoUrl } from './profile-photo-url.util';

describe('resolveProfilePhotoUrl', () => {
  it('replaces a persisted localhost origin with the deployed API origin', () => {
    expect(resolveProfilePhotoUrl('http://localhost:3000/uploads/users/photo.jpg'))
      .toBe(`${API_BASE_URL}/uploads/users/photo.jpg`);
  });

  it('resolves persisted upload paths against the API', () => {
    expect(resolveProfilePhotoUrl('/uploads/users/photo.jpg'))
      .toBe(`${API_BASE_URL}/uploads/users/photo.jpg`);
    expect(resolveProfilePhotoUrl('users/photo.jpg'))
      .toBe(`${API_BASE_URL}/uploads/users/photo.jpg`);
  });

  it('extracts uploads from legacy absolute filesystem paths', () => {
    expect(resolveApiImageUrl('C:\\app\\uploads\\eventos\\evento.jpg'))
      .toBe(`${API_BASE_URL}/uploads/eventos/evento.jpg`);
    expect(resolveApiImageUrl('/opt/render/project/src/uploads/users/photo.jpg'))
      .toBe(`${API_BASE_URL}/uploads/users/photo.jpg`);
  });

  it('preserves remote and preview URLs', () => {
    expect(resolveProfilePhotoUrl('https://cdn.example.com/photo.jpg'))
      .toBe('https://cdn.example.com/photo.jpg');
    expect(resolveProfilePhotoUrl('data:image/png;base64,abc'))
      .toBe('data:image/png;base64,abc');
  });

  it('does not render the default profile image as a user photo', () => {
    expect(resolveProfilePhotoUrl('default.jpg')).toBe('');
  });
});
