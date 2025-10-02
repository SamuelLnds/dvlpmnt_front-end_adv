<!-- src/routes/camera/+page.svelte -->
<script lang="ts">
	import { onDestroy } from 'svelte';

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let status = 'Clique “Activer la caméra” puis “Prendre une photo”';
	let photos: { url: string; ts: number }[] = [];

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
			// encodage en JPEG
			canvas.toBlob(resolve, 'image/jpeg', 0.92)
		);
		if (!blob) {
			status = 'Échec de la capture';
			return;
		}

		const url = URL.createObjectURL(blob);
		photos = [{ url, ts: Date.now() }, ...photos];
		status = 'Photo prise';
		notify('taken');
	}

    //#region Notifications

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

	// Notifications
	async function notify(kind: PhotoNotifyKind) {
		if (!('Notification' in window)) return;

		// on ne demande la permission que si nécessaire
		const perm =
			Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();

		if (perm === 'granted') {
			new Notification(TITLES[kind], { body: BODIES[kind] });
		}
		// sinon on ne fait rien
	}

    //#endregion

	async function downloadPhoto(p: { url: string; ts: number }) {
		const a = document.createElement('a');
		a.href = p.url;
		a.download = `photo-${p.ts}.jpg`;
		a.click();
        notify('downloaded');
	}

	async function removePhoto(p: { url: string; ts: number }) {
		photos = photos.filter((x) => x !== p);
		URL.revokeObjectURL(p.url);
        notify('deleted');
	}

	// Nettoyage des ressources
	onDestroy(() => {
		stopCamera();
		photos.forEach((p) => URL.revokeObjectURL(p.url));
	});
</script>

<h1>Test caméra + capture + notification</h1>
<p>{status}</p>

<div class="controls">
	<button on:click={startCamera} disabled={!!stream}>Activer la caméra</button>
	<button on:click={takePhoto} disabled={!stream}>Prendre une photo</button>
	<button on:click={stopCamera} disabled={!stream}>Arrêter</button>
</div>

<video
	bind:this={videoEl}
	playsinline
	autoplay
	class="camera-video"
>
	<track kind="captions" src="captions.vtt" srclang="fr" label="French captions" default />
</video>

<h2 class="captures-title">Dernières captures</h2>
<!-- Liste des photos s'il y en a -->
{#if photos.length}
	<div class="photos-grid">
		{#each photos as p}
			<figure class="photo-item">
				<img src={p.url} alt="capture" class="photo-image" />
				<figcaption class="photo-caption">
					{new Date(p.ts).toLocaleString()}
					<!-- téléchargement -->
					<button
						on:click={() => downloadPhoto(p)}
						class="action-button"
					>
						Télécharger
					</button>
					<!-- suppression -->
					<button
						on:click={() => removePhoto(p)}
						class="action-button"
					>
						Supprimer
					</button>
				</figcaption>
			</figure>
		{/each}
	</div>
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

	.photos-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
	}

	.photo-item {
		margin: 0;
	}

	.photo-image {
		width: 100%;
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
