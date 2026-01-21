<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { readProfile, readLastRoom, writeLastRoom } from '$lib/storage/profile';
	import { ensureSeed, upsertRoom, type Room } from '$lib/storage/rooms';
	import { loadingStore } from '$lib/stores/loading';
	import { getSocket, resetSocket } from '$lib/services/socket';
	import { Lock, Users } from 'lucide-svelte';
	import PasswordModal from '$lib/components/PasswordModal.svelte';
	import CreateRoomModal from '$lib/components/CreateRoomModal.svelte';
	import { formatRoomName } from '$lib/utils/format';

	let userPseudo = '';
	let rooms: Room[] = [];
	let roomsLoading = true;
	let customRoom = '';
	let lastRoom = '';

	// Modal state - Password pour rejoindre une room privée
	let passwordModalVisible = false;
	let selectedRoom: Room | null = null;
	let passwordModalRef: InstanceType<typeof PasswordModal> | null = null;
	let passwordError = '';
	let passwordLoading = false;

	// Modal state - Création d'une nouvelle room
	let createRoomModalVisible = false;
	let newRoomId = '';
	let newRoomName = '';

	onMount(() => {
		const profile = readProfile();
		userPseudo = profile.pseudo;
		lastRoom = readLastRoom() || 'general';
		void loadRooms();
	});

	async function loadRooms() {
		roomsLoading = true;
		loadingStore.show('Chargement des rooms...');
		try {
			rooms = await ensureSeed();
		} finally {
			roomsLoading = false;
			loadingStore.hide();
		}
	}

	/**
	 * Vérifie si une room est "nouvelle" (peut être créée avec un mot de passe)
	 * Une room est nouvelle si elle a 0 participants
	 */
	function isNewRoom(room: Room): boolean {
		return room.clientCount === 0;
	}

	/**
	 * Vérifie si un ID de room existe dans la liste fetchée
	 */
	function roomExistsInList(roomId: string): Room | undefined {
		return rooms.find((r) => r.id === roomId.trim().toLowerCase());
	}

	function handleRoomClick(room: Room) {
		if (room.private) {
			// Room privée existante → demander le mot de passe
			selectedRoom = room;
			passwordModalVisible = true;
		} else if (isNewRoom(room)) {
			// Room avec 0 participants → proposer de la créer avec un mot de passe
			newRoomId = room.id;
			newRoomName = room.name;
			createRoomModalVisible = true;
		} else {
			// Room publique avec des participants → rejoindre directement
			void joinRoom(room.id, room.name);
		}
	}

	function handlePasswordSubmit(password: string) {
		if (!selectedRoom) return;
		
		// Vérifier le mot de passe via Socket.IO AVANT de naviguer
		passwordLoading = true;
		passwordError = '';
		
		const socket = getSocket();
		if (!socket.connected) {
			socket.connect();
		}
		
		const profile = readProfile();
		const joinPayload = {
			roomName: selectedRoom.id,
			pseudo: profile.pseudo,
			password
		};
		
		// Écouter la réponse du serveur
		const onJoinedRoom = () => {
			// Succès ! Nettoyer et naviguer
			cleanup();
			passwordLoading = false;
			passwordModalVisible = false;
			
			// Stocker le mot de passe pour la page room
			sessionStorage.setItem(`room.password.${selectedRoom!.id}`, password);
			
			// Mettre à jour le storage et naviguer
			rooms = upsertRoom(selectedRoom!.id, selectedRoom!.name, true);
			writeLastRoom(selectedRoom!.id);
			lastRoom = selectedRoom!.id;
			
			// Déconnecter le socket (la page room va reconnecter)
			socket.disconnect();
			
			void goto(`/room/${encodeURIComponent(selectedRoom!.id)}`);
			selectedRoom = null;
		};
		
		const onError = (message: string) => {
			// Erreur du serveur (mot de passe incorrect)
			cleanup();
			passwordLoading = false;
			passwordError = message;
			// Déconnecter le socket
			socket.disconnect();
		};
		
		const cleanup = () => {
			socket.off('chat-joined-room', onJoinedRoom);
			socket.off('error', onError);
		};
		
		socket.on('chat-joined-room', onJoinedRoom);
		socket.on('error', onError);
		
		// Envoyer la demande de connexion
		socket.emit('chat-join-room', joinPayload);
	}

	function handlePasswordClose() {
		passwordModalVisible = false;
		passwordError = '';
		passwordLoading = false;
		selectedRoom = null;
	}

	function handleCreateRoomSubmit(password: string | null) {
		void joinRoom(newRoomId, newRoomName, password ?? undefined, password !== null);
		createRoomModalVisible = false;
		newRoomId = '';
		newRoomName = '';
	}

	function handleCreateRoomClose() {
		createRoomModalVisible = false;
		newRoomId = '';
		newRoomName = '';
	}

	async function joinRoom(id: string, name?: string, password?: string, isPrivate = false) {
		const roomId = (id ?? '').trim();
		if (!roomId) return;
		loadingStore.show('Connexion à la room...');
		try {
			rooms = upsertRoom(roomId, name, isPrivate);
			writeLastRoom(roomId);
			lastRoom = roomId;
			
			// Stocker le mot de passe dans sessionStorage pour la page room
			if (password) {
				sessionStorage.setItem(`room.password.${roomId}`, password);
			} else {
				sessionStorage.removeItem(`room.password.${roomId}`);
			}
			
			await goto(`/room/${encodeURIComponent(roomId)}`);
		} finally {
			loadingStore.hide();
		}
	}

	function onAddCustom(event: Event) {
		event.preventDefault();
		const trimmedRoom = customRoom.trim();
		if (!trimmedRoom) return;
		
		// Vérifier si la room existe déjà
		const existingRoom = roomExistsInList(trimmedRoom);
		
		if (existingRoom) {
			// Room existante → utiliser le flux normal
			handleRoomClick(existingRoom);
		} else {
			// Nouvelle room → proposer de la créer avec un mot de passe
			newRoomId = trimmedRoom;
			newRoomName = formatRoomName(trimmedRoom);
			createRoomModalVisible = true;
		}
		
		customRoom = '';
	}
</script>

<svelte:head>
	<title>Réception</title>
</svelte:head>

<section class="surface stack">
	<header class="section-title">
		<div>
			<div class="eyebrow">Lobby</div>
			<h1>Réception</h1>
			<p class="muted">
				Bonjour <strong>{userPseudo}</strong> ! Choisissez une room pour commencer.
			</p>
		</div>

		{#if lastRoom}
			<div class="toast">
				<span class="status-dot" aria-hidden="true"></span>
				<div>
					Dernière room : <code>{lastRoom}</code>
				</div>
				<button type="button" class="btn btn--ghost" on:click={() => void joinRoom(lastRoom)}>
					Rejoindre à nouveau
				</button>
			</div>
		{/if}
	</header>

	<article class="card stack room-container">
		<div class="section-title">
			<div>
				<h2>Rooms disponibles</h2>
				<p class="muted">Accédez rapidement aux rooms disponibles.</p>
			</div>
		</div>

		{#if roomsLoading}
			<p class="muted">Chargement des rooms...</p>
		{:else if rooms.length === 0}
			<p class="muted">Aucune room disponible pour le moment.</p>
		{:else}
			<ul class="list">
				{#each rooms as room (room.id)}
					<li class="list-item">
						<div class="list-item__details">
							<div class="room-name">
								{#if room.private}
									<Lock size={16} class="lock-icon" aria-label="Room sécurisée" />
								{/if}
								<strong>{room.name}</strong>
							</div>
							<span class="muted">{room.id}</span>
						</div>
						<div class="list-item__actions">
							<span class="participant-count" title="{room.clientCount} participant(s)">
								<Users size={16} />
								<span>{room.clientCount}</span>
							</span>
							<button
								type="button"
								class="btn btn--ghost"
								on:click={() => handleRoomClick(room)}
							>
								Rejoindre
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</article>

	<form class="card stack" on:submit={onAddCustom}>
		<div class="section-title">
			<div>
				<h2>Rejoindre une room</h2>
				<p class="muted">Indiquez un identifiant pour rejoindre ou créer un espace.</p>
			</div>
		</div>

		<div class="field-row">
			<input
				class="input"
				type="text"
				placeholder="Rejoindre une autre room (id)..."
				bind:value={customRoom}
				aria-label="Nom de la room personnalisée"
			/>
			<button type="submit" class="btn btn--primary">Rejoindre</button>
		</div>
	</form>
</section>

<PasswordModal
	bind:this={passwordModalRef}
	visible={passwordModalVisible}
	roomName={selectedRoom?.name ?? ''}
	error={passwordError}
	loading={passwordLoading}
	onSubmit={handlePasswordSubmit}
	onClose={handlePasswordClose}
/>

<CreateRoomModal
	visible={createRoomModalVisible}
	roomName={newRoomName}
	onSubmit={handleCreateRoomSubmit}
	onClose={handleCreateRoomClose}
/>

<style>
	.list-item {
		align-items: flex-start;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.list-item__details {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
		flex: 1 1 12rem;
	}

	.list-item__details strong,
	.list-item__details .muted {
		overflow-wrap: anywhere;
	}

	.list-item__details .muted {
		font-size: 0.85rem;
	}

	.list-item__actions {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
		margin-left: auto;
	}

	.room-name {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.room-name :global(.lock-icon) {
		color: var(--color-warning);
		flex-shrink: 0;
	}

	.participant-count {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		color: var(--color-text-muted);
		font-size: 0.9rem;
		padding: 0.25rem 0.5rem;
		background: var(--color-bg-muted);
		border-radius: var(--radius-sm);
	}

	.participant-count :global(svg) {
		opacity: 0.8;
	}

	.room-container {
		max-height: 50dvh;
  		overflow: auto;
	}
</style>
