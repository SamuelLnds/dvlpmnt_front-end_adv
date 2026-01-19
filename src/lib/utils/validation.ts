/**
 * Fonctions de validation pures, testables indépendamment.
 */

export function isDataUrl(value: unknown): value is string {
	return typeof value === 'string' && value.startsWith('data:image');
}

export function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

export function isValidNumber(value: unknown): value is number {
	return typeof value === 'number' && !Number.isNaN(value) && Number.isFinite(value);
}

/**
 * Parse JSON en toute sécurité avec une valeur de repli.
 */
export function safeParse<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

/**
 * Valide qu'un objet possède les propriétés requises avec les types attendus.
 */
export function hasRequiredStringProps<T extends string>(
	obj: unknown,
	props: readonly T[]
): obj is Record<T, string> {
	if (!obj || typeof obj !== 'object') return false;
	return props.every((prop) => typeof (obj as Record<string, unknown>)[prop] === 'string');
}
