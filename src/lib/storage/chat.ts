import { safeParse } from '$lib/utils/validation';
import { readRooms, writeRooms, ROOMS_KEY, type Room } from '$lib/storage/rooms';

// Ré-exports pour compatibilité descendante
export { readRooms, writeRooms, ROOMS_KEY, type Room };

export const MSGS_KEY = 'chat.messages.v1';

export type Message = {
	id: string;
	roomId: string;
	author: 'me' | 'other';
	text?: string;
	attachmentTs?: number;
	createdAt: string;
};

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
