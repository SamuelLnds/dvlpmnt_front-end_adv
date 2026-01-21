import { fetchRoomsIndex } from '$lib/api/rooms';
import { safeParse } from '$lib/utils/validation';
import { formatRoomName } from '$lib/utils/format';
import { mergeRemoteWithStored, type Room } from '$lib/utils/merge';

// Ré-export du type pour compatibilité
export type { Room };

export const ROOMS_KEY = 'chat.rooms.v1';

const PRESET_ROOMS: Room[] = [
	{ id: 'general', name: 'General', joined: true, private: false, clientCount: 0 },
	{ id: 'random', name: 'Random', joined: true, private: false, clientCount: 0 },
	{ id: 'osef', name: 'Osef', joined: false, private: false, clientCount: 0 }
];

const DEFAULT_JOINED_IDS = new Set(['general', 'random']);

export function readRooms(): Room[] {
	const rooms = safeParse<Room[]>(localStorage.getItem(ROOMS_KEY), []);
	return rooms
		.filter(
			(room) =>
				room &&
				typeof room.id === 'string' &&
				typeof room.name === 'string' &&
				typeof room.joined === 'boolean'
		)
		.map((room) => ({
			...room,
			private: room.private ?? false,
			clientCount: room.clientCount ?? 0
		}));
}

export function writeRooms(rooms: Room[]): void {
	try {
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
	} catch {}
}

async function fetchRemoteRooms(stored: Room[]): Promise<Room[]> {
	const index = await fetchRoomsIndex();
	const remoteRooms = index
		.filter((entry) => typeof entry.id === 'string' && entry.id.trim())
		.map((entry) => ({
			id: entry.id,
			name: entry.name,
			private: entry.private,
			clientCount: entry.clientCount
		}));
	const merged = mergeRemoteWithStored(remoteRooms, stored);
	if (merged.length > 0) {
		writeRooms(merged);
	}
	return merged;
}

export async function ensureSeed(): Promise<Room[]> {
	const stored = readRooms();
	try {
		const remote = await fetchRemoteRooms(stored);
		if (remote.length > 0) {
			return remote;
		}
	} catch (error) {
		console.warn('ensureSeed: remote fetch failed', error);
	}

	if (stored.length > 0) {
		return stored;
	}

	writeRooms(PRESET_ROOMS);
	return PRESET_ROOMS;
}

export function upsertRoom(idRaw: string, nameRaw?: string, isPrivate = false): Room[] {
	const id = idRaw.trim();
	const nameCandidate = (nameRaw ?? '').trim();
	const name = nameCandidate.length > 0 ? nameCandidate : formatRoomName(id);
	if (!id) return readRooms();
	const cur = readRooms();
	const idx = cur.findIndex((r) => r.id === id);
	const next =
		idx === -1
			? [{ id, name, joined: true, private: isPrivate, clientCount: 0 }, ...cur]
			: cur.map((r) => (r.id === id ? { ...r, name, joined: true } : r));
	writeRooms(next);
	return next;
}
