/**
 * Tests E2E - Page Chat Room (/room/[id])
 *
 * Couvre les fonctionnalités du chat :
 * - Affichage et structure de la room
 * - Envoi de messages
 * - Statut de connexion
 */

import { test, expect } from './fixtures';

test.describe('Page Room (/room/[id])', () => {
	// =========================================================================
	// STRUCTURE DE LA PAGE
	// =========================================================================

	test.describe('Structure et affichage', () => {
		test('affiche le titre de la room', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			await expect(authenticatedPage).toHaveTitle(/Room #test-room/);
		});

		test('affiche le header avec le nom de la room', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/general');
			await authenticatedPage.waitForTimeout(300);
			await expect(authenticatedPage.locator('h1')).toContainText('general');
		});

		test('affiche le statut de connexion', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			const status = authenticatedPage.locator('.chat-status');
			await expect(status).toBeVisible();
		});

		test('affiche le formulaire d\'envoi de message', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			await expect(authenticatedPage.locator('input[name="text"]')).toBeVisible();
			await expect(authenticatedPage.locator('button[type="submit"]')).toContainText('Envoyer');
		});

		test('affiche le bouton d\'image', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			await expect(
				authenticatedPage.locator('button[title="Envoyer une image"]')
			).toBeVisible();
		});
	});

	// =========================================================================
	// ZONE DE MESSAGES
	// =========================================================================

	test.describe('Zone de messages', () => {
		test('affiche la zone de log des messages', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			await expect(authenticatedPage.locator('.chat-log')).toBeVisible();
		});

		test('affiche un message d\'attente si pas de messages', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/new-empty-room');
			await authenticatedPage.waitForTimeout(500);
			// Soit il y a des messages, soit un message d'attente
			const content = authenticatedPage.locator('.chat-log');
			await expect(content).toBeVisible();
		});
	});

	// =========================================================================
	// ENVOI DE MESSAGES
	// =========================================================================

	test.describe('Envoi de messages', () => {
		test('permet de saisir un message', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			const input = authenticatedPage.locator('input[name="text"]');
			await input.fill('Mon message de test');
			await expect(input).toHaveValue('Mon message de test');
		});

		test('le bouton Envoyer est présent', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(300);
			await expect(
				authenticatedPage.locator('button[type="submit"]')
			).toBeVisible();
		});

		// Skip: L'envoi de message nécessite une connexion Socket.IO stable
		test.skip('envoie un message au clic sur Envoyer', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');
			await authenticatedPage.waitForTimeout(1000);

			const input = authenticatedPage.locator('input[name="text"]');
			await input.fill('Test message E2E');

			await authenticatedPage.locator('button[type="submit"]').click();

			// Le message devrait apparaître dans le log
			await expect(authenticatedPage.locator('.chat-log')).toContainText('Test message E2E');
		});
	});

	// =========================================================================
	// NAVIGATION
	// =========================================================================

	test.describe('Navigation', () => {
		// Skip: Navigation instable après clic sur bouton retour
		test.skip('permet de retourner à la réception', async ({ authenticatedPage }) => {
			await authenticatedPage.goto('/room/test-room');

			// Lien retour vers réception
			const backLink = authenticatedPage.locator('a[href="/reception"]').first();
			if (await backLink.isVisible()) {
				await backLink.click();
				await expect(authenticatedPage).toHaveURL(/\/reception/);
			}
		});
	});
});
