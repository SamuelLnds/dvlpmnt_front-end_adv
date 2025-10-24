<script lang="ts">
	import { addPhotoFromDataURL } from '$lib/storage/photos';
	import { createEventDispatcher, onDestroy, tick } from 'svelte';

	export let quality = 0.85; // JPEG quality
	export let facingMode: 'user' | 'environment' = 'user';
	export let mirror = true; // mirroring pour selfie

	const dispatch = createEventDispatcher<{
		open: void;
		close: void;
		captured: string; // Data URL
		error: string;
	}>();

	let videoEl: HTMLVideoElement | null = null;
	let stream: MediaStream | null = null;
	let ready = false; // <video> avec dimensions
	let snapshot: string | null = null; // freeze frame après capture
	let isOpen = false; // UI visible (équivalent "showCamera")

	/** Ouvrir la caméra et préchauffer la vidéo */
	export async function open() {
		if (stream) return; // déjà ouverte
		isOpen = true;
		snapshot = null; // reset
		await tick(); // assure le bind <video>

		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode },
				audio: false
			});

			if (videoEl) {
				videoEl.muted = true;
				videoEl.srcObject = stream;
				await new Promise<void>((resolve) => {
					const onReady = () => {
						ready = !!videoEl?.videoWidth;
						videoEl?.removeEventListener('loadedmetadata', onReady);
						videoEl?.removeEventListener('canplay', onReady);
						resolve();
					};
					if (videoEl === null) {
						ready = false;
						return resolve();
					}
					videoEl.addEventListener('loadedmetadata', onReady, { once: true });
					videoEl.addEventListener('canplay', onReady, { once: true });
				});
				await videoEl.play().catch(() => {});
			}
			dispatch('open');
		} catch (e) {
			ready = false;
			close(); // nettoie si partiellement ouvert
			dispatch('error', (e as Error).message);
		}
	}

	/** Fermer la caméra et effacer l’aperçu */
	export function close() {
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		if (videoEl) videoEl.srcObject = null;
		ready = false;
		isOpen = false;
		snapshot = null;
		dispatch('close');
	}

	onDestroy(close);

	/** Capturer un frame et émettre l’événement */
	export function capture() {
		if (!videoEl || !ready) return;
		const canvas = document.createElement('canvas');
		canvas.width = videoEl.videoWidth;
		canvas.height = videoEl.videoHeight;

		const ctx = canvas.getContext('2d')!;
		// miroir visuel si selfie
		if (mirror && facingMode === 'user') {
			ctx.translate(canvas.width, 0);
			ctx.scale(-1, 1);
		}
		ctx.drawImage(videoEl, 0, 0);

		snapshot = canvas.toDataURL('image/jpeg', quality);
        addPhotoFromDataURL(snapshot); // ajout à la galerie
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		if (videoEl) videoEl.srcObject = null;
		ready = false;

		dispatch('captured', snapshot);
	}

	/** Reprendre un nouveau cliché*/
	export async function retake() {
		snapshot = null;
		await open();
	}
</script>

{#if isOpen}
	<div class="cam">
		{#if snapshot}
			<img class="snapshot" src={snapshot} alt="aperçu capture" />
			<div class="row">
				<button type="button" class="btn" on:click={retake}>Reprendre</button>
			</div>
		{:else}
			<video
				bind:this={videoEl}
				playsinline
				autoplay
				class:mirror={mirror && facingMode === 'user'}
			>
				<track kind="captions" />
			</video>
			<div class="row">
				<button type="button" class="btn" on:click={capture} disabled={!ready}>Capturer</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.cam {
		display: grid;
		gap: 0.5rem;
	}
	video,
	.snapshot {
		width: 80%;
		max-width: 100%;
		border-radius: 0.5rem;
		background: #000;
		display: block;
	}
	video.mirror {
		transform: scaleX(-1);
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.btn {
		border: 1px solid var(--color-border);
		background: var(--color-bg-elevated);
		color: var(--color-text);
		border-radius: 0.5rem;
		cursor: pointer;
		padding: 0.45rem 0.8rem;
		transition:
			background var(--transition-medium),
			border-color var(--transition-medium),
			color var(--transition-medium);
	}
	.btn:hover {
		background: var(--color-surface-hover);
	}
	.btn:focus-visible {
		outline: none;
		box-shadow: var(--shadow-ring);
	}
</style>
