import { apiFetch } from './client';
import { isDataUrl } from '$lib/utils/validation';

type ImageGetResponse = {
	success?: boolean;
	data_image?: string | null;
};

type ImagePostResponse = {
	success?: boolean;
};

export async function fetchUserImage(id: string): Promise<string | null> {
	if (!id) return null;

	const response = await apiFetch<ImageGetResponse>(`/images/${encodeURIComponent(id)}`);

	if (!response.ok) {
		console.warn(`fetchUserImage: unexpected status ${response.status}`);
		return null;
	}

	return isDataUrl(response.data?.data_image) ? response.data!.data_image! : null;
}

export async function uploadUserImage(id: string, imageData: string): Promise<boolean> {
	if (!id || !imageData) return false;

	const response = await apiFetch<ImagePostResponse>('/images/', {
		method: 'POST',
		body: { id, image_data: imageData }
	});

	if (!response.ok) {
		console.warn(`uploadUserImage: unexpected status ${response.status}`);
		return false;
	}

	return Boolean(response.data?.success);
}
