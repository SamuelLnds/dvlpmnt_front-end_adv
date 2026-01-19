import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { loadingStore, withLoading, type LoadingState } from '$lib/stores/loading';

describe('loadingStore', () => {
	beforeEach(() => {
		loadingStore.hide();
	});

	it('est initialement caché', () => {
		const state = get(loadingStore);
		expect(state.visible).toBe(false);
	});

	it('show() affiche le modal avec le message', () => {
		loadingStore.show('Chargement en cours...');
		const state = get(loadingStore);

		expect(state.visible).toBe(true);
		expect(state.message).toBe('Chargement en cours...');
	});

	it('show() utilise un message par défaut', () => {
		loadingStore.show();
		const state = get(loadingStore);

		expect(state.visible).toBe(true);
		expect(state.message).toBe('Chargement...');
	});

	it('hide() masque le modal', () => {
		loadingStore.show('Test');
		loadingStore.hide();
		const state = get(loadingStore);

		expect(state.visible).toBe(false);
		expect(state.message).toBe('');
	});
});

describe('withLoading', () => {
	it('affiche le loading pendant l\'exécution de la promesse', async () => {
		let resolve: (value: string) => void;
		const promise = new Promise<string>((r) => {
			resolve = r;
		});

		const resultPromise = withLoading(promise, 'Test message');

		// Pendant l'exécution
		expect(get(loadingStore).visible).toBe(true);
		expect(get(loadingStore).message).toBe('Test message');

		resolve!('done');
		const result = await resultPromise;

		// Après l'exécution
		expect(result).toBe('done');
		expect(get(loadingStore).visible).toBe(false);
	});

	it('masque le loading même si la promesse échoue', async () => {
		const failingPromise = Promise.reject(new Error('Test error'));

		await expect(withLoading(failingPromise)).rejects.toThrow('Test error');
		expect(get(loadingStore).visible).toBe(false);
	});
});
