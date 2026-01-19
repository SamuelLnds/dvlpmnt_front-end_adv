import { safeParse } from '$lib/utils/validation';
import { triggerDownload, blobToDataURL } from '$lib/utils/download';

export const PHOTOS_STORAGE_KEY = 'camera.photos.v1';
export const MAX_ITEMS = 100;

export type PhotoItem = { dataUrl: string; ts: number };

export function readPhotos(): PhotoItem[] {
  const parsed = safeParse<unknown[]>(localStorage.getItem(PHOTOS_STORAGE_KEY), []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((p) => p && typeof (p as PhotoItem).dataUrl === 'string' && typeof (p as PhotoItem).ts === 'number')
    .slice(0, MAX_ITEMS) as PhotoItem[];
}

// Écriture sécurisée
export function writePhotos(items: PhotoItem[]): void {
  try {
    localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch (e) {
    // On journalise seulement ; l’UI peut afficher un message si besoin
    console.warn('writePhotos() failed:', e);
  }
}

// Ajouter une photo (Data URL) en tête et persister
export function addPhotoFromDataURL(dataUrl: string): PhotoItem {
  const item: PhotoItem = { dataUrl, ts: Date.now() };
  const next = [item, ...readPhotos()].slice(0, MAX_ITEMS);
  writePhotos(next);
  return item;
}

// Supprimer une photo par timestamp (ts) et persister ; retourne la liste à jour
export function removePhotoByTs(ts: number): PhotoItem[] {
  const next = readPhotos().filter((p) => p.ts !== ts);
  writePhotos(next);
  return next;
}

// Ré-exports pour compatibilité avec le code existant
export const dataURLFromBlob = blobToDataURL;
export const downloadPhoto = (item: PhotoItem) => triggerDownload(item, 'photo');
