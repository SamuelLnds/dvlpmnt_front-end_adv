import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRoomsIndex, type RoomsIndexItem } from '$lib/api/rooms';

describe('fetchRoomsIndex', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retourne une liste de rooms avec leur nombre de clients, nom et statut private', async () => {
		const mockResponse = {
			success: true,
			data: {
				general: { clients: { client1: {}, client2: {} }, name: 'General', private: false },
				private_room: { clients: { client3: {} }, name: 'Private Room', private: true }
			}
		};

		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		});

		const result = await fetchRoomsIndex();

		expect(result).toHaveLength(2);
		expect(result).toContainEqual({ id: 'general', name: 'General', private: false, clientCount: 2 });
		expect(result).toContainEqual({ id: 'private_room', name: 'Private Room', private: true, clientCount: 1 });
	});

	it('retourne 0 clients si clients est absent ou invalide', async () => {
		const mockResponse = {
			data: {
				'no-clients': { name: 'No Clients' },
				'null-clients': { clients: null, name: 'Null Clients' },
				'string-clients': { clients: 'invalid', name: 'String Clients' }
			}
		};

		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		});

		const result = await fetchRoomsIndex();

		expect(result.every((r) => r.clientCount === 0)).toBe(true);
	});

	it('utilise la clé comme nom si name est absent', async () => {
		const mockResponse = {
			data: {
				'my-room': { clients: {} }
			}
		};

		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		});

		const result = await fetchRoomsIndex();

		expect(result[0].name).toBe('my-room');
	});

	it('private est false par défaut si absent', async () => {
		const mockResponse = {
			data: {
				'public-room': { name: 'Public Room', clients: {} }
			}
		};

		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		});

		const result = await fetchRoomsIndex();

		expect(result[0].private).toBe(false);
	});

	it('retourne un tableau vide si data est absent', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: true })
		});

		const result = await fetchRoomsIndex();
		expect(result).toEqual([]);
	});

	it('lance une erreur si la réponse n\'est pas ok', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500
		});

		await expect(fetchRoomsIndex()).rejects.toThrow('rooms: unexpected status 500');
	});

	it('lance une erreur si fetch échoue', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

		// apiFetch encapsule l'erreur réseau en status 0
		await expect(fetchRoomsIndex()).rejects.toThrow('rooms: unexpected status 0');
	});

	it('appelle l\'endpoint correct', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ data: {} })
		});

		await fetchRoomsIndex();

		expect(fetch).toHaveBeenCalledWith(
			'https://api.tools.gavago.fr/socketio/api/rooms',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({ Accept: 'application/json' })
			})
		);
	});
});
