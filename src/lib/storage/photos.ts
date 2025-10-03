export const PHOTOS_STORAGE_KEY = 'camera.photos.v1';
export const MAX_ITEMS = 100;

export type PhotoItem = { dataUrl: string; ts: number };

// Lecture sécurisée depuis localStorage
export function readPhotos(): PhotoItem[] {
  try {
    const raw = localStorage.getItem(PHOTOS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.dataUrl === 'string' && typeof p.ts === 'number')
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
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

// Convertir un Blob en Data URL
export function dataURLFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Déclencher un téléchargement client depuis une Data URL
export function downloadPhoto(item: PhotoItem): void {
  const a = document.createElement('a');
  a.href = item.dataUrl;
  a.download = `photo-${item.ts}.jpg`;
  a.click();
}
