import { describe, it, expect } from 'vitest';
import { mergeRemoteWithStored, type Room } from '$lib/utils/merge';

describe('mergeRemoteWithStored', () => {
	const stored: Room[] = [
		{ id: 'general', name: 'Général personnalisé', joined: false },
		{ id: 'custom', name: 'Ma room', joined: true }
	];

	it('préserve le nom personnalisé et le statut joined des rooms stockées', () => {
		const result = mergeRemoteWithStored(['general', 'random'], stored);
		const general = result.find((r) => r.id === 'general');

		expect(general?.name).toBe('Général personnalisé');
		expect(general?.joined).toBe(false);
	});

	it('ajoute les nouvelles rooms distantes avec le formatage par défaut', () => {
		const result = mergeRemoteWithStored(['new-room'], []);
		const newRoom = result.find((r) => r.id === 'new-room');

		expect(newRoom?.name).toBe('New room');
		// 'new-room' n'est pas dans DEFAULT_JOINED_IDS donc joined = false
		expect(newRoom?.joined).toBe(false);
	});

	it('marque general et random comme joined par défaut', () => {
		const result = mergeRemoteWithStored(['general', 'random', 'other'], []);

		expect(result.find((r) => r.id === 'general')?.joined).toBe(true);
		expect(result.find((r) => r.id === 'random')?.joined).toBe(true);
		expect(result.find((r) => r.id === 'other')?.joined).toBe(false);
	});

	it('conserve les rooms custom non présentes dans le remote', () => {
		const result = mergeRemoteWithStored(['general'], stored);
		const custom = result.find((r) => r.id === 'custom');

		expect(custom).toBeDefined();
		expect(custom?.name).toBe('Ma room');
		expect(custom?.joined).toBe(true);
	});

	it('retourne un tableau vide si aucune room', () => {
		expect(mergeRemoteWithStored([], [])).toEqual([]);
	});
});
