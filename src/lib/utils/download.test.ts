import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerDownload, blobToDataURL, fileToDataURL, type DownloadableItem } from '$lib/utils/download';

describe('triggerDownload', () => {
	let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

	beforeEach(() => {
		mockAnchor = { href: '', download: '', click: vi.fn() };
		vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
	});

	it('crée un lien avec la data URL et déclenche le téléchargement', () => {
		const item: DownloadableItem = { dataUrl: 'data:image/png;base64,abc123', ts: 1234567890 };

		triggerDownload(item);

		expect(document.createElement).toHaveBeenCalledWith('a');
		expect(mockAnchor.href).toBe('data:image/png;base64,abc123');
		expect(mockAnchor.download).toBe('photo-1234567890.jpg');
		expect(mockAnchor.click).toHaveBeenCalled();
	});

	it('utilise le préfixe personnalisé pour le nom de fichier', () => {
		const item: DownloadableItem = { dataUrl: 'data:image/jpeg;base64,xyz', ts: 9999 };

		triggerDownload(item, 'capture');

		expect(mockAnchor.download).toBe('capture-9999.jpg');
	});
});

describe('blobToDataURL', () => {
	it('convertit un Blob en Data URL', async () => {
		const blob = new Blob(['test content'], { type: 'text/plain' });

		const result = await blobToDataURL(blob);

		expect(result).toMatch(/^data:text\/plain;base64,/);
	});

	it('convertit un Blob image en Data URL', async () => {
		// Crée un petit PNG 1x1 pixel transparent
		const pngData = new Uint8Array([
			0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
			0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
			0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
			0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
			0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
			0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
		]);
		const blob = new Blob([pngData], { type: 'image/png' });

		const result = await blobToDataURL(blob);

		expect(result).toMatch(/^data:image\/png;base64,/);
	});
});

describe('fileToDataURL', () => {
	it('convertit un File en Data URL (délègue à blobToDataURL)', async () => {
		const file = new File(['file content'], 'test.txt', { type: 'text/plain' });

		const result = await fileToDataURL(file);

		expect(result).toMatch(/^data:text\/plain;base64,/);
	});
});
