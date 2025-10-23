<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		readProfile,
		readLastRoom,
		writeLastRoom,
	} from '$lib/storage/profile';
	import { ensureSeed, upsertRoom, type Room } from '$lib/storage/rooms';

	let userPseudo = '';
	let roomName = '';
	let rooms: Room[] = [];
	let customRoom = '';
	let lastRoom = '';

	onMount(() => {
		const p = readProfile();
		userPseudo = p.pseudo;
		rooms = ensureSeed();
		roomName = readLastRoom() || 'general';
		lastRoom = roomName;
	});

	async function joinRoom(id: string, name?: string) {
		const roomId = (id ?? '').trim();
		if (!roomId) return;
		rooms = upsertRoom(roomId, name);
		writeLastRoom(roomId);
		await goto(`/room/${encodeURIComponent(roomId)}`);
	}

	function onAddCustom(e: Event) {
		e.preventDefault();
		if (!customRoom.trim()) return;
		joinRoom(customRoom.trim());
		customRoom = '';
	}
</script>

<svelte:head><title>Réception</title></svelte:head>

<main class="wrap">
	<h1>Réception</h1>

	<section class="card">
		<p class="hello">Bonjour <strong>{userPseudo}</strong> 👋</p>

		<h2 class="h2">Rooms disponibles</h2>
		{#if rooms.length === 0}
			<p class="muted">Aucune room enregistrée.</p>
		{:else}
			<ul class="rooms">
				{#each rooms as r (r.id)}
					<li class="room">
						<div>
							<strong>{r.name}</strong> <small class="muted">({r.id})</small>
						</div>
						<button class="link" on:click={() => joinRoom(r.id, r.name)}> Rejoindre </button>
					</li>
				{/each}
			</ul>
		{/if}

		<form class="add" on:submit={onAddCustom}>
			<input
				type="text"
				placeholder="Rejoindre une autre room (id)…"
				bind:value={customRoom}
				aria-label="Nom de la room personnalisée"
			/>
			<button type="submit">Rejoindre</button>
		</form>

		{#if lastRoom}
			<div class="last">
				Dernière room : <code>{lastRoom}</code>
				<button class="link" on:click={() => joinRoom(lastRoom)}>Rejoindre à nouveau</button>
			</div>
		{/if}
	</section>
</main>

<style>
	.wrap {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}
	.card {
		border: 1px solid #eee;
		border-radius: 0.5rem;
		padding: 0.75rem;
		background: #fff;
		display: grid;
		gap: 0.75rem;
	}
	.hello {
		margin: 0;
	}
	.h2 {
		font-size: 1.05rem;
		margin: 0.25rem 0;
	}
	.rooms {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.5rem;
	}
	.room {
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-top: 1px solid #f3f3f3;
		padding-top: 0.5rem;
	}
	.room:first-child {
		border-top: none;
		padding-top: 0;
	}
	.muted {
		color: #777;
	}
	.link {
		border: 1px solid #ddd;
		background: #f9f9f9;
		border-radius: 0.5rem;
		cursor: pointer;
		padding: 0.3rem 0.6rem;
	}
	.add {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
	}
	input,
	button {
		padding: 0.5rem 0.75rem;
	}
	.last {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #555;
	}
	code {
		background: #f6f6f6;
		padding: 0.05rem 0.35rem;
		border-radius: 0.25rem;
	}
</style>
