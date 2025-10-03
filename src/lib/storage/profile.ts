export const PROFILE_KEY = 'chat.profile.v1';
export const LAST_ROOM_KEY = 'chat.lastRoom.v1';

export type Profile = { pseudo: string };

export function readProfile(): Profile {
	try {
		const raw = localStorage.getItem(PROFILE_KEY);
		const p = raw ? (JSON.parse(raw) as Partial<Profile>) : {};
		return { pseudo: typeof p.pseudo === 'string' ? p.pseudo : '' };
	} catch {
		return { pseudo: '' };
	}
}

export function writeProfile(p: Profile) {
	try {
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
