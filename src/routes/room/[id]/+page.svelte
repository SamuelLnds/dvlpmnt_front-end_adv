<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import type { PageData as OriginalPageData } from './$types';
	type PageData = OriginalPageData & { roomId: string };

	import { getSocket, resetSocket, withSocket } from '$lib/socket';
	import { readProfile } from '$lib/storage/profile';
	import { notifyAndVibrate } from '$lib/device';
	import { readPhotos, addPhotoFromDataURL, type PhotoItem } from '$lib/storage/photos';

	import CameraCapture from '$lib/components/CameraCapture.svelte';
	let camRef: InstanceType<typeof CameraCapture> | null = null;

	export let data: PageData;
	const roomId = data.roomId;

	type ChatMsg = {
		content: string;
		dateEmis?: string;
		roomName?: string;
		categorie?: 'MESSAGE' | 'INFO';
		serverId?: string;
		pseudo?: string;
	};

	// --- état chat
	let status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' = 'connecting';
	let messages: ChatMsg[] = [];
	let text = '';
	let joinedAt = 0;
	let username = '';

	// --- helper image
	const isImageDataUrl = (s: string) => /^data:image\//i.test(s);

	// --- picker image
	let pickerOpen = false as boolean;
	let pickerTab: 'menu' | 'file' | 'gallery' | 'camera' = 'menu';
	let selectedDataUrl: string | null = null;
	let selectedKey: string | null = null; // pour gérer la (dé)sélection par clé

	function openPicker() {
		pickerOpen = true;
		pickerTab = 'menu';
		selectedDataUrl = null;
		selectedKey = null;
	}
	function closePicker() {
		pickerOpen = false;
		selectedDataUrl = null;
		selectedKey = null;
		camRef?.close(); // coupe toujours la caméra à la fermeture
	}

	// --- galerie locale
	let photos: PhotoItem[] = [];
	function pickFromGallery(p: PhotoItem) {
		const key = String(p.ts);
		if (selectedKey === key) {
			// toggle -> désélection
			selectedKey = null;
			selectedDataUrl = null;
		} else {
			selectedKey = key;
			selectedDataUrl = p.dataUrl;
		}
	}

	// --- import fichier
	async function onPickFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		selectedDataUrl = await new Promise<string>((res, rej) => {
			reader.onload = () => res(String(reader.result));
			reader.onerror = rej;
			reader.readAsDataURL(file);
		});
		selectedKey = 'file:' + (file.name || Date.now());
		addPhotoFromDataURL(selectedDataUrl);
		photos = readPhotos();
	}

	async function openCameraTab() {
		pickerTab = 'camera';
		await tick();
		camRef?.open();
	}

	function sendSelectedImage() {
		if (!selectedDataUrl) return;
		emitMessage(selectedDataUrl);
		// reset
		selectedDataUrl = null;
		selectedKey = null;
		camRef?.close();
		pickerOpen = false;
	}

	// --- socket & notifications
	onMount(() => {
		const { pseudo } = readProfile();
		photos = readPhotos();

		resetSocket(); // repartir propre quand on entre dans la room

		withSocket((socket) => {
			socket.on('connect', () => {
				status = 'connected';
				joinedAt = Date.now();
				username = pseudo.trim().toLowerCase();
				socket.emit('chat-join-room', { pseudo, roomName: roomId });
			});

			socket.on('disconnect', () => {
				status = 'disconnected';
			});
			socket.io.on('reconnect_attempt', () => {
				status = 'reconnecting';
			});
			socket.on('error', (msg: string) => {
				console.error('Server error:', msg);
			});

			socket.on('chat-msg', (msg: ChatMsg) => {
				messages = [...messages, msg];

				// --- notifications filtrées
				if (msg.categorie === 'INFO') return;
				if ((msg.pseudo ?? 'client').trim().toLowerCase() === username) return;
				const msgDate = msg.dateEmis ? Date.parse(msg.dateEmis) : Date.now();
				if (msgDate < joinedAt) return;

				const body = isImageDataUrl(msg.content)
					? '[Image]'
					: msg.content.length > 100
						? msg.content.slice(0, 100) + '…'
						: msg.content;

				notifyAndVibrate(`Nouveau message de ${msg.pseudo ?? 'client'}`, { body }, [100, 30, 150]);
			});

			if (socket.disconnected) socket.connect();

			// scroll initial
			scrollToBottom(false);
			updateJumpButton();
		});
	});

	onDestroy(() => {
		const s2 = getSocket();
		s2.removeAllListeners();
		s2.disconnect();
		camRef?.close();
	});

	function emitMessage(content: string) {
		const payload: ChatMsg = { content, roomName: roomId, categorie: 'MESSAGE' };
		getSocket().emit('chat-msg', payload);
	}

	function send(e: Event) {
		e.preventDefault();
		const content = text.trim();
		if (!content) return;
		emitMessage(content);
		text = '';
	}

	// --- scroll / jump
	let logEl: HTMLElement;
	let endEl: HTMLDivElement;
	let showJump = false;

	function scrollToBottom(smooth = true) {
		endEl?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
	}
	function isNearBottom(): boolean {
		if (!logEl) return true;
		const gap = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight;
		return gap < 72;
	}
	function updateJumpButton() {
		showJump = !isNearBottom();
	}

	$: (async () => {
		const _len = messages.length;
		if (isNearBottom()) {
			await tick();
			scrollToBottom(true);
		}
		updateJumpButton();
	})();
</script>

<svelte:head><title>Room #{data.roomId}</title></svelte:head>

<main class="wrap">
	<header class="bar">
		<h1># {roomId}</h1>
		<span class="status {status}">{status}</span>
	</header>

	<section class="log" role="log" aria-live="polite" bind:this={logEl} on:scroll={updateJumpButton}>
		{#if messages.length === 0}
			<p class="muted">En attente de messages…</p>
		{/if}
		{#if messages.length > 0}
			{#each messages as m, i}
				<article class="msg">
					<div class="meta">
						<strong>{m.pseudo ?? 'client'}</strong>
						<time>{m.dateEmis ? new Date(m.dateEmis).toLocaleTimeString() : ''}</time>
						{#if m.categorie && m.categorie !== 'MESSAGE'}<em>{m.categorie}</em>{/if}
					</div>

					{#if isImageDataUrl(m.content)}
						<figure class="img-msg">
							<!-- svelte-ignore a11y_img_redundant_alt -->
							<img src={m.content} alt="image envoyée" />
							<figcaption class="muted">
								{new Date(m.dateEmis ?? Date.now()).toLocaleTimeString()}
							</figcaption>
						</figure>
					{:else}
						<p class="text">{m.content}</p>
					{/if}
				</article>
			{/each}
			<div bind:this={endEl} aria-hidden="true"></div>
		{/if}
	</section>

	{#if showJump}
		<button
			class="jump-to-bottom"
			type="button"
			aria-label="Aller au message le plus récent"
			on:click={() => scrollToBottom(true)}
		>
			⬇ Dernier
		</button>
	{/if}

	<!-- Composer -->
	<form class="composer" on:submit={send}>
		<input name="text" bind:value={text} placeholder="Votre message…" autocomplete="off" />
		<div class="actions">
			<button type="button" on:click={openPicker} title="Envoyer une image">📷 Image</button>
			<button type="submit" disabled={status !== 'connected'}>Envoyer</button>
		</div>
	</form>

	<!-- Picker Image -->
	{#if pickerOpen}
		<div class="modal" role="dialog" aria-label="Choisir une image">
			<div class="modal-card">
				<header class="modal-bar">
					<strong>Ajouter une image</strong>
					<button class="ghost" on:click={closePicker} aria-label="Fermer">✕</button>
				</header>

				{#if pickerTab === 'menu'}
					<div class="grid3">
						<button class="btn" on:click={() => (pickerTab = 'file')}>Importer</button>
						<button class="btn" on:click={() => (pickerTab = 'gallery')}>Galerie</button>
						<button class="btn" on:click={openCameraTab}>Caméra</button>
					</div>
				{/if}

				{#if pickerTab === 'file'}
					<div class="file-zone">
						<input type="file" accept="image/*" on:change={onPickFile} />
						{#if selectedDataUrl}
							<div class="preview">
								<img src={selectedDataUrl} alt="aperçu import" />
							</div>
						{/if}
					</div>
				{/if}

				{#if pickerTab === 'gallery'}
					{#if photos.length === 0}
						<p class="muted">Aucune photo locale.</p>
					{:else}
						<ul class="grid">
							{#each photos as p (p.ts)}
								<li>
									<button
										type="button"
										class="thumb {selectedKey === String(p.ts) ? 'selected' : ''}"
										on:click={() => pickFromGallery(p)}
									>
										<img src={p.dataUrl} alt="miniature" />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}

				{#if pickerTab === 'camera'}
					<CameraCapture
						bind:this={camRef}
						quality={0.85}
						facingMode="user"
						mirror={true}
						on:captured={(e) => {
							selectedDataUrl = e.detail;
						}}
					/>
				{/if}

				<footer class="modal-actions">
					<button class="btn primary" on:click={sendSelectedImage} disabled={!selectedDataUrl}>
						Envoyer
					</button>
					{#if selectedDataUrl}
						<button
							class="btn ghost"
							on:click={() => {
								selectedDataUrl = null;
								selectedKey = null;
							}}
						>
							Désélectionner
						</button>
					{/if}
				</footer>
			</div>
		</div>
	{/if}
</main>

<style>
	.wrap {
		position: relative;
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		display: grid;
		gap: 0.75rem;
	}
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.status {
		text-transform: lowercase;
		font-size: 0.9rem;
	}
	.status.connected {
		color: #0a7d25;
	}
	.status.reconnecting {
		color: #b38b00;
	}
	.status.disconnected,
	.status.connecting {
		color: #b81414;
	}

	.log {
		position: relative;
		max-height: 70svh;
		max-width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.jump-to-bottom {
		position: absolute;
		right: 1rem;
		bottom: 4rem;
		padding: 0.4rem 0.6rem;
		border: 1px solid #ddd;
		border-radius: 0.5rem;
		background: #fff;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
		cursor: pointer;
	}
	.jump-to-bottom:hover {
		background: #f7f7f7;
	}

	.muted {
		color: #777;
	}
	.msg {
		border-bottom: 1px solid #f2f2f2;
		padding: 0.5rem 0;
		width: 100%;
		text-wrap: wrap;
	}
	.msg:last-child {
		border-bottom: none;
	}
	.meta {
		display: flex;
		gap: 0.5rem;
		align-items: baseline;
		color: #555;
	}
	.text {
		margin: 0.25rem 0;
		word-wrap: break-word;
	}

	.img-msg img {
		max-width: 280px;
		max-height: 280px;
		border-radius: 0.5rem;
		display: block;
	}
	.img-msg {
		display: grid;
		gap: 0.25rem;
	}

	.composer {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}

	/* Modal */
	.modal {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.35);
		display: grid;
		place-items: center;
		z-index: 50;
	}
	.modal-card {
		background: #fff;
		border-radius: 0.75rem;
		padding: 0.75rem;
		width: min(680px, 96vw);
		display: grid;
		gap: 0.5rem;
	}
	.modal-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.grid3 {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 0.5rem;
	}
	.thumb {
		border: 1px solid #e5e7eb;
		background: #fff;
		border-radius: 0.5rem;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		transition:
			transform 0.06s ease,
			box-shadow 0.12s ease,
			outline-color 0.12s ease;
	}
	.thumb:active {
		transform: scale(0.98);
	}
	.thumb.selected {
		outline: 3px solid #3b82f6;
		outline-offset: 2px;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
	}
	.thumb img {
		width: 100%;
		height: 96px;
		object-fit: cover;
		display: block;
	}
	.thumb:focus-visible {
		outline: 3px solid #3b82f6;
		outline-offset: 2px;
	}

	.file-zone .preview img {
		display: block;
		max-width: 240px;
		max-height: 240px;
		border-radius: 0.5rem;
	}

	.cam-wrap {
		display: grid;
		gap: 0.5rem;
	}

	.btn {
		border: 1px solid #ddd;
		background: #f9f9f9;
		border-radius: 0.5rem;
		cursor: pointer;
		padding: 0.4rem 0.6rem;
	}
	.btn.primary {
		background: #111827;
		color: #fff;
		border-color: #111827;
	}
	.btn.ghost {
		background: transparent;
	}
</style>
