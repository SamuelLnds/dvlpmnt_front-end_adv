/**
 * Fixtures et helpers partagés pour les tests E2E
 *
 * Ce fichier étend les fonctionnalités de base de Playwright avec des
 * fixtures personnalisées pour l'application de chat PWA. Il fournit :
 * - Une fixture `authenticatedPage` pour simuler un utilisateur connecté
 * - Des helpers pour manipuler le localStorage de l'application
 * - Des utilitaires de test réutilisables
 */

import { test as base, expect, type Page } from '@playwright/test';

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Profil utilisateur stocké dans localStorage
 * Correspond au type Profile de storage/profile.ts
 */
export interface TestProfile {
	pseudo: string;
	photoDataUrl?: string;
}

/**
 * Localisation utilisateur stockée dans localStorage
 * Correspond au type Location de storage/profile.ts
 */
export interface TestLocation {
	latitude: number;
	longitude: number;
	city?: string;
	country?: string;
	timestamp: number;
}

/**
 * Room de chat stockée dans localStorage
 * Correspond au type Room de storage/rooms.ts
 */
export interface TestRoom {
	id: string;
	name: string;
	joined: boolean;
	private: boolean;
	clientCount: number;
}

/**
 * Photo stockée dans la galerie locale
 * Correspond au type PhotoItem de storage/photos.ts
 */
export interface TestPhoto {
	ts: number;
	dataUrl: string;
}

/**
 * Message de chat stocké dans localStorage
 * Structure simplifiée pour les tests
 */
export interface TestMessage {
	content: string;
	dateEmis: string;
	roomName: string;
	pseudo: string;
	categorie: 'MESSAGE' | 'INFO';
}

// ============================================================================
// CLÉS LOCALSTORAGE (doivent correspondre aux clés de l'application)
// ============================================================================

export const STORAGE_KEYS = {
	/** Profil utilisateur */
	PROFILE: 'chat.profile.v1',
	/** Dernière room visitée */
	LAST_ROOM: 'chat.lastRoom.v1',
	/** Localisation utilisateur */
	LOCATION: 'chat.location.v1',
	/** Liste des rooms connues */
	ROOMS: 'chat.rooms.v1',
	/** Photos de la galerie */
	PHOTOS: 'camera.photos.v1',
	/** Messages de chat par room */
	MESSAGES: 'chat.messages.v1',
	/** Thème de l'application */
	THEME: 'app-theme',
} as const;

// ============================================================================
// HELPERS LOCALSTORAGE
// ============================================================================

/**
 * Classe utilitaire pour manipuler le localStorage de l'application
 * depuis les tests Playwright via page.evaluate()
 */
export class StorageHelper {
	constructor(private page: Page) {}

	/**
	 * Définit une valeur dans le localStorage
	 * @param key - Clé de stockage
	 * @param value - Valeur à stocker (sera JSON.stringify si objet)
	 */
	async set(key: string, value: unknown): Promise<void> {
		await this.page.evaluate(
			([k, v]) => {
				localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
			},
			[key, value] as const
		);
	}

	/**
	 * Récupère une valeur du localStorage
	 * @param key - Clé de stockage
	 * @returns Valeur parsée ou null si absente
	 */
	async get<T>(key: string): Promise<T | null> {
		return this.page.evaluate((k) => {
			const raw = localStorage.getItem(k);
			if (!raw) return null;
			try {
				return JSON.parse(raw) as T;
			} catch {
				return raw as T;
			}
		}, key);
	}

	/**
	 * Supprime une clé du localStorage
	 */
	async remove(key: string): Promise<void> {
		await this.page.evaluate((k) => localStorage.removeItem(k), key);
	}

	/**
	 * Vide tout le localStorage
	 */
	async clear(): Promise<void> {
		await this.page.evaluate(() => localStorage.clear());
	}

	// -------------------------------------------------------------------------
	// Helpers spécifiques à l'application
	// -------------------------------------------------------------------------

	/**
	 * Crée un profil utilisateur pour les tests
	 * @param pseudo - Pseudo de l'utilisateur
	 * @param photoDataUrl - Avatar optionnel (data URL)
	 */
	async setProfile(pseudo: string, photoDataUrl?: string): Promise<void> {
		const profile: TestProfile = { pseudo };
		if (photoDataUrl) {
			profile.photoDataUrl = photoDataUrl;
		}
		await this.set(STORAGE_KEYS.PROFILE, profile);
	}

	/**
	 * Récupère le profil utilisateur actuel
	 */
	async getProfile(): Promise<TestProfile | null> {
		return this.get<TestProfile>(STORAGE_KEYS.PROFILE);
	}

	/**
	 * Définit la dernière room visitée
	 */
	async setLastRoom(roomId: string): Promise<void> {
		await this.set(STORAGE_KEYS.LAST_ROOM, roomId);
	}

	/**
	 * Récupère la dernière room visitée
	 */
	async getLastRoom(): Promise<string | null> {
		return this.get<string>(STORAGE_KEYS.LAST_ROOM);
	}

	/**
	 * Définit la localisation utilisateur
	 */
	async setLocation(location: TestLocation): Promise<void> {
		await this.set(STORAGE_KEYS.LOCATION, location);
	}

	/**
	 * Récupère la localisation utilisateur
	 */
	async getLocation(): Promise<TestLocation | null> {
		return this.get<TestLocation>(STORAGE_KEYS.LOCATION);
	}

	/**
	 * Définit les rooms connues
	 */
	async setRooms(rooms: TestRoom[]): Promise<void> {
		await this.set(STORAGE_KEYS.ROOMS, rooms);
	}

	/**
	 * Récupère les rooms connues
	 */
	async getRooms(): Promise<TestRoom[] | null> {
		return this.get<TestRoom[]>(STORAGE_KEYS.ROOMS);
	}

	/**
	 * Ajoute des photos à la galerie
	 */
	async setPhotos(photos: TestPhoto[]): Promise<void> {
		await this.set(STORAGE_KEYS.PHOTOS, photos);
	}

	/**
	 * Récupère les photos de la galerie
	 */
	async getPhotos(): Promise<TestPhoto[] | null> {
		return this.get<TestPhoto[]>(STORAGE_KEYS.PHOTOS);
	}

	/**
	 * Définit le thème de l'application
	 */
	async setTheme(theme: 'dark' | 'light'): Promise<void> {
		await this.set(STORAGE_KEYS.THEME, theme);
	}

	/**
	 * Récupère le thème actuel
	 */
	async getTheme(): Promise<'dark' | 'light' | null> {
		return this.get<'dark' | 'light'>(STORAGE_KEYS.THEME);
	}
}

// ============================================================================
// FIXTURES PLAYWRIGHT PERSONNALISÉES
// ============================================================================

/**
 * Extension du test Playwright avec des fixtures personnalisées
 */
type CustomFixtures = {
	/** Helper pour manipuler le localStorage */
	storage: StorageHelper;

	/**
	 * Page avec un utilisateur déjà authentifié
	 * Le profil est créé avant chaque test utilisant cette fixture
	 */
	authenticatedPage: Page;
};

/**
 * Test étendu avec les fixtures personnalisées
 * Utiliser à la place de `test` de @playwright/test
 */
export const test = base.extend<CustomFixtures>({
	/**
	 * Fixture storage : wrapper pour manipuler le localStorage
	 * Disponible dans tous les tests
	 */
	storage: async ({ page }, use) => {
		const helper = new StorageHelper(page);
		await use(helper);
	},

	/**
	 * Fixture authenticatedPage : page avec utilisateur connecté
	 *
	 * Cette fixture :
	 * 1. Navigue vers la page user pour initialiser le localStorage
	 * 2. Crée un profil utilisateur de test dans le localStorage
	 * 3. Navigue vers une page protégée pour vérifier l'auth
	 *
	 * Usage :
	 * ```ts
	 * test('mon test', async ({ authenticatedPage }) => {
	 *   await authenticatedPage.goto('/reception');
	 *   // L'utilisateur "TestUser" est déjà connecté
	 * });
	 * ```
	 */
	authenticatedPage: async ({ page }, use) => {
		// Naviguer vers /user pour initialiser le localStorage
		await page.goto('/user', { waitUntil: 'load', timeout: 30000 });
		await page.waitForTimeout(200);

		// Créer un profil de test
		const storage = new StorageHelper(page);
		await storage.setProfile('TestUser');

		// Petite pause pour s'assurer que le localStorage est écrit
		await page.waitForTimeout(100);

		// La page sera prête pour naviguer vers n'importe quelle destination
		// On ne navigue pas vers reception pour éviter les connexions Socket.IO inutiles
		await use(page);
	},
});

// ============================================================================
// UTILITAIRES DE TEST
// ============================================================================

/**
 * Données de test réutilisables
 */
export const TEST_DATA = {
	/**
	 * Profils utilisateur de test
	 */
	users: {
		default: { pseudo: 'TestUser' },
		withAvatar: {
			pseudo: 'AvatarUser',
			// Petit PNG 1x1 rouge en base64 pour les tests
			photoDataUrl:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		},
	},

	/**
	 * Rooms de test
	 */
	rooms: {
		general: { id: 'general', name: 'Général', joined: true, private: false, clientCount: 0 },
		random: { id: 'random', name: 'Aléatoire', joined: true, private: false, clientCount: 0 },
		tech: { id: 'tech', name: 'Tech', joined: false, private: false, clientCount: 5 },
		custom: { id: 'custom-room', name: 'Custom Room', joined: false, private: false, clientCount: 0 },
		private: { id: 'private-room', name: 'Private Room', joined: false, private: true, clientCount: 3 },
	},

	/**
	 * Localisations de test
	 */
	locations: {
		paris: {
			latitude: 48.8566,
			longitude: 2.3522,
			city: 'Paris',
			country: 'France',
			timestamp: Date.now(),
		},
		lyon: {
			latitude: 45.764,
			longitude: 4.8357,
			city: 'Lyon',
			country: 'France',
			timestamp: Date.now(),
		},
	},

	/**
	 * Photos de test (placeholder 1x1 PNG)
	 */
	photos: {
		red: {
			ts: Date.now() - 3600000, // il y a 1h
			dataUrl:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
		},
		blue: {
			ts: Date.now() - 7200000, // il y a 2h
			dataUrl:
				'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12P4z8DAwMAAAx4C/p5GjfgAAAAASUVORK5CYII=',
		},
	},
} as const;

/**
 * Attends que le modal de chargement disparaisse
 * Utile après des actions qui déclenchent un chargement (save, fetch, etc.)
 *
 * @param page - Page Playwright
 * @param timeout - Timeout en ms (défaut: 10s)
 */
export async function waitForLoadingToFinish(page: Page, timeout = 10000): Promise<void> {
	// Le LoadingModal utilise dialog[open] quand il est visible
	await page.waitForSelector('dialog[open]', { state: 'hidden', timeout }).catch(() => {
		// Ignorer si le modal n'apparaît jamais (action rapide)
	});
}

/**
 * Recharge la page en naviguant vers la même URL
 * Plus stable que page.reload() en tests parallèles
 *
 * @param page - Page Playwright
 */
export async function safeReload(page: Page): Promise<void> {
	const currentUrl = page.url();
	await page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
}

/**
 * Vérifie qu'un toast/message de succès est affiché
 *
 * @param page - Page Playwright
 * @param text - Texte attendu dans le toast (partiel)
 */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
	const toast = page.locator('.toast');
	await expect(toast).toContainText(text);
}

/**
 * Simule la saisie dans un champ de formulaire et vérifie la valeur
 *
 * @param page - Page Playwright
 * @param selector - Sélecteur du champ
 * @param value - Valeur à saisir
 */
export async function fillAndVerify(page: Page, selector: string, value: string): Promise<void> {
	const input = page.locator(selector);
	await input.fill(value);
	await expect(input).toHaveValue(value);
}

// Réexporter expect pour avoir tout depuis un seul import
export { expect } from '@playwright/test';
