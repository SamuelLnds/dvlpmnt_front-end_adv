/**
 * Utilitaires de téléchargement côté client.
 * Séparés pour faciliter les tests et le mocking.
 */

export type DownloadableItem = {
	dataUrl: string;
	ts: number;
};

/**
 * Déclenche un téléchargement client depuis une Data URL.
 * Nécessite un environnement DOM (navigateur).
 */
export function triggerDownload(item: DownloadableItem, filenamePrefix = 'photo'): void {
	const a = document.createElement('a');
	a.href = item.dataUrl;
	a.download = `${filenamePrefix}-${item.ts}.jpg`;
	a.click();
}

/**
 * Convertit un Blob en Data URL via FileReader.
 */
export function blobToDataURL(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

/**
 * Convertit un File en Data URL via FileReader.
 */
export function fileToDataURL(file: File): Promise<string> {
	return blobToDataURL(file);
}
