import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchUserImage, uploadUserImage } from '$lib/api/images';

describe('fetchUserImage', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retourne null si l\'id est vide', async () => {
		const result = await fetchUserImage('');
		expect(result).toBeNull();
		expect(fetch).not.toHaveBeenCalled();
	});

	it('retourne la data URL si la réponse est valide', async () => {
		const mockDataUrl = 'data:image/png;base64,abc123';
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: true, data_image: mockDataUrl })
		});

		const result = await fetchUserImage('user123');

		expect(result).toBe(mockDataUrl);
		expect(fetch).toHaveBeenCalledWith(
			'https://api.tools.gavago.fr/socketio/api/images/user123',
			expect.objectContaining({ method: 'GET' })
		);
	});

	it('retourne null si data_image n\'est pas une data URL valide', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: true, data_image: 'not-a-data-url' })
		});

		const result = await fetchUserImage('user123');
		expect(result).toBeNull();
	});

	it('retourne null si la réponse n\'est pas ok', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 404
		});

		const result = await fetchUserImage('user123');
		expect(result).toBeNull();
	});

	it('retourne null si fetch échoue', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

		const result = await fetchUserImage('user123');
		expect(result).toBeNull();
	});

	it('encode l\'id dans l\'URL', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ data_image: null })
		});

		await fetchUserImage('user/with/slashes');

		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('user%2Fwith%2Fslashes'),
			expect.any(Object)
		);
	});
});

describe('uploadUserImage', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retourne false si l\'id est vide', async () => {
		const result = await uploadUserImage('', 'data:image/png;base64,abc');
		expect(result).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('retourne false si imageData est vide', async () => {
		const result = await uploadUserImage('user123', '');
		expect(result).toBe(false);
		expect(fetch).not.toHaveBeenCalled();
	});

	it('retourne true si l\'upload réussit', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: true })
		});

		const result = await uploadUserImage('user123', 'data:image/png;base64,abc');

		expect(result).toBe(true);
		expect(fetch).toHaveBeenCalledWith(
			'https://api.tools.gavago.fr/socketio/api/images/',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
				body: JSON.stringify({ id: 'user123', image_data: 'data:image/png;base64,abc' })
			})
		);
	});

	it('retourne false si la réponse n\'est pas ok', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500
		});

		const result = await uploadUserImage('user123', 'data:image/png;base64,abc');
		expect(result).toBe(false);
	});

	it('retourne false si success est false', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ success: false })
		});

		const result = await uploadUserImage('user123', 'data:image/png;base64,abc');
		expect(result).toBe(false);
	});

	it('retourne false si fetch échoue', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

		const result = await uploadUserImage('user123', 'data:image/png;base64,abc');
		expect(result).toBe(false);
	});
});
