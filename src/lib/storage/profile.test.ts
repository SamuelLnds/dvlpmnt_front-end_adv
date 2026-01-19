import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	readProfile,
	writeProfile,
	readLastRoom,
	writeLastRoom,
	readLocation,
	writeLocation,
	clearLocation,
	reverseGeocode,
	defaultAvatarDataURL,
	PROFILE_KEY,
	LAST_ROOM_KEY,
	LOCATION_KEY,
	type Profile,
	type Location
} from '$lib/storage/profile';

describe('readProfile', () => {
	it('retourne un profil vide si localStorage est vide', () => {
		const profile = readProfile();
		expect(profile.pseudo).toBe('');
		expect(profile.accountExists).toBeFalsy();
	});

	it('lit correctement un profil stocké', () => {
		const stored: Profile = { pseudo: 'TestUser', photoDataUrl: 'data:image/png;base64,abc' };
		localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));

		const profile = readProfile();
		expect(profile.pseudo).toBe('TestUser');
		expect(profile.photoDataUrl).toBe('data:image/png;base64,abc');
		expect(profile.accountExists).toBe(true);
	});

	it('trim le pseudo', () => {
		localStorage.setItem(PROFILE_KEY, JSON.stringify({ pseudo: '  Spaced  ' }));
		expect(readProfile().pseudo).toBe('Spaced');
	});

	it('gère un JSON invalide', () => {
		localStorage.setItem(PROFILE_KEY, 'not json');
		expect(readProfile().pseudo).toBe('');
	});
});

describe('writeProfile', () => {
	it('écrit le profil avec accountExists à true', () => {
		const profile: Profile = { pseudo: 'User' };
		writeProfile(profile);

		const stored = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}');
		expect(stored.pseudo).toBe('User');
		expect(stored.accountExists).toBe(true);
	});

	it('gère les erreurs de localStorage silencieusement', () => {
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('QuotaExceededError');
		});

		expect(() => writeProfile({ pseudo: 'Test' })).not.toThrow();
	});
});

describe('readLastRoom / writeLastRoom', () => {
	it('retourne une chaîne vide si pas de room stockée', () => {
		expect(readLastRoom()).toBe('');
	});

	it('lit et écrit la dernière room', () => {
		writeLastRoom('my-room');
		expect(localStorage.getItem(LAST_ROOM_KEY)).toBe('my-room');
	});

	it('gère les erreurs de localStorage pour readLastRoom', () => {
		vi.mocked(localStorage.getItem).mockImplementationOnce(() => {
			throw new Error('Error');
		});

		expect(readLastRoom()).toBe('');
	});

	it('gère les erreurs de localStorage pour writeLastRoom', () => {
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('Error');
		});

		expect(() => writeLastRoom('test')).not.toThrow();
	});
});

describe('readLocation / writeLocation / clearLocation', () => {
	const validLocation: Location = {
		latitude: 48.8566,
		longitude: 2.3522,
		city: 'Paris',
		country: 'France',
		timestamp: Date.now()
	};

	it('retourne null si pas de location stockée', () => {
		expect(readLocation()).toBeNull();
	});

	it('lit correctement une location valide', () => {
		localStorage.setItem(LOCATION_KEY, JSON.stringify(validLocation));

		const loc = readLocation();
		expect(loc?.latitude).toBe(48.8566);
		expect(loc?.longitude).toBe(2.3522);
		expect(loc?.city).toBe('Paris');
	});

	it('retourne null si latitude/longitude sont invalides', () => {
		localStorage.setItem(LOCATION_KEY, JSON.stringify({ city: 'Paris' }));
		expect(readLocation()).toBeNull();
	});

	it('écrit et efface la location', () => {
		writeLocation(validLocation);
		expect(readLocation()).not.toBeNull();

		clearLocation();
		expect(readLocation()).toBeNull();
	});

	it('gère les erreurs de localStorage pour readLocation', () => {
		vi.mocked(localStorage.getItem).mockImplementationOnce(() => {
			throw new Error('Error');
		});

		expect(readLocation()).toBeNull();
	});

	it('gère les erreurs de localStorage pour writeLocation', () => {
		vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
			throw new Error('Error');
		});

		expect(() => writeLocation(validLocation)).not.toThrow();
	});

	it('gère les erreurs de localStorage pour clearLocation', () => {
		vi.mocked(localStorage.removeItem).mockImplementationOnce(() => {
			throw new Error('Error');
		});

		expect(() => clearLocation()).not.toThrow();
	});

	it('utilise Date.now() si timestamp est manquant', () => {
		const locWithoutTs = { latitude: 1, longitude: 2 };
		localStorage.setItem(LOCATION_KEY, JSON.stringify(locWithoutTs));

		const loc = readLocation();
		expect(loc?.timestamp).toBeGreaterThan(0);
	});
});

describe('reverseGeocode', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('retourne city et country depuis l\'API Nominatim', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				address: {
					city: 'Paris',
					country: 'France'
				}
			})
		});

		const result = await reverseGeocode(48.8566, 2.3522);

		expect(result).toEqual({ city: 'Paris', country: 'France' });
		expect(fetch).toHaveBeenCalledWith(
			expect.stringContaining('nominatim.openstreetmap.org/reverse'),
			expect.any(Object)
		);
	});

	it('utilise town, village, municipality ou county si city absent', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({
				address: {
					town: 'SmallTown',
					country: 'France'
				}
			})
		});

		const result = await reverseGeocode(48.0, 2.0);
		expect(result.city).toBe('SmallTown');
	});

	it('retourne un objet vide si la réponse n\'est pas ok', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status: 500
		});

		const result = await reverseGeocode(0, 0);
		expect(result).toEqual({});
	});

	it('retourne un objet vide si fetch échoue', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

		const result = await reverseGeocode(0, 0);
		expect(result).toEqual({});
	});

	it('retourne un objet vide si address est absent', async () => {
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({})
		});

		const result = await reverseGeocode(0, 0);
		expect(result).toEqual({ city: undefined, country: undefined });
	});
});

describe('defaultAvatarDataURL', () => {
	beforeEach(() => {
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('fetch l\'avatar par défaut et le convertit en data URL', async () => {
		const mockBlob = new Blob(['test'], { type: 'image/png' });
		(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			blob: () => Promise.resolve(mockBlob)
		});

		const result = await defaultAvatarDataURL();

		expect(result).toMatch(/^data:/);
		expect(fetch).toHaveBeenCalled();
	});
});
