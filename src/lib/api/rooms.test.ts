import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRoomsIndex, type RoomsIndexItem } from '$lib/api/rooms';

describe('fetchRoomsIndex', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retourne une liste de rooms avec leur nombre de clients', async () => {
		const mockResponse = {
			success: true,
			data: {
				general: { clients: { client1: {}, client2: {} } },
				random: { clients: { client3: {} } }
			}
		};

		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		});

		const result = await fetchRoomsIndex();

		expect(result).toHaveLength(2);
		expect(result).toContainEqual({ id: 'general', clientCount: 2 });
		expect(result).toContainEqual({ id: 'random', clientCount: 1 });
	});

	it('retourne 0 clients si clients est absent ou invalide', async () => {
		const mockResponse = {
			data: {
				'no-clients': {},
				'null-clients': { clients: null },
				'string-clients': { clients: 'invalid' }
			}
		};

		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockResponse)
		});

		const result = await fetchRoomsIndex();

		expect(result.every((r) => r.clientCount === 0)).toBe(true);
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
