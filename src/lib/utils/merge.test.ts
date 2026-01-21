import { describe, it, expect } from 'vitest';
import { mergeRemoteWithStored, type Room, type RemoteRoom } from '$lib/utils/merge';

describe('mergeRemoteWithStored', () => {
	const stored: Room[] = [
		{ id: 'general', name: 'Général personnalisé', joined: false, private: false, clientCount: 0 },
		{ id: 'custom', name: 'Ma room', joined: true, private: false, clientCount: 0 }
	];

	const createRemote = (id: string, opts: Partial<RemoteRoom> = {}): RemoteRoom => ({
		id,
		name: opts.name ?? id,
		private: opts.private ?? false,
		clientCount: opts.clientCount ?? 0
	});

	it('préserve le nom personnalisé et le statut joined des rooms stockées', () => {
		const remoteRooms: RemoteRoom[] = [
			createRemote('general', { name: 'General', clientCount: 5 }),
			createRemote('random', { name: 'Random', clientCount: 2 })
		];
		const result = mergeRemoteWithStored(remoteRooms, stored);
		const general = result.find((r) => r.id === 'general');

		expect(general?.name).toBe('Général personnalisé');
		expect(general?.joined).toBe(false);
		expect(general?.private).toBe(false);
		expect(general?.clientCount).toBe(5);
	});

	it('ajoute les nouvelles rooms distantes avec le formatage par défaut', () => {
		const remoteRooms: RemoteRoom[] = [createRemote('new-room', { name: '', clientCount: 3 })];
		const result = mergeRemoteWithStored(remoteRooms, []);
		const newRoom = result.find((r) => r.id === 'new-room');

		expect(newRoom?.name).toBe('New room');
		// 'new-room' n'est pas dans DEFAULT_JOINED_IDS donc joined = false
		expect(newRoom?.joined).toBe(false);
		expect(newRoom?.clientCount).toBe(3);
	});

	it('marque general et random comme joined par défaut', () => {
		const remoteRooms: RemoteRoom[] = [
			createRemote('general', { name: 'General' }),
			createRemote('random', { name: 'Random' }),
			createRemote('other', { name: 'Other' })
		];
		const result = mergeRemoteWithStored(remoteRooms, []);

		expect(result.find((r) => r.id === 'general')?.joined).toBe(true);
		expect(result.find((r) => r.id === 'random')?.joined).toBe(true);
		expect(result.find((r) => r.id === 'other')?.joined).toBe(false);
	});

	it('conserve les rooms custom non présentes dans le remote', () => {
		const remoteRooms: RemoteRoom[] = [createRemote('general', { name: 'General' })];
		const result = mergeRemoteWithStored(remoteRooms, stored);
		const custom = result.find((r) => r.id === 'custom');

		expect(custom).toBeDefined();
		expect(custom?.name).toBe('Ma room');
		expect(custom?.joined).toBe(true);
	});

	it('retourne un tableau vide si aucune room', () => {
		expect(mergeRemoteWithStored([], [])).toEqual([]);
	});

	it('préserve le statut private depuis les données distantes', () => {
		const remoteRooms: RemoteRoom[] = [
			createRemote('private-room', { name: 'Private Room', private: true, clientCount: 1 })
		];
		const result = mergeRemoteWithStored(remoteRooms, []);
		const privateRoom = result.find((r) => r.id === 'private-room');

		expect(privateRoom?.private).toBe(true);
	});

	it('utilise le nom distant si le nom stocké est vide', () => {
		const storedWithEmptyName: Room[] = [
			{ id: 'test', name: '', joined: true, private: false, clientCount: 0 }
		];
		const remoteRooms: RemoteRoom[] = [
			createRemote('test', { name: 'Remote Name', clientCount: 5 })
		];
		const result = mergeRemoteWithStored(remoteRooms, storedWithEmptyName);

		expect(result.find((r) => r.id === 'test')?.name).toBe('Remote Name');
	});
});
