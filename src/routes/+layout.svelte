<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import Battery from '$lib/components/Battery.svelte';
	import { readProfile } from '$lib/storage/profile';

	let { children } = $props();
	let isSignedIn = $state(false);
	
	onMount(() => {
		const p = readProfile();
		isSignedIn = !!p.pseudo;
	});

</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- <link rel="manifest" href="/manifest.webmanifest" /> -->
</svelte:head>

<nav>
	{#if isSignedIn}
		<a href="/">Home</a>
		<a href="/test">Test</a>
		<a href="/gallery">Galerie</a>
		<a href="/reception">Réception</a>
		<a href="/user">Profil</a>
	{/if}
	<Battery />
</nav>

{@render children?.()}

<style>
	nav {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-around;
		padding: 0.5rem 0;

		& a {
			margin-right: 0.75rem;
		}
	}
</style>
