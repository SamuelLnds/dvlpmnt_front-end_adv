import { getApiBase } from '$lib/api/images';

export type RoomsIndexItem = {
	id: string;
	clientCount: number;
};

type RoomsResponse = {
	success?: boolean;
	data?: Record<string, { clients?: Record<string, unknown> | unknown }>;
};

export async function fetchRoomsIndex(): Promise<RoomsIndexItem[]> {
	try {
		const res = await fetch(`${getApiBase()}/rooms`, {
			method: 'GET',
			headers: {
				Accept: 'application/json'
			}
		});

		if (!res.ok) {
			throw new Error(`rooms: unexpected status ${res.status}`);
		}

		const body = (await res.json()) as RoomsResponse;
		const payload = body?.data ?? {};

		// retourne la liste des salles avec le nombre de clients connectés
		return Object.entries(payload).map(([id, meta]) => ({
			id,
			clientCount:
				meta && typeof meta === 'object' && meta.clients && typeof meta.clients === 'object'
					? Object.keys(meta.clients as Record<string, unknown>).length
					: 0
		}));
	} catch (error) {
		console.warn('fetchRoomsIndex failed', error);
		throw error;
	}
}
