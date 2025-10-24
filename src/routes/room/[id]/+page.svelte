<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { ChevronDown, Image as ImageIcon, X } from 'lucide-svelte';
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

	type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
	let status: ConnectionStatus = 'connecting';
	let messages: ChatMsg[] = [];
	let text = '';
	let joinedAt = 0;
	let username = '';

	const statusLabels: Record<ConnectionStatus, string> = {
		connecting: 'Connexion…',
		connected: 'Connecté',
		reconnecting: 'Reconnexion…',
		disconnected: 'Déconnecté',
	};

	$: statusText = statusLabels[status];

	const isImageDataUrl = (value: string) => /^data:image\//i.test(value);

	let pickerOpen = false;
	let pickerTab: 'menu' | 'file' | 'gallery' | 'camera' = 'menu';
	let selectedDataUrl: string | null = null;
	let selectedKey: string | null = null;

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
		camRef?.close();
	}

	let photos: PhotoItem[] = [];

	function pickFromGallery(photo: PhotoItem) {
		const key = String(photo.ts);
		if (selectedKey === key) {
			selectedKey = null;
			selectedDataUrl = null;
		} else {
			selectedKey = key;
			selectedDataUrl = photo.dataUrl;
		}
	}

	async function onPickFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		selectedDataUrl = await new Promise<string>((resolve, reject) => {
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});

		selectedKey = `file:${file.name || Date.now()}`;
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

	onMount(() => {
		const { pseudo } = readProfile();
		photos = readPhotos();

		resetSocket();

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

			socket.on('error', (message: string) => {
				console.error('Server error:', message);
			});

			socket.on('chat-msg', (msg: ChatMsg) => {
				messages = [...messages, msg];

				// si info ou message du user connecté alors pas notif
				if (msg.categorie === 'INFO') return;
				if ((msg.pseudo ?? 'client').trim().toLowerCase() === username) return;

				// si message avant la connexion, pas de notif
				const emissionTs = msg.dateEmis ? Date.parse(msg.dateEmis) : Date.now();
				if (emissionTs < joinedAt) return;

				// notif tronquée si trop longue ou image
				const body = isImageDataUrl(msg.content)
					? '[Image]'
					: msg.content.length > 100
					? `${msg.content.slice(0, 100)}…`
					: msg.content;

				notifyAndVibrate(`Nouveau message de ${msg.pseudo ?? 'client'}`, { body }, [100, 30, 150]);
			});

			if (socket.disconnected) {
				socket.connect();
			}

			scrollToBottom(false);
			updateJumpButton();
		});
	});

	onDestroy(() => {
		const socket = getSocket();
		socket.removeAllListeners();
		socket.disconnect();
		camRef?.close();
	});

	function emitMessage(content: string) {
		const payload: ChatMsg = { content, roomName: roomId, categorie: 'MESSAGE' };
		getSocket().emit('chat-msg', payload);
	}

	function send(event: Event) {
		event.preventDefault();
		const content = text.trim();
		if (!content) return;
		emitMessage(content);
		text = '';
	}

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
		if (isNearBottom()) {
			await tick();
			scrollToBottom(true);
		}
		updateJumpButton();
	})();
</script>

<svelte:head><title>Room #{data.roomId}</title></svelte:head>

<section class="surface stack chat-shell">
	<header class="chat-header">
		<div>
			<div class="eyebrow">Salon</div>
			<h1># {roomId}</h1>
		</div>
		<span class="chat-status" data-state={status}>{statusText}</span>
	</header>

	<section
		class="chat-log"
		role="log"
		aria-live="polite"
		bind:this={logEl}
		on:scroll={updateJumpButton}
	>
		{#if messages.length === 0}
			<p class="muted">En attente de messages.</p>
		{/if}
		{#if messages.length > 0}
			{#each messages as message}
				<article class="chat-message" data-category={message.categorie ?? 'MESSAGE'}>
					<header class="chat-message__meta">
						<strong class="chat-message__author">{message.pseudo ?? 'client'}</strong>
						<time class="chat-message__time">
							{message.dateEmis ? new Date(message.dateEmis).toLocaleTimeString() : ''}
						</time>
						{#if message.categorie && message.categorie !== 'MESSAGE'}
							<span class="badge badge--warning">{message.categorie}</span>
						{/if}
					</header>

					{#if isImageDataUrl(message.content)}
						<figure class="chat-message__image">
							<!-- svelte-ignore a11y_img_redundant_alt -->
							<img src={message.content} alt="Image envoyée" />
							<figcaption class="muted">
								{new Date(message.dateEmis ?? Date.now()).toLocaleTimeString()}
							</figcaption>
						</figure>
					{:else}
						<p class="chat-message__text">{message.content}</p>
					{/if}
				</article>
			{/each}
			<div bind:this={endEl} aria-hidden="true"></div>
		{/if}
	</section>

	{#if showJump}
		<button
			class="chat-jump btn btn--ghost"
			type="button"
			aria-label="Aller au message le plus récent"
			on:click={() => scrollToBottom(true)}
		>
			<ChevronDown size={18} stroke-width={1.5} aria-hidden="true" />
			Dernier
		</button>
	{/if}

	<form class="chat-composer" on:submit={send}>
		<label class="chat-composer__input sr-link">
			<span class="sr-only">Votre message</span>
			<input
				name="text"
				class="input"
				bind:value={text}
				placeholder="Votre message…"
				autocomplete="off"
			/>
		</label>
		<div class="chat-composer__actions">
			<button
				type="button"
				class="btn btn--ghost btn--icon"
				on:click={openPicker}
				title="Envoyer une image"
			>
				<ImageIcon size={20} stroke-width={1.5} aria-hidden="true" />
			</button>
			<button type="submit" class="btn btn--primary" disabled={status !== 'connected'}>
				Envoyer
			</button>
		</div>
	</form>

	{#if pickerOpen}
		<div class="chat-picker" role="dialog" aria-label="Choisir une image">
			<div class="chat-picker__card surface">
				<header class="chat-picker__header">
					<strong>Ajouter une image</strong>
					<button class="btn btn--ghost btn--icon" on:click={closePicker} aria-label="Fermer">
						<X size={20} stroke-width={1.5} aria-hidden="true" />
					</button>
				</header>

				{#if pickerTab === 'menu'}
					<div class="chat-picker__menu">
						<button class="btn btn--ghost" on:click={() => (pickerTab = 'file')}>Importer</button>
						<button class="btn btn--ghost" on:click={() => (pickerTab = 'gallery')}>Galerie</button>
						<button class="btn btn--ghost" on:click={openCameraTab}>Caméra</button>
					</div>
				{/if}

				{#if pickerTab === 'file'}
					<div class="chat-picker__section">
						<input type="file" accept="image/*" on:change={onPickFile} />
						{#if selectedDataUrl}
							<div class="chat-picker__preview">
								<img src={selectedDataUrl} alt="Aperçu import" />
							</div>
						{/if}
					</div>
				{/if}

				{#if pickerTab === 'gallery'}
					<div class="chat-picker__section">
						{#if photos.length === 0}
							<p class="muted">Aucune photo locale.</p>
						{:else}
							<ul class="thumb-grid">
								{#each photos as photo (photo.ts)}
									<li>
										<button
											type="button"
											class={`media-thumb${selectedKey === String(photo.ts) ? ' media-thumb--selected' : ''}`}
											on:click={() => pickFromGallery(photo)}
										>
											<img src={photo.dataUrl} alt="Miniature" />
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}

				{#if pickerTab === 'camera'}
					<div class="chat-picker__section">
						<CameraCapture
							bind:this={camRef}
							quality={0.85}
							facingMode="user"
							mirror={true}
							onCaptured={(dataUrl) => {
								selectedDataUrl = dataUrl;
							}}
						/>
					</div>
				{/if}

				<footer class="chat-picker__footer">
					<button class="btn btn--primary" on:click={sendSelectedImage} disabled={!selectedDataUrl}>
						Envoyer
					</button>
					{#if selectedDataUrl}
						<button
							class="btn btn--ghost"
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
</section>

<style>
	.chat-shell {
		position: relative;
		gap: clamp(1rem, 2vw, 1.5rem);
	}

	.chat-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.chat-status {
		padding: 0.35rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg-muted);
		font-weight: 600;
		font-size: 0.9rem;
		text-transform: capitalize;
	}

	.chat-status[data-state='connected'] {
		background: var(--color-secondary-soft);
		color: var(--color-secondary);
		border-color: transparent;
	}

	.chat-status[data-state='reconnecting'] {
		background: var(--color-warning-soft);
		color: var(--color-warning);
		border-color: transparent;
	}

	.chat-status[data-state='disconnected'] {
		background: var(--color-danger-soft);
		color: var(--color-danger);
		border-color: transparent;
	}

	.chat-log {
		position: relative;
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-bg-muted);
		max-height: min(68vh, 520px);
		overflow-y: auto;
	}

	.chat-message {
		display: grid;
		gap: 0.4rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border);
	}

	.chat-message:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	.chat-message__meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.chat-message__author {
		color: var(--color-text);
		font-size: 0.95rem;
	}

	.chat-message__text {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.chat-message__image {
		display: grid;
		gap: 0.35rem;
	}

	.chat-message__image img {
		max-width: min(320px, 100%);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-soft);
	}

	.chat-jump {
		position: absolute;
		bottom: 8.5rem;
		right: 3rem;
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
	}

	.chat-composer {
		display: flex;
		gap: 0.75rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--color-border);
		background: var(--color-bg-muted);
		padding: 0.75rem;
	}

	.chat-composer__actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.chat-picker {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: var(--color-overlay);
		z-index: 60;
		padding: 1.5rem;
	}

	.chat-picker__card {
		width: min(680px, 96vw);
		display: grid;
		gap: 0.75rem;
	}

	.chat-picker__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.chat-picker__menu {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 0.5rem;
	}

	.chat-picker__section {
		display: grid;
		gap: 0.75rem;
	}

	.chat-picker__preview img {
		max-width: min(280px, 80vw);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-soft);
	}

	.chat-picker__footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.thumb-grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
		gap: 0.6rem;
	}

	@media (max-width: 960px) {
		.chat-header {
			align-items: flex-start;
		}

		.chat-log {
			max-height: min(60vh, 460px);
		}

		.chat-composer__actions {
			flex-wrap: wrap;
			justify-content: flex-end;
		}
	}
</style>
