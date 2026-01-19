import { describe, it, expect, vi } from 'vitest';
import {
	readRooms,
	writeRooms,
	readMessages,
	writeMessages,
	unsubscribeRoom,
	readMessagesByRoom,
	ROOMS_KEY,
	MSGS_KEY,
	type Room,
	type Message
} from '$lib/storage/chat';

describe('readRooms', () => {
	it('retourne un tableau vide si localStorage est vide', () => {
		expect(readRooms()).toEqual([]);
	});

	it('lit correctement les rooms stockées', () => {
		const rooms: Room[] = [
			{ id: 'general', name: 'General', joined: true },
			{ id: 'random', name: 'Random', joined: false }
		];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));

		expect(readRooms()).toEqual(rooms);
	});

	it('filtre les entrées invalides', () => {
		const mixed = [
			{ id: 'valid', name: 'Valid', joined: true },
			{ id: 123, name: 'Invalid ID', joined: true },
			{ id: 'missing-joined', name: 'Missing' },
			null
		];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(mixed));

		const result = readRooms();
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('valid');
	});
});

describe('writeRooms', () => {
	it('écrit les rooms dans localStorage', () => {
		const rooms: Room[] = [{ id: 'test', name: 'Test', joined: true }];
		writeRooms(rooms);

		expect(localStorage.getItem(ROOMS_KEY)).toBe(JSON.stringify(rooms));
	});

	it('gère les erreurs de localStorage silencieusement', () => {
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => writeRooms([{ id: 'test', name: 'Test', joined: true }])).not.toThrow();
	});
});

describe('readMessages', () => {
	it('retourne un tableau vide si localStorage est vide', () => {
		expect(readMessages()).toEqual([]);
	});

	it('lit correctement les messages stockés', () => {
		const messages: Message[] = [
			{ id: '1', roomId: 'general', author: 'me', text: 'Hello', createdAt: '2024-01-01' }
		];
		localStorage.setItem(MSGS_KEY, JSON.stringify(messages));

		expect(readMessages()).toEqual(messages);
	});

	it('filtre les messages avec champs manquants', () => {
		const mixed = [
			{ id: '1', roomId: 'general', author: 'me', createdAt: '2024-01-01' },
			{ roomId: 'general', createdAt: '2024-01-01' }, // id manquant
			{ id: '2', createdAt: '2024-01-01' } // roomId manquant
		];
		localStorage.setItem(MSGS_KEY, JSON.stringify(mixed));

		expect(readMessages()).toHaveLength(1);
	});
});

describe('writeMessages', () => {
	it('écrit les messages dans localStorage', () => {
		const messages: Message[] = [
			{ id: '1', roomId: 'general', author: 'me', createdAt: '2024-01-01' }
		];
		writeMessages(messages);

		expect(localStorage.getItem(MSGS_KEY)).toBe(JSON.stringify(messages));
	});

	it('gère les erreurs de localStorage silencieusement', () => {
		const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => writeMessages([{ id: '1', roomId: 'general', author: 'me', createdAt: '2024-01-01' }])).not.toThrow();
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('writeMessages'), expect.any(Error));

		consoleSpy.mockRestore();
	});
});

describe('unsubscribeRoom', () => {
	it('met joined à false pour la room ciblée', () => {
		const rooms: Room[] = [
			{ id: 'general', name: 'General', joined: true },
			{ id: 'random', name: 'Random', joined: true }
		];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));

		const result = unsubscribeRoom('general');

		expect(result.find((r) => r.id === 'general')?.joined).toBe(false);
		expect(result.find((r) => r.id === 'random')?.joined).toBe(true);
	});
});

describe('readMessagesByRoom', () => {
	it('filtre les messages par roomId', () => {
		const messages: Message[] = [
			{ id: '1', roomId: 'general', author: 'me', createdAt: '2024-01-01T10:00:00' },
			{ id: '2', roomId: 'random', author: 'other', createdAt: '2024-01-01T11:00:00' },
			{ id: '3', roomId: 'general', author: 'other', createdAt: '2024-01-01T12:00:00' }
		];
		localStorage.setItem(MSGS_KEY, JSON.stringify(messages));

		const result = readMessagesByRoom('general');

		expect(result).toHaveLength(2);
		expect(result.every((m) => m.roomId === 'general')).toBe(true);
	});

	it('trie les messages par date croissante', () => {
		const messages: Message[] = [
			{ id: '2', roomId: 'general', author: 'me', createdAt: '2024-01-01T12:00:00' },
			{ id: '1', roomId: 'general', author: 'me', createdAt: '2024-01-01T10:00:00' }
		];
		localStorage.setItem(MSGS_KEY, JSON.stringify(messages));

		const result = readMessagesByRoom('general');

		expect(result[0].id).toBe('1');
		expect(result[1].id).toBe('2');
	});
});
