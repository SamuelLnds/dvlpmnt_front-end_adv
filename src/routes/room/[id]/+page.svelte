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
			<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
				<path
					d="M6 9l6 6 6-6"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			</svg>
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
				<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M4.5 7.5A3 3 0 0 1 7.5 4.5h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
					/>
					<path
						d="M9 11.25l2.25 2.25 3-3 3 3"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
					<circle cx="9" cy="8.25" r="1" fill="currentColor" />
				</svg>
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
						<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<path
								d="M6 6l12 12M6 18L18 6"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
							/>
						</svg>
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
							on:captured={(event) => {
								selectedDataUrl = event.detail;
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
