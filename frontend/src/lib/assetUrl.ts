import { API_URL } from '@/services/baseApi';

// Backend'in döndürdüğü "/uploads/avatars/x.png" gibi göreli yolları API sunucusunun origin'ine bağlar.
const API_ORIGIN = new URL(API_URL).origin;

export const assetUrl = (path?: string | null) => {
  if (!path) return '';
  // Tam adresler ve seçilen dosyanın yerel önizlemesi (blob:) olduğu gibi kullanılır.
  if (/^(https?:\/\/|blob:)/.test(path)) return path;
  return `${API_ORIGIN}${path}`;
};
