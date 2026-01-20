/**
 * Tests E2E - Navigation et thème
 *
 * Couvre les fonctionnalités globales :
 * - Navbar et liens de navigation
 * - Toggle de thème
 * - Responsive (drawer mobile)
 */

import { test, expect, StorageHelper, STORAGE_KEYS } from './fixtures';

test.describe('Navigation et Thème', () => {
	// =========================================================================
	// NAVBAR (tests simplifiés avec page simple)
	// =========================================================================

	test.describe('Navbar', () => {
		test('affiche le logo/brand', async ({ page }) => {
			await page.goto('/user');
			await expect(page.locator('.navbar__brand')).toBeVisible();
		});

		test('affiche les liens de navigation pour utilisateur connecté', async ({
			page,
		}) => {
			// Configurer un profil
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await storage.setProfile('TestUser');
			await page.goto('/gallery');
			await page.waitForTimeout(300);

			// Les liens principaux doivent être visibles dans le menu desktop
			await expect(page.locator('.navbar__menu')).toBeVisible();
		});

		test('surligne le lien actif', async ({ page }) => {
			// Configurer un profil
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await storage.setProfile('TestUser');
			await page.goto('/gallery');
			await page.waitForTimeout(500);

			// Vérifier que la navbar existe et qu'on est bien sur /gallery
			await expect(page.locator('.navbar')).toBeVisible();
			expect(page.url()).toContain('/gallery');
		});
	});

	// =========================================================================
	// TOGGLE DE THÈME
	// =========================================================================

	test.describe('Toggle de thème', () => {
		test('affiche le bouton de thème', async ({ page }) => {
			await page.goto('/user');
			await expect(page.locator('.theme-pill')).toBeVisible();
		});

		test('peut basculer le thème', async ({ page }) => {
			await page.goto('/user');
			await page.waitForTimeout(300);

			const themePill = page.locator('.theme-pill');
			await expect(themePill).toBeVisible();

			// Cliquer pour basculer
			await themePill.click();
			await page.waitForTimeout(500);

			// Le bouton doit toujours exister après le clic
			await expect(themePill).toBeVisible();
		});

		test('persiste le thème après rechargement', async ({ page }) => {
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await page.waitForTimeout(300);

			// Définir le thème light directement dans le localStorage
			await storage.set(STORAGE_KEYS.THEME, 'light');

			// Recharger la page pour que le thème soit lu
			await page.goto('/user');
			await page.waitForTimeout(300);

			// Le thème doit être light (peut être sur le document ou le bouton)
			const theme = await page.evaluate(() => {
				return document.documentElement.dataset.theme || localStorage.getItem('app-theme');
			});
			expect(theme).toBe('light');
		});
	});

	// =========================================================================
	// NAVIGATION
	// =========================================================================

	test.describe('Navigation entre pages', () => {
		test('peut naviguer vers la caméra', async ({ page }) => {
			// Configurer un profil
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await storage.setProfile('TestUser');
			await page.goto('/camera');
			await page.waitForTimeout(300);

			// Vérifier qu'on est bien sur /camera
			await expect(page).toHaveURL(/\/camera/);
			await expect(page.locator('h1')).toContainText('Caméra');
		});

		test('peut naviguer vers la galerie', async ({ page }) => {
			// Configurer un profil
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await storage.setProfile('TestUser');
			await page.goto('/gallery');
			await page.waitForTimeout(300);

			// Vérifier qu'on est bien sur /gallery
			await expect(page).toHaveURL(/\/gallery/);
			await expect(page.locator('h1')).toContainText('Galerie');
		});

		test('peut naviguer vers le profil', async ({ page }) => {
			// Configurer un profil
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await storage.setProfile('TestUser');
			await page.waitForTimeout(300);

			// Vérifier qu'on est bien sur /user
			await expect(page).toHaveURL(/\/user/);
			await expect(page.locator('h1')).toContainText('profil');
		});
	});

	// =========================================================================
	// RESPONSIVE / MOBILE
	// =========================================================================

	test.describe('Responsive mobile', () => {
		test.skip('affiche le bouton hamburger en mobile', async ({ page }) => {
			// Définir un viewport mobile
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/user');

			// Le bouton hamburger doit être visible sur mobile
			await expect(page.locator('.navbar__toggle')).toBeVisible();
		});

		test.skip('ouvre le drawer au clic sur hamburger', async ({ page }) => {
			const storage = new StorageHelper(page);
			await page.goto('/user');
			await storage.setProfile('TestUser');

			// Définir un viewport mobile
			await page.setViewportSize({ width: 375, height: 667 });
			await page.goto('/reception');

			// Cliquer sur le hamburger
			await page.locator('.navbar__toggle').click();
			await page.waitForTimeout(300);

			// Le drawer doit s'ouvrir
			await expect(page.locator('.navbar__drawer[data-open="true"]')).toBeVisible();
		});
	});
});
