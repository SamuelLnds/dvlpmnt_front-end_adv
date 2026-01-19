import { fetchRoomsIndex } from '$lib/api/rooms';
import { safeParse } from '$lib/utils/validation';
import { formatRoomName } from '$lib/utils/format';
import { mergeRemoteWithStored, type Room } from '$lib/utils/merge';

// Ré-export du type pour compatibilité
export type { Room };

export const ROOMS_KEY = 'chat.rooms.v1';

const PRESET_ROOMS: Room[] = [
	{ id: 'general', name: 'General', joined: true },
	{ id: 'random', name: 'Random', joined: true },
	{ id: 'osef', name: 'Osef', joined: false }
];

const DEFAULT_JOINED_IDS = new Set(['general', 'random']);

export function readRooms(): Room[] {
	const rooms = safeParse<Room[]>(localStorage.getItem(ROOMS_KEY), []);
	return rooms.filter(
		(room) =>
			room &&
			typeof room.id === 'string' &&
			typeof room.name === 'string' &&
			typeof room.joined === 'boolean'
	);
}

export function writeRooms(rooms: Room[]): void {
	try {
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
	} catch {}
}

async function fetchRemoteRooms(stored: Room[]): Promise<Room[]> {
	const index = await fetchRoomsIndex();
	const remoteIds = index.map((entry) => entry.id).filter((id) => typeof id === 'string' && id.trim());
	const merged = mergeRemoteWithStored(remoteIds, stored);
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

export function upsertRoom(idRaw: string, nameRaw?: string): Room[] {
	const id = idRaw.trim();
	const nameCandidate = (nameRaw ?? '').trim();
	const name = nameCandidate.length > 0 ? nameCandidate : formatRoomName(id);
	if (!id) return readRooms();
	const cur = readRooms();
	const idx = cur.findIndex((r) => r.id === id);
	const next =
		idx === -1
			? [{ id, name, joined: true }, ...cur]
			: cur.map((r) => (r.id === id ? { ...r, name, joined: true } : r));
	writeRooms(next);
	return next;
}
