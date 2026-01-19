import { describe, it, expect } from 'vitest';
import {
	isDataUrl,
	isNonEmptyString,
	isValidNumber,
	safeParse,
	hasRequiredStringProps
} from '$lib/utils/validation';

describe('isDataUrl', () => {
	it('retourne true pour une data URL image valide', () => {
		expect(isDataUrl('data:image/png;base64,abc123')).toBe(true);
		expect(isDataUrl('data:image/jpeg;base64,xyz')).toBe(true);
	});

	it('retourne false pour une chaîne non data URL', () => {
		expect(isDataUrl('https://example.com/image.png')).toBe(false);
		expect(isDataUrl('not a url')).toBe(false);
	});

	it('retourne false pour des types non-string', () => {
		expect(isDataUrl(null)).toBe(false);
		expect(isDataUrl(undefined)).toBe(false);
		expect(isDataUrl(123)).toBe(false);
		expect(isDataUrl({})).toBe(false);
	});
});

describe('isNonEmptyString', () => {
	it('retourne true pour une chaîne non vide', () => {
		expect(isNonEmptyString('hello')).toBe(true);
		expect(isNonEmptyString('  content  ')).toBe(true);
	});

	it('retourne false pour une chaîne vide ou espaces seuls', () => {
		expect(isNonEmptyString('')).toBe(false);
		expect(isNonEmptyString('   ')).toBe(false);
	});

	it('retourne false pour des types non-string', () => {
		expect(isNonEmptyString(null)).toBe(false);
		expect(isNonEmptyString(undefined)).toBe(false);
		expect(isNonEmptyString(42)).toBe(false);
	});
});

describe('isValidNumber', () => {
	it('retourne true pour des nombres valides', () => {
		expect(isValidNumber(0)).toBe(true);
		expect(isValidNumber(42)).toBe(true);
		expect(isValidNumber(-10.5)).toBe(true);
	});

	it('retourne false pour NaN et Infinity', () => {
		expect(isValidNumber(NaN)).toBe(false);
		expect(isValidNumber(Infinity)).toBe(false);
		expect(isValidNumber(-Infinity)).toBe(false);
	});

	it('retourne false pour des types non-number', () => {
		expect(isValidNumber('42')).toBe(false);
		expect(isValidNumber(null)).toBe(false);
	});
});

describe('safeParse', () => {
	it('parse correctement un JSON valide', () => {
		expect(safeParse('{"key": "value"}', {})).toEqual({ key: 'value' });
		expect(safeParse('[1, 2, 3]', [])).toEqual([1, 2, 3]);
	});

	it('retourne le fallback pour un JSON invalide', () => {
		expect(safeParse('invalid json', { default: true })).toEqual({ default: true });
		expect(safeParse('{broken', [])).toEqual([]);
	});

	it('retourne le fallback pour null ou undefined', () => {
		expect(safeParse(null, 'fallback')).toBe('fallback');
		expect(safeParse('', [])).toEqual([]);
	});
});

describe('hasRequiredStringProps', () => {
	it('retourne true si toutes les props requises sont des strings', () => {
		const obj = { id: 'abc', name: 'Test' };
		expect(hasRequiredStringProps(obj, ['id', 'name'])).toBe(true);
	});

	it('retourne false si une prop est manquante ou non-string', () => {
		expect(hasRequiredStringProps({ id: 123 }, ['id'])).toBe(false);
		expect(hasRequiredStringProps({ id: 'abc' }, ['id', 'name'])).toBe(false);
	});

	it('retourne false pour des types non-object', () => {
		expect(hasRequiredStringProps(null, ['id'])).toBe(false);
		expect(hasRequiredStringProps('string', ['id'])).toBe(false);
	});
});
