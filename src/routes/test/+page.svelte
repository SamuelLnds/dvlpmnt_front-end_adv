<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		readPhotos,
		writePhotos,
		addPhotoFromDataURL,
		removePhotoByTs,
		dataURLFromBlob,
		downloadPhoto
	} from '$lib/storage/photos';
	import type { PhotoItem } from '$lib/storage/photos';
	import { notifyAndVibrate } from '$lib/device';

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let status = 'Clique “Activer la caméra” puis “Prendre une photo”';

	let photos: PhotoItem[] = [];

	const JPEG_QUALITY = 0.85;

	// --- cycle de vie / init ---
	onMount(() => {
		photos = readPhotos();
	});
	onDestroy(() => stopCamera());

	// --- caméra ---
	async function startCamera() {
		if (stream) return;
		try {
			status = 'Demande d’autorisation…';
			stream = await navigator.mediaDevices.getUserMedia({ video: true });
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play();
			}
			status = 'Caméra active';
		} catch (e) {
			status = `Refusé / indisponible : ${(e as Error).message}`;
		}
	}

	function stopCamera() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		if (videoEl) videoEl.srcObject = null;
		status = 'Caméra arrêtée';
	}

	// --- notifications ---
	type PhotoNotifyKind = 'taken' | 'downloaded' | 'deleted';
	const TITLES: Record<PhotoNotifyKind, string> = {
		taken: 'Photo enregistrée',
		downloaded: 'Téléchargement lancé',
		deleted: 'Photo supprimée'
	};
	const BODIES: Partial<Record<PhotoNotifyKind, string>> = {
		taken: 'La capture a été effectuée avec succès.',
		downloaded: 'Votre photo est en cours de téléchargement.',
		deleted: 'La photo a été supprimée.'
	};
	async function notify(kind: PhotoNotifyKind) {
		// vibration courte et reconnaissable
		const pattern = kind === 'taken' ? [60, 20, 60] : 100;
		await notifyAndVibrate(TITLES[kind], { body: BODIES[kind] }, pattern);
	}

	// --- capture + persistance via lib ---
	async function takePhoto() {
		if (!videoEl) return;
		if (!videoEl.videoWidth) {
			status = 'La vidéo n’est pas prête — réessaie dans 1s';
			return;
		}
		const canvas = document.createElement('canvas');
		canvas.width = videoEl.videoWidth;
		canvas.height = videoEl.videoHeight;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(videoEl, 0, 0);

		const blob: Blob | null = await new Promise((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
		);
		if (!blob) {
			status = 'Échec de la capture';
			return;
		}

		const dataUrl = await dataURLFromBlob(blob);

		// Lib: ajoute + persiste + retourne l'item
		const item = addPhotoFromDataURL(dataUrl);

		// Recharger l'état local (source de vérité = localStorage géré par lib)
		photos = readPhotos();
		status = 'Photo prise';
		notify('taken');
	}

	// --- actions galerie ---
	function handleDownload(p: PhotoItem) {
		downloadPhoto(p);
		notify('downloaded');
	}
	function handleDelete(p: PhotoItem) {
		photos = removePhotoByTs(p.ts);
		notify('deleted');
	}
</script>

<h1>Test caméra + capture + notification</h1>
<p>{status}</p>

<div class="controls">
	<button on:click={startCamera} disabled={!!stream}>Activer la caméra</button>
	<button on:click={takePhoto} disabled={!stream}>Prendre une photo</button>
	<button on:click={stopCamera} disabled={!stream}>Arrêter</button>
</div>

<video bind:this={videoEl} playsinline autoplay class="camera-video">
	<!-- track pour le linter -->
	<track kind="captions" src="" srclang="fr" default />
</video>

{#if photos.length}
	<h2 class="captures-title">Dernière capture</h2>
	<p>
		Tu peux aussi aller voir la page <a href="/gallery">Galerie</a> qui liste toutes les photos enregistrées.
	</p>
	<figure class="photo-item">
		<img src={photos[0].dataUrl} alt="capture" class="photo-image" />
		<figcaption class="photo-caption">
			{new Date(photos[0].ts).toLocaleString()}
			<button on:click={() => handleDownload(photos[0])} class="action-button">Télécharger</button>
			<button on:click={() => handleDelete(photos[0])} class="action-button">Supprimer</button>
		</figcaption>
	</figure>
{/if}

<style>
	.controls {
		display: flex;
		gap: 0.5rem;
		margin: 0.75rem 0;
		flex-wrap: wrap;
	}
	.camera-video {
		width: 100%;
		max-width: 640px;
		background: #000;
		border-radius: 12px;
	}
	.captures-title {
		margin-top: 1rem;
	}
	.photo-item {
		margin: 0;
	}
	.photo-image {
		width: 100%;
		max-width: 250px;
		border-radius: 8px;
		display: block;
	}
	.photo-caption {
		font-size: 0.8rem;
		color: #666;
	}
	.action-button {
		border: none;
		background: none;
		color: inherit;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font: inherit;
	}
</style>
