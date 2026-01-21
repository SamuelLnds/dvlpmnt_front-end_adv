<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import CreateRoomModal from './CreateRoomModal.svelte';

	/**
	 * Modal de création d'une nouvelle room.
	 * 
	 * Ce composant permet de créer une room avec ou sans mot de passe :
	 * - Toggle pour activer/désactiver le mode privé
	 * - Champs de mot de passe avec confirmation
	 * - Validation des champs
	 * - Aperçu de la room avec icône dynamique
	 */
	const { Story } = defineMeta({
		title: 'Composants/CreateRoomModal',
		component: CreateRoomModal,
		tags: ['autodocs'],
		args: {
			visible: true,
			roomName: 'Ma Nouvelle Room',
			onSubmit: (password: string | null) => console.log('Room created with password:', password),
			onClose: () => console.log('Modal closed'),
		},
		argTypes: {
			visible: {
				control: 'boolean',
				description: 'Contrôle la visibilité du modal',
			},
			roomName: {
				control: 'text',
				description: 'Nom de la room à créer',
			},
			onSubmit: {
				action: 'onSubmit',
				description: 'Callback appelée lors de la création (password ou null si publique)',
			},
			onClose: {
				action: 'onClose',
				description: 'Callback appelée lors de la fermeture du modal',
			},
		},
	});
</script>

<!-- Story par défaut : modal visible -->
<Story name="État par défaut">
	<CreateRoomModal
		visible={true}
		roomName="discussion-dev"
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>

<!-- Story avec nom de room long -->
<Story name="Nom de room long">
	<CreateRoomModal
		visible={true}
		roomName="une-room-avec-un-nom-tres-long-pour-tester"
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>

<!-- Story masquée -->
<Story name="Modal masqué">
	<div style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
		<p>Le modal est masqué (visible = false)</p>
		<p>Utilisez les contrôles pour le rendre visible.</p>
	</div>
	<CreateRoomModal
		visible={false}
		roomName="Test Room"
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>
