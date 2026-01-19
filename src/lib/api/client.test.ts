import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { API_ORIGIN, API_BASE, apiFetch } from '$lib/api/client';

describe('API Constants', () => {
	it('API_ORIGIN est défini correctement', () => {
		expect(API_ORIGIN).toBe('https://api.tools.gavago.fr');
	});

	it('API_BASE est défini correctement', () => {
		expect(API_BASE).toBe('https://api.tools.gavago.fr/socketio/api');
	});
});

describe('apiFetch', () => {
	const originalFetch = globalThis.fetch;

	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.stubGlobal('fetch', originalFetch);
	});

	it('effectue une requête GET par défaut', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({ data: 'test' })
		} as Response);

		const result = await apiFetch<{ data: string }>('/test');

		expect(fetch).toHaveBeenCalledWith(
			`${API_BASE}/test`,
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					Accept: 'application/json'
				})
			})
		);
		expect(result.ok).toBe(true);
		expect(result.status).toBe(200);
		expect(result.data).toEqual({ data: 'test' });
	});

	it('effectue une requête POST avec body JSON', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 201,
			json: () => Promise.resolve({ success: true })
		} as Response);

		const result = await apiFetch<{ success: boolean }>('/test', {
			method: 'POST',
			body: { key: 'value' }
		});

		expect(fetch).toHaveBeenCalledWith(
			`${API_BASE}/test`,
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'Content-Type': 'application/json'
				}),
				body: JSON.stringify({ key: 'value' })
			})
		);
		expect(result.ok).toBe(true);
		expect(result.data).toEqual({ success: true });
	});

	it('gère les erreurs HTTP', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: () => Promise.resolve({ error: 'Not found' })
		} as Response);

		const result = await apiFetch('/not-found');

		expect(result.ok).toBe(false);
		expect(result.status).toBe(404);
		// apiFetch ne parse pas la réponse si !ok
		expect(result.data).toBeNull();
	});

	it('gère les erreurs réseau', async () => {
		vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

		const result = await apiFetch('/test');

		expect(result.ok).toBe(false);
		expect(result.status).toBe(0);
		expect(result.data).toBeNull();
	});

	it('fusionne les headers personnalisés', async () => {
		vi.mocked(fetch).mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: () => Promise.resolve({})
		} as Response);

		await apiFetch('/test', {
			headers: { 'X-Custom-Header': 'custom-value' }
		});

		expect(fetch).toHaveBeenCalledWith(
			`${API_BASE}/test`,
			expect.objectContaining({
				headers: expect.objectContaining({
					'X-Custom-Header': 'custom-value',
					Accept: 'application/json'
				})
			})
		);
	});

	it('supporte PUT et DELETE', async () => {
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve({})
		} as Response);

		await apiFetch('/test', { method: 'PUT' });
		expect(fetch).toHaveBeenCalledWith(
			`${API_BASE}/test`,
			expect.objectContaining({ method: 'PUT' })
		);

		await apiFetch('/test', { method: 'DELETE' });
		expect(fetch).toHaveBeenCalledWith(
			`${API_BASE}/test`,
			expect.objectContaining({ method: 'DELETE' })
		);
	});
});
