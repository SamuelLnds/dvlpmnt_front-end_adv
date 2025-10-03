export const ROOMS_KEY = 'chat.rooms.v1';
export const MSGS_KEY = 'chat.messages.v1';

export type Room = {
	id: string;
	name: string;
	joined: boolean;
};

export type Message = {
	id: string;
	roomId: string;
	author: 'me' | 'other';
	text?: string;
	attachmentTs?: number;
	createdAt: string;
};

// Helpers lecture/écriture génériques
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
	// garde-fous
	return rooms.filter(
		(r) =>
			r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.joined === 'boolean'
	);
}

export function writeRooms(rooms: Room[]): void {
	try {
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
	} catch (e) {
		console.warn('writeRooms() failed:', e);
	}
}

export function readMessages(): Message[] {
	const msgs = safeParse<Message[]>(localStorage.getItem(MSGS_KEY), []);
	return msgs.filter(
		(m) =>
			m &&
			typeof m.id === 'string' &&
			typeof m.roomId === 'string' &&
			typeof m.createdAt === 'string'
	);
}

export function writeMessages(msgs: Message[]): void {
	try {
		localStorage.setItem(MSGS_KEY, JSON.stringify(msgs));
	} catch (e) {
		console.warn('writeMessages() failed:', e);
	}
}

// Se désinscrire d’une room
export function unsubscribeRoom(roomId: string): Room[] {
	const rooms = readRooms().map((r) => (r.id === roomId ? { ...r, joined: false } : r));
	writeRooms(rooms);
	return rooms;
}

// Messages d’une room
export function readMessagesByRoom(roomId: string): Message[] {
	return readMessages()
		.filter((m) => m.roomId === roomId)
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
