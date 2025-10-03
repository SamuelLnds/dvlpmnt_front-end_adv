<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import Battery from '$lib/components/Battery.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- <link rel="manifest" href="/manifest.webmanifest" /> -->
</svelte:head>

<nav>
	<a href="/">Home</a>
	<a href="/test">Test</a>
	<a href="/gallery">Galerie</a>
	<a href="/reception">Réception</a>
	<Battery />
</nav>

{@render children?.()}

<style>
	nav {
		display: flex;
		gap: 1rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0;

		& a {
			margin-right: 0.75rem;
		}
	}
</style>
