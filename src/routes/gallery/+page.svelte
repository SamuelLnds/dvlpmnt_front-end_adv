<script lang="ts">
	import { onMount } from 'svelte';
	import type { PhotoItem } from '$lib/storage/photos';
	import { readPhotos, removePhotoByTs, downloadPhoto } from '$lib/storage/photos';

	let photos: PhotoItem[] = [];
	let q = ''; // recherche locale (sur date formattée)

	function load() {
		photos = readPhotos();
	}

	function fmt(ts: number) {
		// Format local lisible
		return new Date(ts).toLocaleString();
	}

	function handleDownload(p: PhotoItem) {
		downloadPhoto(p);
	}

	function handleDelete(p: PhotoItem) {
		photos = removePhotoByTs(p.ts);
	}

	// filtre   
	$: filtered = q.trim()
		? photos.filter((p) => fmt(p.ts).toLowerCase().includes(q.trim().toLowerCase()))
		: photos;

	onMount(load);
</script>

<svelte:head>
	<title>Galerie — TP PWA</title>
	<meta name="description" content="Galerie hors-ligne : photos capturées" />
</svelte:head>

<main class="wrap">
	<h1 class="h1">Galerie</h1>

	<div class="toolbar" role="search">
		<label>
			<span class="sr-only">Rechercher dans la galerie</span>
			<input
				type="search"
				placeholder="Rechercher (par date)…"
				bind:value={q}
				aria-label="Rechercher dans la galerie"
			/>
		</label>
		<button class="btn" on:click={load} title="Recharger la galerie">Recharger</button>
	</div>

	{#if filtered.length === 0}
		<p class="empty">Aucune photo enregistrée pour le moment.</p>
	{:else}
		<div class="grid" aria-live="polite">
			{#each filtered as p (p.ts)}
				<figure class="card">
					<img
						src={p.dataUrl}
						alt={`Capture du ${fmt(p.ts)}`}
						class="img"
						loading="lazy"
						decoding="async"
					/>
					<figcaption class="caption">
						<time datetime={new Date(p.ts).toISOString()}>{fmt(p.ts)}</time>
						<div class="actions">
							<button class="link" on:click={() => handleDownload(p)}>Télécharger</button>
							<button class="link" on:click={() => handleDelete(p)}>Supprimer</button>
						</div>
					</figcaption>
				</figure>
			{/each}
		</div>
	{/if}
</main>

<style>
	.wrap {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}
	.h1 {
		font-size: 1.5rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
	}
	.toolbar {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 0.75rem;
		flex-wrap: wrap;
	}
	input[type='search'] {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		min-width: 16rem;
	}
	.btn {
		padding: 0.5rem 0.75rem;
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		background: #f9f9f9;
		cursor: pointer;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
	}
	.card {
		margin: 0;
		border: 1px solid #eee;
		border-radius: 0.5rem;
		overflow: hidden;
		background: #fff;
	}
	.img {
		display: block;
		width: 100%;
		height: auto;
	}
	.caption {
		font-size: 0.85rem;
		color: #444;
		padding: 0.5rem;
	}
	.actions {
		display: flex;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}
	.link {
		border: none;
		background: none;
		color: #0366d6;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
	}
	.empty {
		color: #666;
		font-style: italic;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
