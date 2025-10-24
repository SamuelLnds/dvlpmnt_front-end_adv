<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		readPhotos,
		addPhotoFromDataURL,
		removePhotoByTs,
		dataURLFromBlob,
		downloadPhoto,
	} from '$lib/storage/photos';
	import type { PhotoItem } from '$lib/storage/photos';
	import { notifyAndVibrate } from '$lib/device';

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let status = 'Cliquez sur "Activer la caméra" puis "Prendre une photo".';
	let photos: PhotoItem[] = [];

	const JPEG_QUALITY = 0.85;

	onMount(() => {
		photos = readPhotos();
	});

	onDestroy(() => stopCamera());

	async function startCamera() {
		if (stream) return;
		try {
			status = "Demande d'autorisation...";
			stream = await navigator.mediaDevices.getUserMedia({ video: true });
			if (videoEl) {
				videoEl.srcObject = stream;
				await videoEl.play();
			}
			status = 'Caméra active';
		} catch (error) {
			status = `Refusée ou indisponible : ${(error as Error).message}`;
		}
	}

	function stopCamera() {
		stream?.getTracks().forEach((track) => track.stop());
		stream = null;
		if (videoEl) {
			videoEl.srcObject = null;
		}
		status = 'Caméra arrêtée';
	}

	type PhotoNotifyKind = 'taken' | 'downloaded' | 'deleted';

	const TITLES: Record<PhotoNotifyKind, string> = {
		taken: 'Photo enregistrée',
		downloaded: 'Téléchargement lancé',
		deleted: 'Photo supprimée',
	};

	const BODIES: Partial<Record<PhotoNotifyKind, string>> = {
		taken: 'La capture a été effectuée avec succès.',
		downloaded: 'Votre photo est en cours de téléchargement.',
		deleted: 'La photo a été supprimée.',
	};

	async function notify(kind: PhotoNotifyKind) {
		const pattern = kind === 'taken' ? [60, 20, 60] : 100;
		await notifyAndVibrate(TITLES[kind], { body: BODIES[kind] }, pattern);
	}

	async function takePhoto() {
		if (!videoEl) return;
		if (!videoEl.videoWidth) {
			status = "La vidéo n'est pas prête, réessayez dans une seconde.";
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
		addPhotoFromDataURL(dataUrl);
		photos = readPhotos();
		status = 'Photo prise';
		await notify('taken');
	}

	function handleDownload(photo: PhotoItem) {
		downloadPhoto(photo);
		notify('downloaded');
	}

	function handleDelete(photo: PhotoItem) {
		photos = removePhotoByTs(photo.ts);
		notify('deleted');
	}

	$: statusTone = stream
		? 'success'
		: /refusée|indisponible|échec|arrêtée/i.test(status)
		? 'danger'
		: 'warning';
</script>

<section class="surface stack">
	<header class="section-title">
		<div>
			<div class="eyebrow">Laboratoire</div>
			<h1>Test caméra & notifications</h1>
			<p class="muted">Vérifiez la capture locale, les vibrations et la sauvegarde hors ligne.</p>
		</div>
	</header>

	<div class="toast">
		<span
			class={`status-dot${statusTone === 'danger' ? ' status-dot--danger' : statusTone === 'warning' ? ' status-dot--warning' : ''}`}
			aria-hidden="true"
		></span>
		<span>{status}</span>
	</div>

	<div class="field-row">
		<button type="button" class="btn btn--primary" on:click={startCamera} disabled={!!stream}>
			Activer la caméra
		</button>
		<button type="button" class="btn btn--secondary" on:click={takePhoto} disabled={!stream}>
			Prendre une photo
		</button>
		<button type="button" class="btn btn--ghost" on:click={stopCamera} disabled={!stream}>
			Arrêter
		</button>
	</div>

	<div class="camera-frame surface surface--muted">
		<video bind:this={videoEl} playsinline autoplay class="camera-video">
			<track kind="captions" src="" srclang="fr" default />
		</video>
	</div>

	{#if photos.length}
		<article class="card stack">
			<div class="section-title">
				<div>
					<h2>Dernière capture</h2>
					<p class="muted">
						Retrouvez l’ensemble des photos dans la
						<a class="text-link" href="/gallery">galerie</a>.
					</p>
				</div>
			</div>

			<img
				src={photos[0].dataUrl}
				alt="Capture récente"
				class="capture-image"
				loading="lazy"
				decoding="async"
			/>

			<div class="stack">
				<time class="muted" datetime={new Date(photos[0].ts).toISOString()}>
					{new Date(photos[0].ts).toLocaleString()}
				</time>

				<div class="card-actions">
					<button type="button" class="btn btn--ghost" on:click={() => handleDownload(photos[0])}>
						Télécharger
					</button>
					<button type="button" class="btn btn--ghost" on:click={() => handleDelete(photos[0])}>
						Supprimer
					</button>
				</div>
			</div>
		</article>
	{/if}
</section>
