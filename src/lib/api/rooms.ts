import { apiFetch } from './client';

export type RoomsIndexItem = {
	id: string;
	clientCount: number;
};

type RoomsResponse = {
	success?: boolean;
	data?: Record<string, { clients?: Record<string, unknown> | unknown }>;
};

export async function fetchRoomsIndex(): Promise<RoomsIndexItem[]> {
	const response = await apiFetch<RoomsResponse>('/rooms');

	if (!response.ok) {
		const error = new Error(`rooms: unexpected status ${response.status}`);
		console.warn('fetchRoomsIndex failed', error);
		throw error;
	}

	const payload = response.data?.data ?? {};

	return Object.entries(payload).map(([id, meta]) => ({
		id,
		clientCount:
			meta && typeof meta === 'object' && meta.clients && typeof meta.clients === 'object'
				? Object.keys(meta.clients as Record<string, unknown>).length
				: 0
	}));
}
