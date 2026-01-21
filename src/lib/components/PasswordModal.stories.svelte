<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PasswordModal from './PasswordModal.svelte';

	/**
	 * Modal de saisie de mot de passe pour les rooms sécurisées.
	 * 
	 * Ce composant affiche un modal avec :
	 * - Une animation de cadenas pulsant
	 * - Un champ de saisie de mot de passe
	 * - Des boutons d'action (Annuler / Déverrouiller)
	 * - Une animation de shake en cas d'erreur
	 * 
	 * Le modal peut être fermé via :
	 * - Le bouton Annuler
	 * - Le bouton X
	 * - Un clic en dehors du modal
	 * - La touche Escape
	 */
	const { Story } = defineMeta({
		title: 'Composants/PasswordModal',
		component: PasswordModal,
		tags: ['autodocs'],
		args: {
			visible: true,
			roomName: 'Private Room',
			onSubmit: (password: string) => console.log('Password submitted:', password),
			onClose: () => console.log('Modal closed'),
		},
		argTypes: {
			visible: {
				control: 'boolean',
				description: 'Contrôle la visibilité du modal',
			},
			roomName: {
				control: 'text',
				description: 'Nom de la room affichée dans le modal',
			},
			onSubmit: {
				action: 'onSubmit',
				description: 'Callback appelée lors de la soumission du mot de passe',
			},
			onClose: {
				action: 'onClose',
				description: 'Callback appelée lors de la fermeture du modal',
			},
		},
	});
</script>

<!-- Story par défaut : modal visible avec room name -->
<Story name="État par défaut">
	<PasswordModal
		visible={true}
		roomName="Salon VIP"
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>

<!-- Story avec nom de room long -->
<Story name="Nom de room long">
	<PasswordModal
		visible={true}
		roomName="Cette-room-a-un-très-long-nom-pour-tester-le-wrapping"
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
	<PasswordModal
		visible={false}
		roomName="Test Room"
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>

<!-- Story avec erreur -->
<Story name="Avec erreur">
	<PasswordModal
		visible={true}
		roomName="Room Secrète"
		error={'Mot de passe incorrect pour la room "Room Secrète".'}
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>

<!-- Story en chargement -->
<Story name="En chargement">
	<PasswordModal
		visible={true}
		roomName="Room Secrète"
		loading={true}
		onSubmit={(password) => console.log('Password:', password)}
		onClose={() => console.log('Closed')}
	/>
</Story>
