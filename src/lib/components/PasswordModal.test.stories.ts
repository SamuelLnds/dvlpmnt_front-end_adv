import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import PasswordModal from './PasswordModal.svelte';

const meta = {
	title: 'Tests/PasswordModal',
	component: PasswordModal,
	args: {
		visible: true,
		roomName: 'Test Room',
		onSubmit: fn(),
		onClose: fn(),
	},
} satisfies Meta<typeof PasswordModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TestSubmitPassword: Story = {
	name: '🧪 Test: Soumission du mot de passe',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Trouver le champ de mot de passe
		const passwordInput = canvas.getByLabelText(/mot de passe de la room/i);
		expect(passwordInput).toBeInTheDocument();

		// Saisir un mot de passe
		await userEvent.type(passwordInput, 'secret123');

		// Trouver et cliquer sur le bouton Déverrouiller
		const submitButton = canvas.getByRole('button', { name: /déverrouiller/i });
		await userEvent.click(submitButton);

		// Vérifier que onSubmit a été appelée avec le bon mot de passe
		expect(args.onSubmit).toHaveBeenCalledWith('secret123');
	},
};

export const TestCloseWithButton: Story = {
	name: '🧪 Test: Fermeture via bouton Annuler',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Trouver et cliquer sur le bouton Annuler
		const cancelButton = canvas.getByRole('button', { name: /annuler/i });
		await userEvent.click(cancelButton);

		// Vérifier que onClose a été appelée
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const TestCloseWithXButton: Story = {
	name: '🧪 Test: Fermeture via bouton X',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Trouver et cliquer sur le bouton X
		const closeButton = canvas.getByRole('button', { name: /fermer/i });
		await userEvent.click(closeButton);

		// Vérifier que onClose a été appelée
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const TestEmptyPasswordValidation: Story = {
	name: '🧪 Test: Validation mot de passe vide',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Ne pas saisir de mot de passe, cliquer directement sur Déverrouiller
		const submitButton = canvas.getByRole('button', { name: /déverrouiller/i });
		await userEvent.click(submitButton);

		// Vérifier que onSubmit n'a PAS été appelée (validation échouée)
		expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

export const TestRoomNameDisplay: Story = {
	name: '🧪 Test: Affichage du nom de la room',
	args: {
		roomName: 'Salon Privé VIP',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Vérifier que le nom de la room est affiché
		const roomNameElement = canvas.getByText(/salon privé vip/i);
		expect(roomNameElement).toBeInTheDocument();
	},
};

export const TestInputFocus: Story = {
	name: '🧪 Test: Focus automatique sur le champ',
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Attendre que le modal soit affiché et que le focus soit mis
		await waitFor(() => {
			const passwordInput = canvas.getByLabelText(/mot de passe de la room/i);
			expect(passwordInput).toBeInTheDocument();
		});
	},
};

export const TestErrorDisplay: Story = {
	name: '🧪 Test: Affichage du message d\'erreur',
	args: {
		error: 'Mot de passe incorrect pour la room "Test Room".',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Vérifier que le message d'erreur est affiché
		const errorMessage = canvas.getByRole('alert');
		expect(errorMessage).toBeInTheDocument();
		expect(errorMessage).toHaveTextContent(/mot de passe incorrect/i);

		// Vérifier que l'input a la classe d'erreur (border rouge)
		const passwordInput = canvas.getByLabelText(/mot de passe de la room/i);
		expect(passwordInput).toHaveClass('input--error');
	},
};

export const TestLoadingState: Story = {
	name: '🧪 Test: État de chargement',
	args: {
		loading: true,
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Vérifier que le bouton affiche "Vérification..."
		const submitButton = canvas.getByRole('button', { name: /vérification/i });
		expect(submitButton).toBeInTheDocument();
		expect(submitButton).toBeDisabled();

		// Vérifier que le bouton Annuler est aussi désactivé
		const cancelButton = canvas.getByRole('button', { name: /annuler/i });
		expect(cancelButton).toBeDisabled();

		// Vérifier que l'input est désactivé
		const passwordInput = canvas.getByLabelText(/mot de passe de la room/i);
		expect(passwordInput).toBeDisabled();
	},
};
