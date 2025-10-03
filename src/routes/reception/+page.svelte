<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		readProfile,
		writeProfile,
		readLastRoom,
		writeLastRoom,
		type Profile
	} from '$lib/storage/profile';

	let profile: Profile = { pseudo: '' };
	let roomName = '';

	onMount(() => {
		profile = readProfile();
		roomName = readLastRoom() || 'general';
	});

	async function onSubmit(e: Event) {
		e.preventDefault();
		profile.pseudo = (profile.pseudo ?? '').trim();
		roomName = (roomName ?? '').trim() || 'general';
		writeProfile(profile);
		writeLastRoom(roomName);
		await goto(`/room/${encodeURIComponent(roomName)}`); // nav programmatique
	}
</script>

<svelte:head><title>Réception</title></svelte:head>

<main class="wrap">
	<h1>Réception</h1>
	<form on:submit={onSubmit} class="card">
		<label
			>Pseudo
			<input type="text" bind:value={profile.pseudo} required placeholder="Votre pseudo" />
		</label>
		<label
			>Room
			<input type="text" bind:value={roomName} required placeholder="ex : general" />
		</label>
		<button type="submit">Entrer</button>
	</form>
</main>

<style>
	.wrap {
		max-width: 720px;
		margin: 0 auto;
		padding: 1rem;
	}
	.card {
		display: grid;
		gap: 0.5rem;
		max-width: 420px;
	}
	input,
	button {
		padding: 0.5rem 0.75rem;
	}
</style>
