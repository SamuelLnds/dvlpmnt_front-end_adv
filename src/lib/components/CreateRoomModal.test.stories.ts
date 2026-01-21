import type { Meta, StoryObj } from '@storybook/svelte';
import { expect, fn, userEvent, within, waitFor } from 'storybook/test';
import CreateRoomModal from './CreateRoomModal.svelte';

const meta = {
	title: 'Tests/CreateRoomModal',
	component: CreateRoomModal,
	args: {
		visible: true,
		roomName: 'Test Room',
		onSubmit: fn(),
		onClose: fn(),
	},
} satisfies Meta<typeof CreateRoomModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TestCreatePublicRoom: Story = {
	name: '🧪 Test: Création room publique',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Par défaut, la room est publique → cliquer directement sur Créer
		const createButton = canvas.getByRole('button', { name: /créer la room/i });
		await userEvent.click(createButton);

		// Vérifier que onSubmit a été appelée avec null (pas de password)
		expect(args.onSubmit).toHaveBeenCalledWith(null);
	},
};

export const TestCreatePrivateRoom: Story = {
	name: '🧪 Test: Création room privée',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Activer le mode privé via le toggle
		const toggle = canvas.getByRole('checkbox');
		await userEvent.click(toggle);

		// Attendre que les champs de mot de passe apparaissent
		await waitFor(() => {
			expect(canvas.getByLabelText(/mot de passe/i)).toBeInTheDocument();
		});

		// Remplir les champs de mot de passe
		const passwordInput = canvas.getByLabelText(/^mot de passe$/i);
		const confirmInput = canvas.getByLabelText(/confirmer/i);

		await userEvent.type(passwordInput, 'secret123');
		await userEvent.type(confirmInput, 'secret123');

		// Créer la room
		const createButton = canvas.getByRole('button', { name: /créer la room/i });
		await userEvent.click(createButton);

		// Vérifier que onSubmit a été appelée avec le mot de passe
		expect(args.onSubmit).toHaveBeenCalledWith('secret123');
	},
};

export const TestPasswordMismatch: Story = {
	name: '🧪 Test: Mots de passe différents',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Activer le mode privé
		const toggle = canvas.getByRole('checkbox');
		await userEvent.click(toggle);

		// Attendre les champs
		await waitFor(() => {
			expect(canvas.getByLabelText(/mot de passe/i)).toBeInTheDocument();
		});

		// Remplir avec des mots de passe différents
		const passwordInput = canvas.getByLabelText(/^mot de passe$/i);
		const confirmInput = canvas.getByLabelText(/confirmer/i);

		await userEvent.type(passwordInput, 'secret123');
		await userEvent.type(confirmInput, 'different456');

		// Tenter de créer
		const createButton = canvas.getByRole('button', { name: /créer la room/i });
		await userEvent.click(createButton);

		// Vérifier que le message d'erreur apparaît
		await waitFor(() => {
			expect(canvas.getByText(/ne correspondent pas/i)).toBeInTheDocument();
		});

		// onSubmit ne doit PAS avoir été appelée
		expect(args.onSubmit).not.toHaveBeenCalled();
	},
};

export const TestCloseModal: Story = {
	name: '🧪 Test: Fermeture du modal',
	play: async ({ canvasElement, args }) => {
		const canvas = within(canvasElement);

		// Cliquer sur Annuler
		const cancelButton = canvas.getByRole('button', { name: /annuler/i });
		await userEvent.click(cancelButton);

		// Vérifier que onClose a été appelée
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const TestRoomNameDisplay: Story = {
	name: '🧪 Test: Affichage du nom de room',
	args: {
		roomName: 'mon-super-salon',
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);

		// Vérifier que le nom est affiché
		expect(canvas.getByText('mon-super-salon')).toBeInTheDocument();
		// Vérifier l'indication "Nouvelle room"
		expect(canvas.getByText(/nouvelle room/i)).toBeInTheDocument();
	},
};
