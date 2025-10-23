import defaultAvatarUrl from '$lib/assets/default-avatar.png';

export const PROFILE_KEY = 'chat.profile.v1';
export const LAST_ROOM_KEY = 'chat.lastRoom.v1';

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

export function fileToDataURL(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result));
		r.onerror = reject;
		r.readAsDataURL(file);
	});
}

export async function defaultAvatarDataURL(): Promise<string> {
	const res = await fetch(defaultAvatarUrl);
	const blob = await res.blob();
	return await new Promise<string>((resolve, reject) => {
		const r = new FileReader();
		r.onload = () => resolve(String(r.result));
		r.onerror = reject;
		r.readAsDataURL(blob);
	});
}
