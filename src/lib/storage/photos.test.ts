import { describe, it, expect, vi } from 'vitest';
import {
	readPhotos,
	writePhotos,
	addPhotoFromDataURL,
	removePhotoByTs,
	downloadPhoto,
	PHOTOS_STORAGE_KEY,
	MAX_ITEMS
} from '$lib/storage/photos';

describe('readPhotos', () => {
	it('retourne un tableau vide si localStorage est vide', () => {
		expect(readPhotos()).toEqual([]);
	});

	it('lit correctement les photos stockées', () => {
		const photos = [
			{ dataUrl: 'data:image/png;base64,abc', ts: 1000 },
			{ dataUrl: 'data:image/jpeg;base64,xyz', ts: 2000 }
		];
		localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));

		expect(readPhotos()).toEqual(photos);
	});

	it('filtre les entrées invalides', () => {
		const mixed = [
			{ dataUrl: 'data:image/png;base64,valid', ts: 1000 },
			{ dataUrl: 123, ts: 2000 }, // dataUrl invalide
			{ dataUrl: 'data:image/png;base64,ok', ts: 'invalid' }, // ts invalide
			null
		];
		localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(mixed));

		const result = readPhotos();
		expect(result).toHaveLength(1);
		expect(result[0].ts).toBe(1000);
	});

	it('limite à MAX_ITEMS', () => {
		const manyPhotos = Array.from({ length: MAX_ITEMS + 10 }, (_, i) => ({
			dataUrl: `data:image/png;base64,${i}`,
			ts: i
		}));
		localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(manyPhotos));

		expect(readPhotos()).toHaveLength(MAX_ITEMS);
	});
});

describe('writePhotos', () => {
	it('écrit les photos dans localStorage', () => {
		const photos = [{ dataUrl: 'data:image/png;base64,test', ts: 1234 }];
		writePhotos(photos);

		expect(localStorage.setItem).toHaveBeenCalledWith(
			PHOTOS_STORAGE_KEY,
			JSON.stringify(photos)
		);
	});

	it('limite à MAX_ITEMS lors de l\'écriture', () => {
		const manyPhotos = Array.from({ length: MAX_ITEMS + 5 }, (_, i) => ({
			dataUrl: `data:image/png;base64,${i}`,
			ts: i
		}));
		writePhotos(manyPhotos);

		const written = JSON.parse(
			(localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls[0][1]
		);
		expect(written).toHaveLength(MAX_ITEMS);
	});

	it('gère les erreurs de localStorage silencieusement', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => writePhotos([{ dataUrl: 'data:image/png;base64,test', ts: 1234 }])).not.toThrow();
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('writePhotos'), expect.any(Error));

		consoleSpy.mockRestore();
	});
});

describe('addPhotoFromDataURL', () => {
	it('ajoute une photo en tête de liste', () => {
		const existing = [{ dataUrl: 'data:image/png;base64,old', ts: 1000 }];
		localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(existing));

		const newPhoto = addPhotoFromDataURL('data:image/png;base64,new');

		expect(newPhoto.dataUrl).toBe('data:image/png;base64,new');
		expect(newPhoto.ts).toBeGreaterThan(0);
	});
});

describe('removePhotoByTs', () => {
	it('supprime une photo par son timestamp', () => {
		const photos = [
			{ dataUrl: 'data:image/png;base64,a', ts: 1000 },
			{ dataUrl: 'data:image/png;base64,b', ts: 2000 }
		];
		localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));

		const result = removePhotoByTs(1000);

		expect(result).toHaveLength(1);
		expect(result[0].ts).toBe(2000);
	});

	it('retourne la liste inchangée si le ts n\'existe pas', () => {
		const photos = [{ dataUrl: 'data:image/png;base64,a', ts: 1000 }];
		localStorage.setItem(PHOTOS_STORAGE_KEY, JSON.stringify(photos));

		const result = removePhotoByTs(9999);

		expect(result).toHaveLength(1);
	});
});

describe('downloadPhoto', () => {
	it('déclenche le téléchargement via triggerDownload', () => {
		const mockAnchor = { href: '', download: '', click: vi.fn() };
		vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);

		const photo = { dataUrl: 'data:image/png;base64,test', ts: 12345 };
		downloadPhoto(photo);

		expect(mockAnchor.href).toBe('data:image/png;base64,test');
		expect(mockAnchor.download).toBe('photo-12345.jpg');
		expect(mockAnchor.click).toHaveBeenCalled();
	});
});
