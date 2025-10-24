const API_ORIGIN = 'https://api.tools.gavago.fr';
const API_BASE = `${API_ORIGIN}/socketio/api`;

type ImageGetResponse = {
	success?: boolean;
	data_image?: string | null;
};

type ImagePostResponse = {
	success?: boolean;
};

function isDataUrl(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith('data:image');
}

export async function fetchUserImage(id: string): Promise<string | null> {
	if (!id) return null;
	try {
		const res = await fetch(`${API_BASE}/images/${encodeURIComponent(id)}`, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		});

		if (!res.ok) {
			console.warn(`fetchUserImage: unexpected status ${res.status}`);
			return null;
		}

		const body = (await res.json()) as ImageGetResponse;
		return isDataUrl(body.data_image) ? body.data_image : null;
	} catch (error) {
		console.warn('fetchUserImage: request failed', error);
		return null;
	}
}

export async function uploadUserImage(id: string, imageData: string): Promise<boolean> {
	if (!id || !imageData) return false;
	try {
		const res = await fetch(`${API_BASE}/images/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: JSON.stringify({ id, image_data: imageData })
		});

		if (!res.ok) {
			console.warn(`uploadUserImage: unexpected status ${res.status}`);
			return false;
		}

		const body = (await res.json()) as ImagePostResponse;
		return Boolean(body.success);
	} catch (error) {
		console.warn('uploadUserImage: request failed', error);
		return false;
	}
}

export function getApiBase(): string {
	return API_BASE;
}
