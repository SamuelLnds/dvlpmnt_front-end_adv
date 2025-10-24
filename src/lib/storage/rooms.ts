import { fetchRoomsIndex } from '$lib/api/rooms';

export type Room = { id: string; name: string; joined: boolean };

export const ROOMS_KEY = 'chat.rooms.v1';

const PRESET_ROOMS: Room[] = [
	{ id: 'general', name: 'General', joined: true },
	{ id: 'random', name: 'Random', joined: true },
	{ id: 'osef', name: 'Osef', joined: false }
];

const DEFAULT_JOINED_IDS = new Set(['general', 'random']);

function safeParse<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

function formatRoomName(source: string): string {
	const cleaned = source.replace(/[-_]+/g, ' ').trim();
	if (!cleaned) return source;
	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function mergeRemoteWithStored(remoteIds: string[], stored: Room[]): Room[] {
	const storedById = new Map(stored.map((room) => [room.id, room]));

	const remoteRooms = remoteIds.map((id) => {
		const storedRoom = storedById.get(id);
		const storedName = storedRoom?.name;
		const storedJoined = storedRoom?.joined;
		return {
			id,
			name: storedName && storedName.trim().length > 0 ? storedName : formatRoomName(id),
			joined: storedJoined ?? DEFAULT_JOINED_IDS.has(id)
		};
	});

	const remoteSet = new Set(remoteIds);
	const customRooms = stored.filter((room) => !remoteSet.has(room.id));

	return [...remoteRooms, ...customRooms];
}

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
