<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { readProfile, readLastRoom, writeLastRoom } from '$lib/storage/profile';
	import { ensureSeed, upsertRoom, type Room } from '$lib/storage/rooms';
	import { loadingStore } from '$lib/stores/loading';

	let userPseudo = '';
	let rooms: Room[] = [];
	let roomsLoading = true;
	let customRoom = '';
	let lastRoom = '';

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

	async function joinRoom(id: string, name?: string) {
		const roomId = (id ?? '').trim();
		if (!roomId) return;
		loadingStore.show('Connexion à la room...');
		try {
			rooms = upsertRoom(roomId, name);
			writeLastRoom(roomId);
			lastRoom = roomId;
			await goto(`/room/${encodeURIComponent(roomId)}`);
		} finally {
			loadingStore.hide();
		}
	}

	function onAddCustom(event: Event) {
		event.preventDefault();
		if (!customRoom.trim()) return;
		void joinRoom(customRoom.trim());
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
							<strong>{room.name}</strong>
							<span class="muted">{room.id}</span>
						</div>
						<button
							type="button"
							class="btn btn--ghost"
							on:click={() => void joinRoom(room.id, room.name)}
						>
							Rejoindre
						</button>
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

<style>
	.list-item {
		align-items: flex-start;
		justify-content: flex-start;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.list-item button {
		flex-shrink: 0;
		margin-left: auto;
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

	.room-container {
		max-height: 50dvh;
  		overflow: auto;
	}
</style>
