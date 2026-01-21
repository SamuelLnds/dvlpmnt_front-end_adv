import { apiFetch } from './client';

export type RoomsIndexItem = {
	id: string;
	name: string;
	private: boolean;
	clientCount: number;
};

type RoomMeta = {
	clients?: Record<string, unknown>;
	name?: string;
	private?: boolean;
};

type RoomsResponse = {
	success?: boolean;
	data?: Record<string, RoomMeta>;
};

export async function fetchRoomsIndex(): Promise<RoomsIndexItem[]> {
	const response = await apiFetch<RoomsResponse>('/rooms');

	if (!response.ok) {
		const error = new Error(`rooms: unexpected status ${response.status}`);
		console.warn('fetchRoomsIndex failed', error);
		throw error;
	}

	const payload = response.data?.data ?? {};

	console.log('JSON payload rooms:', payload);

	return Object.entries(payload).map(([key, meta]) => ({
		id: key,
		name: meta?.name ?? key,
		private: meta?.private ?? false,
		clientCount:
			meta && typeof meta === 'object' && meta.clients && typeof meta.clients === 'object'
				? Object.keys(meta.clients as Record<string, unknown>).length
				: 0
	}));
}
