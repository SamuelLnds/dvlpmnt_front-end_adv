/**
 * Fonctions de formatage pures, testables indépendamment.
 */

/**
 * Formate un identifiant de room en nom lisible.
 * Remplace les tirets/underscores par des espaces et met la première lettre en majuscule.
 */
export function formatRoomName(source: string): string {
	const cleaned = source.replace(/[-_]+/g, ' ').trim();
	if (!cleaned) return source;
	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Normalise un pseudo en minuscules, sans espaces superflus.
 */
export function normalizePseudo(value?: string | null): string | undefined {
	const trimmed = (value ?? '').trim();
	return trimmed ? trimmed.toLowerCase() : undefined;
}

/**
 * Formate un timestamp en chaîne de date locale.
 */
export function formatTimestamp(ts: number): string {
	return new Date(ts).toLocaleString();
}

/**
 * Tronque un texte à une longueur maximale avec ellipse.
 */
export function truncate(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return `${text.slice(0, maxLength - 3)}...`;
}
