/**
 * Configuration et helpers HTTP génériques pour l'API.
 * Point central pour toutes les requêtes API.
 */

export const API_ORIGIN = 'https://api.tools.gavago.fr';
export const API_BASE = `${API_ORIGIN}/socketio/api`;

export type ApiRequestOptions = {
	method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
	body?: unknown;
	headers?: Record<string, string>;
};

export type ApiResponse<T> = {
	ok: boolean;
	status: number;
	data: T | null;
};

/**
 * Effectue une requête vers l'API avec gestion d'erreurs standardisée.
 */
export async function apiFetch<T>(
	endpoint: string,
	options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
	const { method = 'GET', body, headers = {} } = options;

	const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

	const requestHeaders: Record<string, string> = {
		Accept: 'application/json',
		...headers
	};

	if (body && method !== 'GET') {
		requestHeaders['Content-Type'] = 'application/json';
	}

	try {
		const res = await fetch(url, {
			method,
			headers: requestHeaders,
			body: body ? JSON.stringify(body) : undefined
		});

		if (!res.ok) {
			return { ok: false, status: res.status, data: null };
		}

		const data = (await res.json()) as T;
		return { ok: true, status: res.status, data };
	} catch {
		return { ok: false, status: 0, data: null };
	}
}
