<!-- src/routes/camera/+page.svelte -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let status = 'Clique “Activer la caméra” puis “Prendre une photo”';

	type PhotoItem = { dataUrl: string; ts: number };
	let photos: PhotoItem[] = [];

	const STORAGE_KEY = 'camera.photos.v1';
	const MAX_ITEMS = 100;
	const JPEG_QUALITY = 0.85;

	// --- utils localStorage ---
	function saveToStorage() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
		} catch (e) {
			console.warn('Stockage saturé ou interdit :', e);
			status = 'Stockage saturé (localStorage)';
		}
	}

	function loadFromStorage() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			photos = raw ? JSON.parse(raw) : [];
		} catch {
			photos = [];
		}
	}

	function blobToDataURL(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

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

	// --- capture + persistance ---
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

		// ▼ conversion en Data URL puis sauvegarde
		const dataUrl = await blobToDataURL(blob);
		const item = { dataUrl, ts: Date.now() };

		photos = [item, ...photos].slice(0, MAX_ITEMS); // borne le nombre d’items
		saveToStorage();

		status = 'Photo prise';
		notify('taken');
	}

	//#region Notifications KISS (une seule fonction)
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
		if (!('Notification' in window)) return;
		const perm =
			Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
		if (perm === 'granted') new Notification(TITLES[kind], { body: BODIES[kind] });
	}
	//#endregion

	// --- téléchargement depuis la Data URL ---
	async function downloadPhoto(p: PhotoItem) {
		const a = document.createElement('a');
		a.href = p.dataUrl;
		a.download = `photo-${p.ts}.jpg`;
		a.click();
		notify('downloaded');
	}

	// --- suppression + persistance ---
	async function removePhoto(p: PhotoItem) {
		photos = photos.filter((x) => x !== p);
		saveToStorage();
		notify('deleted');
	}

	// --- cycle de vie ---
	onMount(() => loadFromStorage());
	onDestroy(() => stopCamera());
</script>

<h1>Test caméra + capture + notification</h1>
<p>{status}</p>

<div class="controls">
	<button on:click={startCamera} disabled={!!stream}>Activer la caméra</button>
	<button on:click={takePhoto} disabled={!stream}>Prendre une photo</button>
	<button on:click={stopCamera} disabled={!stream}>Arrêter</button>
</div>

<video bind:this={videoEl} playsinline autoplay class="camera-video">
    <!-- obligatoire d'avoir un track sinon le linter pète un câble -->
	<track kind="captions" src="" srclang="fr" default />
</video>

<h2 class="captures-title">Dernières captures</h2>

{#if photos.length}
	<div class="photos-grid">
		{#each photos as p}
			<figure class="photo-item">
				<img src={p.dataUrl} alt="capture" class="photo-image" />
				<figcaption class="photo-caption">
					{new Date(p.ts).toLocaleString()}
					<button on:click={() => downloadPhoto(p)} class="action-button">Télécharger</button>
					<button on:click={() => removePhoto(p)} class="action-button">Supprimer</button>
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
