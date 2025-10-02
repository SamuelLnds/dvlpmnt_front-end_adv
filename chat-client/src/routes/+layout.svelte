<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<nav>
	<a href="/">Home</a>
	<a href="/camera">Caméra</a>
</nav>

{@render children?.()}
