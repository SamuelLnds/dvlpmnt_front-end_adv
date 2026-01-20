/**
 * Configuration Playwright pour les tests E2E
 *
 * Ce fichier configure l'environnement de test end-to-end pour l'application
 * PWA de chat temps réel. Il définit les navigateurs cibles, les timeouts,
 * et le serveur de développement à utiliser pendant les tests.
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * URL de base de l'application en développement
 * Utilisée par tous les tests comme point de départ
 */
const BASE_URL = 'http://localhost:5173';

export default defineConfig({
	/**
	 * Répertoire contenant tous les tests E2E
	 * Organisé par fonctionnalité (user, reception, room, camera, gallery, navigation)
	 */
	testDir: './e2e',

	/**
	 * Pattern pour trouver les fichiers de test
	 * Tous les fichiers .spec.ts dans le dossier e2e
	 */
	testMatch: '**/*.spec.ts',

	/**
	 * Exécution séquentielle pour plus de stabilité
	 * Les tests avec authenticatedPage peuvent avoir des problèmes en parallèle
	 */
	fullyParallel: false,

	/**
	 * Échoue immédiatement en CI si test.only() est présent
	 * Évite d'oublier des tests focalisés avant un merge
	 */
	forbidOnly: !!process.env.CI,

	/**
	 * Nombre de tentatives en cas d'échec
	 * 2 retries en CI pour gérer la flakiness, 0 en local
	 */
	retries: process.env.CI ? 2 : 0,

	/**
	 * Nombre de workers parallèles
	 * Réduit à 2 pour éviter les problèmes de réseau et de timing
	 */
	workers: process.env.CI ? 1 : 2,

	/**
	 * Reporters pour afficher les résultats
	 * - 'html' : rapport HTML interactif consultable après les tests
	 * - 'list' : affichage console pendant l'exécution
	 */
	reporter: [['html', { open: 'never' }], ['list']],

	/**
	 * Configuration partagée par tous les tests
	 */
	use: {
		/** URL de base pour navigation relative (goto('/user') → localhost:5173/user) */
		baseURL: BASE_URL,

		/** Capture des traces uniquement lors du premier retry (optimise le stockage) */
		trace: 'on-first-retry',

		/** Screenshot uniquement en cas d'échec (diagnostic) */
		screenshot: 'only-on-failure',

		/** Enregistrement vidéo uniquement lors du premier retry */
		video: 'on-first-retry',

		/** Locale française pour correspondre à l'interface */
		locale: 'fr-FR',

		/** Timezone Paris pour cohérence des dates affichées */
		timezoneId: 'Europe/Paris',

		/**
		 * Permissions accordées automatiquement par le navigateur
		 * Nécessaires pour les fonctionnalités PWA (caméra, notifications, géoloc)
		 */
		permissions: ['camera', 'notifications', 'geolocation'],

		/**
		 * Position géographique simulée (Paris)
		 * Utilisée pour les tests de géolocalisation dans le profil
		 */
		geolocation: { latitude: 48.8566, longitude: 2.3522 },
	},

	/**
	 * Projet de test : Chromium uniquement pour les tests rapides
	 * Ajouter d'autres navigateurs en CI si besoin
	 */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	/**
	 * Configuration du serveur de développement
	 * Lance automatiquement `npm run dev` avant les tests
	 */
	webServer: {
		command: 'npm run dev',
		url: BASE_URL,
		/** Réutilise le serveur s'il est déjà lancé (pratique en développement) */
		reuseExistingServer: !process.env.CI,
		/** Timeout de démarrage du serveur (60s) */
		timeout: 60 * 1000,
		/** Affiche les logs du serveur en console */
		stdout: 'pipe',
	},

	/**
	 * Timeouts globaux
	 */
	timeout: 30 * 1000, // 30s par test
	expect: {
		timeout: 10 * 1000, // 10s pour les assertions
	},
});
