import { writable } from 'svelte/store';

export type LoadingState = {
	visible: boolean;
	message: string;
};

function createLoadingStore() {
	const { subscribe, set, update } = writable<LoadingState>({
		visible: false,
		message: 'Chargement...'
	});

	return {
		subscribe,
		show: (message = 'Chargement...') => set({ visible: true, message }),
		hide: () => set({ visible: false, message: '' }),
		update
	};
}

export const loadingStore = createLoadingStore();

/**
 * Helper pour wrapper une promesse avec le loading
 */
export async function withLoading<T>(
	promise: Promise<T>,
	message = 'Chargement...'
): Promise<T> {
	loadingStore.show(message);
	try {
		return await promise;
	} finally {
		loadingStore.hide();
	}
}
