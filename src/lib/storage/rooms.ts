export type Room = { id: string; name: string; joined: boolean };

export const ROOMS_KEY = 'chat.rooms.v1';

const PRESET_ROOMS: Room[] = [
	{ id: 'general', name: 'Général', joined: true },
	{ id: 'random', name: 'Aléatoire', joined: true },
	{ id: 'osef', name: 'Osef', joined: false }
];

function safeParse<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

export function readRooms(): Room[] {
	const rooms = safeParse<Room[]>(localStorage.getItem(ROOMS_KEY), []);
	return rooms.filter((r) => r && typeof r.id === 'string' && typeof r.name === 'string');
}

export function writeRooms(rooms: Room[]): void {
	try {
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
	} catch {}
}

export function ensureSeed(): Room[] {
	const cur = readRooms();
	if (cur.length === 0) {
		writeRooms(PRESET_ROOMS);
		return PRESET_ROOMS;
	}
	return cur;
}

export function upsertRoom(idRaw: string, nameRaw?: string): Room[] {
	const id = idRaw.trim();
	const name = (nameRaw ?? idRaw).trim();
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
