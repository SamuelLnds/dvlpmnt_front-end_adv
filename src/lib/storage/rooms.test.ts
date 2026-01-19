import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	readRooms,
	writeRooms,
	upsertRoom,
	ensureSeed,
	ROOMS_KEY
} from '$lib/storage/rooms';

vi.mock('$lib/api/rooms', () => ({
	fetchRoomsIndex: vi.fn()
}));

import { fetchRoomsIndex } from '$lib/api/rooms';

describe('readRooms (rooms.ts)', () => {
	it('retourne un tableau vide si localStorage est vide', () => {
		expect(readRooms()).toEqual([]);
	});

	it('lit correctement les rooms stockées', () => {
		const rooms = [
			{ id: 'general', name: 'General', joined: true },
			{ id: 'random', name: 'Random', joined: false }
		];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));

		const result = readRooms();
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('general');
	});

	it('filtre les entrées avec des types incorrects', () => {
		const invalid = [
			{ id: 'valid', name: 'Valid', joined: true },
			{ id: null, name: 'Null ID', joined: true },
			{ id: 'no-joined', name: 'Missing Joined' }
		];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(invalid));

		expect(readRooms()).toHaveLength(1);
	});
});

describe('upsertRoom', () => {
	it('ajoute une nouvelle room en tête de liste', () => {
		const existing = [{ id: 'existing', name: 'Existing', joined: false }];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(existing));

		const result = upsertRoom('new-room', 'New Room');

		expect(result[0].id).toBe('new-room');
		expect(result[0].name).toBe('New Room');
		expect(result[0].joined).toBe(true);
	});

	it('met à jour une room existante', () => {
		const existing = [{ id: 'my-room', name: 'Old Name', joined: false }];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(existing));

		const result = upsertRoom('my-room', 'New Name');

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('New Name');
		expect(result[0].joined).toBe(true);
	});

	it('utilise formatRoomName si aucun nom fourni', () => {
		localStorage.setItem(ROOMS_KEY, JSON.stringify([]));

		const result = upsertRoom('my-awesome-room');

		expect(result[0].name).toBe('My awesome room');
	});

	it('ignore les IDs vides', () => {
		const existing = [{ id: 'test', name: 'Test', joined: true }];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(existing));

		const result = upsertRoom('   ');

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('test');
	});
});

describe('writeRooms (rooms.ts)', () => {
	it('persiste les rooms dans localStorage', () => {
		const rooms = [{ id: 'test', name: 'Test', joined: true }];
		writeRooms(rooms);

		const stored = JSON.parse(localStorage.getItem(ROOMS_KEY) ?? '[]');
		expect(stored).toEqual(rooms);
	});

	it('gère les erreurs de localStorage silencieusement', () => {
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => writeRooms([{ id: 'test', name: 'Test', joined: false }])).not.toThrow();
	});
});

describe('ensureSeed', () => {
	beforeEach(() => {
		vi.mocked(fetchRoomsIndex).mockReset();
	});

	it('retourne les rooms distantes si disponibles', async () => {
		vi.mocked(fetchRoomsIndex).mockResolvedValue([
			{ id: 'remote-1', clientCount: 5 },
			{ id: 'remote-2', clientCount: 3 }
		]);

		const result = await ensureSeed();

		expect(result.some((r) => r.id === 'remote-1')).toBe(true);
		expect(result.some((r) => r.id === 'remote-2')).toBe(true);
	});

	it('retourne les rooms stockées si le fetch échoue', async () => {
		const stored = [{ id: 'stored', name: 'Stored', joined: true }];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(stored));
		vi.mocked(fetchRoomsIndex).mockRejectedValue(new Error('Network error'));

		const result = await ensureSeed();

		expect(result).toEqual(stored);
	});

	it('retourne les preset rooms si localStorage est vide et fetch échoue', async () => {
		vi.mocked(fetchRoomsIndex).mockRejectedValue(new Error('Network error'));

		const result = await ensureSeed();

		expect(result.some((r) => r.id === 'general')).toBe(true);
		expect(result.some((r) => r.id === 'random')).toBe(true);
	});

	it('merge correctement les rooms distantes avec les stockées', async () => {
		const stored = [
			{ id: 'general', name: 'Custom General', joined: true },
			{ id: 'local-only', name: 'Local', joined: true }
		];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(stored));

		vi.mocked(fetchRoomsIndex).mockResolvedValue([
			{ id: 'general', clientCount: 10 },
			{ id: 'new-remote', clientCount: 2 }
		]);

		const result = await ensureSeed();

		expect(result.some((r) => r.id === 'general')).toBe(true);
		expect(result.some((r) => r.id === 'new-remote')).toBe(true);
	});

	it('utilise les stored rooms si remote retourne vide après filtrage', async () => {
		const stored = [{ id: 'stored', name: 'Stored', joined: true }];
		localStorage.setItem(ROOMS_KEY, JSON.stringify(stored));
		vi.mocked(fetchRoomsIndex).mockResolvedValue([{ id: '', clientCount: 0 }, { id: '  ', clientCount: 0 }]);

		const result = await ensureSeed();

		expect(result).toEqual(stored);
	});

	it('utilise les preset rooms si stored est vide et remote retourne vide', async () => {
		vi.mocked(fetchRoomsIndex).mockResolvedValue([]);

		const result = await ensureSeed();

		expect(result.some((r) => r.id === 'general')).toBe(true);
	});
});
