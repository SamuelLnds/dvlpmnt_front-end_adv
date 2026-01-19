import defaultAvatarUrl from '$lib/assets/default-avatar.png';
import { fileToDataURL as _fileToDataURL } from '$lib/utils/download';

// Ré-export pour compatibilité avec le code existant
export const fileToDataURL = _fileToDataURL;

export const PROFILE_KEY = 'chat.profile.v1';
export const LAST_ROOM_KEY = 'chat.lastRoom.v1';
export const LOCATION_KEY = 'chat.location.v1';

export type Location = {
	city?: string;
	country?: string;
	latitude: number;
	longitude: number;
	timestamp: number;
};

export type Profile = {
	pseudo: string;
	photoDataUrl?: string;
	accountExists?: boolean;
};

export function readProfile(): Profile {
	try {
		const raw = localStorage.getItem(PROFILE_KEY);
		const p = raw ? (JSON.parse(raw) as Partial<Profile>) : {};
		const pseudo = typeof p.pseudo === 'string' ? p.pseudo.trim() : '';
		return {
			pseudo: pseudo,
			photoDataUrl: typeof p.photoDataUrl === 'string' ? p.photoDataUrl : undefined,
			accountExists: Boolean(pseudo)
		};
	} catch {
		return { pseudo: '' };
	}
}

export function writeProfile(p: Profile) {
	try {
		p.accountExists = true;
		localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
	} catch {}
}

export function readLastRoom(): string {
	try {
		return localStorage.getItem(LAST_ROOM_KEY) ?? '';
	} catch {
		return '';
	}
}
export function writeLastRoom(room: string) {
	try {
		localStorage.setItem(LAST_ROOM_KEY, room);
	} catch {}
}

export function readLocation(): Location | null {
	try {
		const raw = localStorage.getItem(LOCATION_KEY);
		if (!raw) return null;
		const loc = JSON.parse(raw) as Partial<Location>;
		if (typeof loc.latitude !== 'number' || typeof loc.longitude !== 'number') return null;
		return {
			city: typeof loc.city === 'string' ? loc.city : undefined,
			country: typeof loc.country === 'string' ? loc.country : undefined,
			latitude: loc.latitude,
			longitude: loc.longitude,
			timestamp: typeof loc.timestamp === 'number' ? loc.timestamp : Date.now()
		};
	} catch {
		return null;
	}
}

export function writeLocation(loc: Location) {
	try {
		localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
	} catch {}
}

export function clearLocation() {
	try {
		localStorage.removeItem(LOCATION_KEY);
	} catch {}
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ city?: string; country?: string }> {
	try {
		// Nominatim OpenStreetMap API permet de convertir lat/lon en ville/pays
		const res = await fetch(
			`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
			{ headers: { 'Accept-Language': 'fr' } }
		);
		if (!res.ok) return {};
		const data = await res.json();
		const addr = data.address || {};
		return {
			city: addr.city || addr.town || addr.village || addr.municipality || addr.county,
			country: addr.country
		};
	} catch {
		return {};
	}
}

export async function defaultAvatarDataURL(): Promise<string> {
	const res = await fetch(defaultAvatarUrl);
	const blob = await res.blob();
	return _fileToDataURL(blob as unknown as File);
}
