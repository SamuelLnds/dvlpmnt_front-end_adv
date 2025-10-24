<script lang="ts">
	import { onMount } from 'svelte';
	import type { PhotoItem } from '$lib/storage/photos';
	import { readPhotos, removePhotoByTs, downloadPhoto } from '$lib/storage/photos';

	let photos: PhotoItem[] = [];
	let query = '';

	function load() {
		photos = readPhotos();
	}

	function fmt(timestamp: number) {
		return new Date(timestamp).toLocaleString();
	}

	function handleDownload(photo: PhotoItem) {
		downloadPhoto(photo);
	}

	function handleDelete(photo: PhotoItem) {
		photos = removePhotoByTs(photo.ts);
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
