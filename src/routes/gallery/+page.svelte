<script lang="ts">
	import { onMount } from 'svelte';
	import type { PhotoItem } from '$lib/storage/photos';
	import { readPhotos, removePhotoByTs, downloadPhoto } from '$lib/storage/photos';
	import { loadingStore } from '$lib/stores/loading';

	let photos: PhotoItem[] = [];
	let query = '';

	function load() {
		loadingStore.show('Chargement de la galerie...');
		try {
			photos = readPhotos();
		} finally {
			loadingStore.hide();
		}
	}

	function fmt(timestamp: number) {
		return new Date(timestamp).toLocaleString();
	}

	function handleDownload(photo: PhotoItem) {
		loadingStore.show('Téléchargement en cours...');
		try {
			downloadPhoto(photo);
		} finally {
			loadingStore.hide();
		}
	}

	function handleDelete(photo: PhotoItem) {
		loadingStore.show('Suppression en cours...');
		try {
			photos = removePhotoByTs(photo.ts);
		} finally {
			loadingStore.hide();
		}
	}

	$: filtered = query.trim()
		? photos.filter((photo) => fmt(photo.ts).toLowerCase().includes(query.trim().toLowerCase()))
		: photos;

	onMount(load);
</script>

<svelte:head>
	<title>Galerie — TP PWA</title>
	<meta name="description" content="Galerie hors-ligne : photos capturées" />
</svelte:head>

<section class="surface stack">
	<header class="section-title">
		<div>
			<div class="eyebrow">Médias</div>
			<h1>Galerie</h1>
			<p class="muted">Consultez et gérez les captures conservées localement.</p>
		</div>
	</header>

	<div class="toolbar" role="search">
		<label class="form-control sr-link">
			<span class="sr-only">Rechercher dans la galerie</span>
			<input
				class="input"
				type="search"
				placeholder="Rechercher par date..."
				bind:value={query}
				aria-label="Rechercher dans la galerie"
			/>
		</label>
		<div class="toolbar__actions">
			<button class="btn btn--ghost" type="button" on:click={load} title="Recharger la galerie">
				Recharger
			</button>
		</div>
	</div>

	{#if filtered.length === 0}
		<p class="muted">Aucune photo enregistrée pour le moment.</p>
	{:else}
		<div class="media-grid" aria-live="polite">
			{#each filtered as photo (photo.ts)}
				<article class="card media-card">
					<div class="media-thumb">
						<img
							src={photo.dataUrl}
							alt={`Capture du ${fmt(photo.ts)}`}
							loading="lazy"
							decoding="async"
						/>
					</div>
					<div class="stack">
						<time class="muted" datetime={new Date(photo.ts).toISOString()}>{fmt(photo.ts)}</time>
						<div class="card-actions">
							<button class="btn btn--ghost" type="button" on:click={() => handleDownload(photo)}>
								Télécharger
							</button>
							<button class="btn btn--ghost" type="button" on:click={() => handleDelete(photo)}>
								Supprimer
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 0.75rem;
		align-items: stretch;
	}

	.media-grid > * {
		height: 100%;
	}

	.media-card {
		gap: 0.75rem;
		height: 100%;
		grid-template-rows: minmax(0, auto) 1fr;
	}

	.media-card .card-actions {
		justify-content: space-around;
	}

	.media-card .stack {
		height: 100%;
		align-content: space-between;
	}
</style>
