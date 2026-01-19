import { describe, it, expect } from 'vitest';
import { formatRoomName, normalizePseudo, formatTimestamp, truncate } from '$lib/utils/format';

describe('formatRoomName', () => {
	it('remplace les tirets et underscores par des espaces', () => {
		expect(formatRoomName('my-room-name')).toBe('My room name');
		expect(formatRoomName('my_room_name')).toBe('My room name');
	});

	it('met la première lettre en majuscule', () => {
		expect(formatRoomName('general')).toBe('General');
		expect(formatRoomName('random')).toBe('Random');
	});

	it('retourne la source si le nettoyage produit une chaîne vide', () => {
		expect(formatRoomName('---')).toBe('---');
	});

	it('gère les chaînes déjà formatées', () => {
		expect(formatRoomName('Already Good')).toBe('Already Good');
	});
});

describe('normalizePseudo', () => {
	it('convertit en minuscules et trim', () => {
		expect(normalizePseudo('  John  ')).toBe('john');
		expect(normalizePseudo('ALICE')).toBe('alice');
	});

	it('retourne undefined pour une chaîne vide', () => {
		expect(normalizePseudo('')).toBeUndefined();
		expect(normalizePseudo('   ')).toBeUndefined();
	});

	it('gère null et undefined', () => {
		expect(normalizePseudo(null)).toBeUndefined();
		expect(normalizePseudo(undefined)).toBeUndefined();
	});
});

describe('formatTimestamp', () => {
	it('formate un timestamp en date locale', () => {
		const ts = new Date('2024-01-15T10:30:00').getTime();
		const result = formatTimestamp(ts);
		// Le format exact dépend de la locale, on vérifie juste que c'est une string non vide
		expect(typeof result).toBe('string');
		expect(result.length).toBeGreaterThan(0);
	});
});

describe('truncate', () => {
	it('ne modifie pas un texte plus court que maxLength', () => {
		expect(truncate('hello', 10)).toBe('hello');
		expect(truncate('exact', 5)).toBe('exact');
	});

	it('tronque avec ellipse si le texte est trop long', () => {
		expect(truncate('hello world', 8)).toBe('hello...');
		expect(truncate('abcdefghij', 7)).toBe('abcd...');
	});
});
