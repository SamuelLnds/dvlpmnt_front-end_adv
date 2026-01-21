<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { ChevronDown, Image as ImageIcon, X, Users, Battery, MapPin, MoreVertical } from 'lucide-svelte';
	import type { PageData as OriginalPageData } from './$types';
	type PageData = OriginalPageData & { roomId: string };

	import { getSocket, resetSocket, withSocket } from '$lib/services/socket';
	import { subscribeToBattery } from '$lib/services/battery';
	import { readProfile, defaultAvatarDataURL, readLocation } from '$lib/storage/profile';
	import { fetchUserImage, uploadUserImage } from '$lib/api/images';
	import defaultAvatarUrl from '$lib/assets/default-avatar.png';
	import { notifyAndVibrate } from '$lib/services/device';
	import { readPhotos, addPhotoFromDataURL, type PhotoItem } from '$lib/storage/photos';

	import CameraCapture from '$lib/components/CameraCapture.svelte';
	import { loadingStore } from '$lib/stores/loading';
	let camRef: InstanceType<typeof CameraCapture> | null = null;

	export let data: PageData;
	const roomId = data.roomId;

	// Liste des participants de la room
	type RoomParticipant = { id: string; pseudo: string };
	let roomParticipants: RoomParticipant[] = [];
	let showParticipants = false;

	type ChatMsg = {
		content: string;
		dateEmis?: string;
		roomName?: string;
		categorie?: 'MESSAGE' | 'INFO' | 'NEW_IMAGE';
		serverId?: string;
		pseudo?: string;
		id?: string;
		socketId?: string;
		clientId?: string;
		avatarDataUrl?: string;
		senderId?: string;
	};

	type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
	let status: ConnectionStatus = 'connecting';
	let messages: ChatMsg[] = [];
	let text = '';
	let joinedAt = 0;
	let username = '';
	let pseudoToSocketId: Record<string, string> = {};
	let clientAvatarKey: Record<string, string> = {};
	let avatarByKey: Record<string, string> = {};
	const pendingAvatarFetch = new Set<string>();
	const pendingAvatarUpload = new Set<string>();
	let defaultAvatar = '';
	const defaultAvatarFallback = defaultAvatarUrl;
	let profilePhotoDataUrl: string | null = null;
	let mySocketId = '';
	let lastSyncedAvatarKey: string | null = null;
	let lastUploadedAvatarData: Record<string, string> = {};

	function normalizePseudo(value?: string | null): string | undefined {
		const trimmed = (value ?? '').trim();
		return trimmed ? trimmed.toLowerCase() : undefined;
	}

	function normalizeSenderId(value?: string | null): string | undefined {
		const raw = (value ?? '').trim();
		if (!raw) return undefined;
		const canonical = raw.replace(/[^A-Za-z0-9].*$/, '');
		return canonical || raw;
	}

	function remoteImageKey(senderId?: string | null, pseudoRaw?: string | null): string | undefined {
		const canonicalId = normalizeSenderId(senderId);
		if (canonicalId) return canonicalId;
		const pseudoKey = normalizePseudo(pseudoRaw);
		if (pseudoKey) return `pseudo:${pseudoKey}`;
		return undefined;
	}

	function resolveSenderId(raw: Partial<ChatMsg>): string | undefined {
		if (!raw) return undefined;
		if (typeof raw.senderId === 'string') return raw.senderId;
		if (typeof raw.id === 'string') return raw.id;
		if (typeof raw.socketId === 'string') return raw.socketId;
		if (typeof raw.clientId === 'string') return raw.clientId;
		const pseudoKey = normalizePseudo(raw.pseudo);
		if (pseudoKey && pseudoKey in pseudoToSocketId) {
			return pseudoToSocketId[pseudoKey];
		}
		return undefined;
	}

	async function ensureDefaultAvatar(): Promise<string> {
		if (defaultAvatar) return defaultAvatar;
		try {
			defaultAvatar = await defaultAvatarDataURL();
		} catch (error) {
			console.warn('ensureDefaultAvatar: failed to load default avatar', error);
			defaultAvatar = '';
		}
		return defaultAvatar;
	}

	async function resolveProfilePhoto(): Promise<string | null> {
		if (profilePhotoDataUrl) return profilePhotoDataUrl;
		const fallback = await ensureDefaultAvatar();
		if (fallback) {
			profilePhotoDataUrl = fallback;
		}
		return profilePhotoDataUrl;
	}

	function resolveAvatarKey(msg: Partial<ChatMsg>): string | undefined {
		const senderId = msg.senderId ?? resolveSenderId(msg);
		if (senderId) {
			const mapped = clientAvatarKey[senderId];
			if (mapped) return mapped;

			const remoteKey = remoteImageKey(senderId, msg.pseudo);
			if (remoteKey) return remoteKey;
		}

		return remoteImageKey(undefined, msg.pseudo);
	}

	function refreshMessageAvatars(): void {
		messages = messages.map((msg) => {
			const nextSenderId = resolveSenderId(msg) ?? msg.senderId;
			const avatarKey = resolveAvatarKey({ ...msg, senderId: nextSenderId });
			const avatar = avatarKey ? avatarByKey[avatarKey] : msg.avatarDataUrl;
			if (nextSenderId === msg.senderId && avatar === msg.avatarDataUrl) {
				return msg;
			}
			return {
				...msg,
				senderId: nextSenderId ?? msg.senderId,
				avatarDataUrl: avatar ?? msg.avatarDataUrl
			};
		});
	}

	async function ensureAvatarForKey(key: string | undefined, force = false) {
		if (!key) return;
		if (key.startsWith('pseudo:')) {
			refreshMessageAvatars();
			return;
		}
		if (avatarByKey[key] && !force) {
			refreshMessageAvatars();
			return;
		}
		if (pendingAvatarFetch.has(key)) {
			if (!force) return;
		}
		pendingAvatarFetch.add(key);
		try {
			const image = await fetchUserImage(key);
			if (!image) return;
			avatarByKey = { ...avatarByKey, [key]: image };
			refreshMessageAvatars();
		} finally {
			pendingAvatarFetch.delete(key);
		}
	}

	async function persistAvatarForKey(key: string | undefined, dataUrl: string | undefined) {
		if (!key || !dataUrl) return;
		if (!isImageDataUrl(dataUrl)) return;
		if (lastUploadedAvatarData[key] === dataUrl) return;
		if (pendingAvatarUpload.has(key)) return;
		pendingAvatarUpload.add(key);
		try {
			const success = await uploadUserImage(key, dataUrl);
			if (success) {
				lastUploadedAvatarData = { ...lastUploadedAvatarData, [key]: dataUrl };
			}
		} finally {
			pendingAvatarUpload.delete(key);
		}
	}

	function indexClients(serverClients: unknown) {
		const next: Record<string, string> = {};
		if (serverClients && typeof serverClients === 'object') {
			for (const [id, data] of Object.entries(serverClients as Record<string, unknown>)) {
				if (typeof id !== 'string') continue;
				const pseudoRaw =
					typeof (data as { pseudo?: unknown })?.pseudo === 'string'
						? (data as { pseudo: string }).pseudo
						: undefined;
				const pseudoKey = normalizePseudo(pseudoRaw);
				if (!pseudoKey) continue;
				if (!(pseudoKey in next)) {
					next[pseudoKey] = id;
				}
				const remoteKey = remoteImageKey(id, pseudoRaw);
				if (remoteKey) {
					clientAvatarKey = { ...clientAvatarKey, [id]: remoteKey };
					void ensureAvatarForKey(remoteKey);
				}
			}
		}
		pseudoToSocketId = next;
		refreshMessageAvatars();
	}

	function dropClient(id: string | undefined, pseudo: string | undefined) {
		if (id && clientAvatarKey[id]) {
			const next = { ...clientAvatarKey };
			delete next[id];
			clientAvatarKey = next;
		}
		const pseudoKey = normalizePseudo(pseudo);
		if (pseudoKey && pseudoToSocketId[pseudoKey] === id) {
			const next = { ...pseudoToSocketId };
			delete next[pseudoKey];
			pseudoToSocketId = next;
		}
		refreshMessageAvatars();
	}

	async function syncProfileAvatar(id: string | undefined, pseudo: string | undefined) {
		const remoteKey = remoteImageKey(id, pseudo);
		if (!remoteKey) return;
		if (lastSyncedAvatarKey === remoteKey) return;
		const photo = await resolveProfilePhoto();
		if (!photo) return;
		const success = await uploadUserImage(remoteKey, photo);
		if (success) {
			lastSyncedAvatarKey = remoteKey;
			lastUploadedAvatarData = { ...lastUploadedAvatarData, [remoteKey]: photo };
			if (id) {
				clientAvatarKey = { ...clientAvatarKey, [id]: remoteKey };
			}
			avatarByKey = { ...avatarByKey, [remoteKey]: photo };
			refreshMessageAvatars();
		}
	}

	function avatarSrcFor(msg: ChatMsg): string {
		const avatarKey = resolveAvatarKey(msg);
		if (avatarKey && avatarByKey[avatarKey]) {
			return avatarByKey[avatarKey];
		}

		if (normalizePseudo(msg.pseudo) === username) {
			return (profilePhotoDataUrl ?? defaultAvatar) || defaultAvatarFallback;
		}

		return defaultAvatar || defaultAvatarFallback;
	}

	const statusLabels: Record<ConnectionStatus, string> = {
		connecting: 'Connexion...',
		connected: 'Connecté',
		reconnecting: 'Reconnexion...',
		disconnected: 'Déconnecté',
	};

	$: statusText = statusLabels[status];

	const isImageDataUrl = (value: string) => /^data:image\//i.test(value);

	// Battery API via service centralisé
	let batterySupported = false;
	let batteryLevel = 1;
	let batteryCharging = false;
	let unsubscribeBattery: (() => void) | null = null;

	function shareBattery() {
		if (!batterySupported) return;
		const percent = Math.round(batteryLevel * 100);
		const chargingText = batteryCharging ? ' (en charge ⚡)' : '';
		const message = `🔋 Batterie : ${percent}%${chargingText}`;
		emitMessage(message);
	}

	// Géolocalisation
	let locationAvailable = false;

	function shareLocation() {
		if (!locationAvailable) return;
		const loc = readLocation();
		if (!loc) return;
		const parts: string[] = [];
		if (loc.city) parts.push(loc.city);
		if (loc.country) parts.push(loc.country);
		const locationText = parts.length > 0 ? parts.join(', ') : `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
		emitMessage(`📍 Je suis à : ${locationText}`);
	}

	// Menu d'actions (responsive)
	let actionsMenuOpen = false;

	function toggleActionsMenu() {
		actionsMenuOpen = !actionsMenuOpen;
	}

	function closeActionsMenu() {
		actionsMenuOpen = false;
	}

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

		loadingStore.show('Chargement de l\'image...');
		try {
			const reader = new FileReader();
			selectedDataUrl = await new Promise<string>((resolve, reject) => {
				reader.onload = () => resolve(String(reader.result));
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});

			selectedKey = `file:${file.name || Date.now()}`;
			addPhotoFromDataURL(selectedDataUrl);
			photos = readPhotos();
		} finally {
			loadingStore.hide();
		}
	}

	async function openCameraTab() {
		pickerTab = 'camera';
		await tick();
		camRef?.open();
	}

	function sendSelectedImage() {
		if (!selectedDataUrl) return;
		const imageToSend = selectedDataUrl;
		loadingStore.show('Envoi de l\'image...');
		try {
			closePicker();
			emitMessage(imageToSend);
		} finally {
			// Le loading se termine après un petit délai pour que l'utilisateur voie le feedback
			setTimeout(() => {
				loadingStore.hide();
			}, 300);
		}
	}

	onMount(() => {
		const profile = readProfile();
		const pseudo = profile.pseudo;
		profilePhotoDataUrl = profile.photoDataUrl ?? null;
		photos = readPhotos();

		// Récupérer le mot de passe depuis sessionStorage (défini par la page reception)
		const roomPassword = sessionStorage.getItem(`room.password.${roomId}`);
		// Nettoyer le mot de passe après récupération (usage unique)
		if (roomPassword) {
			sessionStorage.removeItem(`room.password.${roomId}`);
		}

		void ensureDefaultAvatar();

		// Initialiser Battery via service centralisé
		unsubscribeBattery = subscribeToBattery((state) => {
			batterySupported = state.supported;
			batteryLevel = state.level;
			batteryCharging = state.charging;
		});

		// Vérifier si la géolocalisation est disponible
		const loc = readLocation();
		locationAvailable = loc !== null;

		// Attacher le gestionnaire beforeunload pour déconnecter proprement lors du rechargement
		window.addEventListener('beforeunload', handleBeforeUnload);

		resetSocket();
		messages = [];
		pseudoToSocketId = {};
		clientAvatarKey = {};
		avatarByKey = {};
		pendingAvatarFetch.clear();
		mySocketId = '';
		lastSyncedAvatarKey = null;

		withSocket((socket) => {
			socket.on('connect', async () => {
				status = 'connected';
				joinedAt = Date.now();
				username = normalizePseudo(pseudo) ?? '';
				mySocketId = socket.id ?? '';
				const pseudoKey = normalizePseudo(pseudo);
				if (pseudoKey && mySocketId) {
					pseudoToSocketId = { ...pseudoToSocketId, [pseudoKey]: mySocketId };
				}
				const myRemoteKey = remoteImageKey(mySocketId, pseudo);
				if (myRemoteKey && mySocketId) {
					clientAvatarKey = { ...clientAvatarKey, [mySocketId]: myRemoteKey };
				}
				await syncProfileAvatar(mySocketId, pseudo);
				void ensureAvatarForKey(myRemoteKey);

				// Émettre chat-join-room avec le mot de passe si présent
				const joinPayload: { pseudo: string; roomName: string; password?: string } = {
					pseudo,
					roomName: roomId
				};
				if (roomPassword) {
					joinPayload.password = roomPassword;
				}
				socket.emit('chat-join-room', joinPayload);
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

			socket.on(
				'chat-joined-room',
				(payload: { clients?: Record<string, { pseudo?: string }> }) => {
					indexClients(payload?.clients);
					// Mise à jour de la liste des participants
					if (payload?.clients) {
						roomParticipants = Object.entries(payload.clients).map(([id, data]) => ({
							id,
							pseudo: data.pseudo ?? 'Anonyme'
						}));
					}
				}
			);

			socket.on('chat-disconnected', (payload: { id?: string; pseudo?: string }) => {
				dropClient(payload?.id, payload?.pseudo);
				// Retrait du participant de la liste
				if (payload?.id) {
					roomParticipants = roomParticipants.filter(p => p.id !== payload.id);
				}
			});

			socket.on('chat-msg', (msg: ChatMsg) => {

				const senderId = resolveSenderId(msg);
				const pseudoKey = normalizePseudo(msg.pseudo);
				if (senderId && pseudoKey && pseudoToSocketId[pseudoKey] !== senderId) {
					pseudoToSocketId = { ...pseudoToSocketId, [pseudoKey]: senderId };
				}
				const remoteKey = remoteImageKey(senderId, msg.pseudo);
				if (senderId && remoteKey) {
					clientAvatarKey = { ...clientAvatarKey, [senderId]: remoteKey };
				}
				if (remoteKey) {
					const incomingAvatar = msg.avatarDataUrl;
					if (isImageDataUrl(incomingAvatar ?? '')) {
						if (avatarByKey[remoteKey] !== incomingAvatar) {
							avatarByKey = { ...avatarByKey, [remoteKey]: incomingAvatar as string };
							refreshMessageAvatars();
						}
						void persistAvatarForKey(remoteKey, incomingAvatar as string);
					} else {
						void ensureAvatarForKey(remoteKey, msg.categorie === 'NEW_IMAGE');
					}
				}

				const avatar = remoteKey ? avatarByKey[remoteKey] : msg.avatarDataUrl;
				const next: ChatMsg = {
					...msg,
					senderId: senderId ?? msg.senderId,
					avatarDataUrl: avatar ?? msg.avatarDataUrl
				};
				const shouldStick = isNearBottom();
				messages = [...messages, next];

				if (shouldStick) {
					tick().then(() => {
						scrollToBottom(true);
						updateJumpButton();
					});
				} else {
					updateJumpButton();
				}

				// si info ou message du user connecté alors pas notif
				if (msg.categorie === 'INFO') return;
				if (normalizePseudo(msg.pseudo) === username) return;

				// si message avant la connexion, pas de notif
				const emissionTs = msg.dateEmis ? Date.parse(msg.dateEmis) : Date.now();
				if (emissionTs < joinedAt) return;

				// pas de notif si la page est visible (onglet actif)
				if (document.visibilityState === 'visible') return;

				// notif tronquee si trop longue ou image
				const body = isImageDataUrl(msg.content)
					? '[Image]'
					: msg.content.length > 100
						? `${msg.content.slice(0, 97)}...`
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
		if (!browser) return;
		// Retirer le gestionnaire beforeunload
		window.removeEventListener('beforeunload', handleBeforeUnload);
		// Nettoyage Battery API
		if (unsubscribeBattery) {
			unsubscribeBattery();
			unsubscribeBattery = null;
		}
		// Déconnexion du socket
		const socket = getSocket();
		socket.removeAllListeners();
		socket.disconnect();
		camRef?.close();
	});

	/**
	 * Gestionnaire de fermeture/rechargement de page.
	 * S'assure que le socket est déconnecté proprement avant le rechargement.
	 */
	function handleBeforeUnload() {
		// Déconnecter le socket immédiatement
		const socket = getSocket();
		socket.disconnect();
	}

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
			{#each messages as message, i}
				{@const isOwnMessage = normalizePseudo(message.pseudo) === username}
				{@const prevMessage = messages[i - 1]}
				{@const isSameAuthor = prevMessage && normalizePseudo(prevMessage.pseudo) === normalizePseudo(message.pseudo) && prevMessage.categorie !== 'INFO' && message.categorie !== 'INFO'}
				<article class="chat-message" class:chat-message--own={isOwnMessage} class:chat-message--grouped={isSameAuthor} data-category={message.categorie ?? 'MESSAGE'}>
					{#if !isSameAuthor}
					<header class="chat-message__meta">
						<img
							class="chat-message__avatar"
							src={avatarSrcFor(message)}
							alt={message.pseudo?.charAt(0)?.toUpperCase() ?? '?'}
							loading="lazy"
							decoding="async"
							on:error={(e) => {
								const img = e.currentTarget as HTMLImageElement;
								if (img.src !== defaultAvatarFallback) {
									img.src = defaultAvatarFallback;
								}
							}}
						/>
						<strong class="chat-message__author">{message.pseudo ?? 'client'}</strong>
						{#if isOwnMessage}
							<span class="badge badge--own">Vous</span>
						{/if}
						{#if message.categorie && message.categorie !== 'MESSAGE'}
							<span class="badge badge--warning">{message.categorie}</span>
						{/if}
						<time class="chat-message__time">
							{message.dateEmis ? new Date(message.dateEmis).toLocaleTimeString() : ''}
						</time>
					</header>
					{/if}

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
				placeholder="Votre message"
				autocomplete="off"
			/>
		</label>
		<div class="chat-composer__actions">
			<!-- Boutons visibles sur desktop -->
			<button
				type="button"
				class="btn btn--ghost btn--icon chat-action-desktop"
				on:click={openPicker}
				title="Envoyer une image"
			>
				<ImageIcon size={20} stroke-width={1.5} aria-hidden="true" />
			</button>
			{#if batterySupported}
				<button
					type="button"
					class="btn btn--ghost btn--icon chat-action-desktop"
					on:click={shareBattery}
					title="Partager niveau de batterie"
					disabled={status !== 'connected'}
				>
					<Battery size={20} stroke-width={1.5} aria-hidden="true" />
				</button>
			{/if}
			{#if locationAvailable}
				<button
					type="button"
					class="btn btn--ghost btn--icon chat-action-desktop"
					on:click={shareLocation}
					title="Partager ma position"
					disabled={status !== 'connected'}
				>
					<MapPin size={20} stroke-width={1.5} aria-hidden="true" />
				</button>
			{/if}

			<!-- Menu déroulant sur mobile -->
			<div class="chat-action-mobile">
				<button
					type="button"
					class="btn btn--ghost btn--icon"
					on:click={toggleActionsMenu}
					title="Plus d'actions"
					aria-expanded={actionsMenuOpen}
				>
					<MoreVertical size={20} stroke-width={1.5} aria-hidden="true" />
				</button>
				{#if actionsMenuOpen}
					<div class="chat-actions-dropdown surface" role="menu">
						<button
							type="button"
							class="chat-actions-dropdown__item"
							on:click={() => { openPicker(); closeActionsMenu(); }}
						>
							<ImageIcon size={18} stroke-width={1.5} aria-hidden="true" />
							<span>Image</span>
						</button>
						{#if batterySupported}
							<button
								type="button"
								class="chat-actions-dropdown__item"
								on:click={() => { shareBattery(); closeActionsMenu(); }}
								disabled={status !== 'connected'}
							>
								<Battery size={18} stroke-width={1.5} aria-hidden="true" />
								<span>Batterie ({Math.round(batteryLevel * 100)}%)</span>
							</button>
						{/if}
						{#if locationAvailable}
							<button
								type="button"
								class="chat-actions-dropdown__item"
								on:click={() => { shareLocation(); closeActionsMenu(); }}
								disabled={status !== 'connected'}
							>
								<MapPin size={18} stroke-width={1.5} aria-hidden="true" />
								<span>Position</span>
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<button type="submit" class="btn btn--primary" disabled={status !== 'connected'}>
				Envoyer
			</button>
		</div>
	</form>

	<!-- Liste des participants -->
	<button
		type="button"
		class="participants-toggle btn btn--ghost"
		on:click={() => (showParticipants = !showParticipants)}
		title="Voir les participants"
	>
		<Users size={18} stroke-width={1.5} aria-hidden="true" />
		<span>{roomParticipants.length}</span>
	</button>

	{#if showParticipants}
		<aside class="participants-panel surface">
			<header class="participants-header">
				<strong>Participants ({roomParticipants.length})</strong>
				<button class="btn btn--ghost btn--icon" on:click={() => (showParticipants = false)} aria-label="Fermer">
					<X size={18} stroke-width={1.5} aria-hidden="true" />
				</button>
			</header>
			<ul class="participants-list">
				{#each roomParticipants as participant (participant.id)}
					<li class="participant-item" class:participant-item--self={participant.id === mySocketId}>
						<span class="participant-pseudo">{participant.pseudo}</span>
						{#if participant.id === mySocketId}
							<span class="badge badge--own">Vous</span>
						{/if}
					</li>
				{/each}
			</ul>
		</aside>
	{/if}

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
								<img src={selectedDataUrl} alt="AperÃ§u import" />
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
		max-height: 80dvh;
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

	/* Messages groupés du même auteur */
	.chat-message--grouped {
		padding-top: 0.15rem;
		border-bottom: none;
		margin-top: -0.35rem;
	}

	.chat-message--grouped + .chat-message:not(.chat-message--grouped) {
		margin-top: 0.5rem;
	}

	/* Retirer la bordure du message précédent un groupé */
	.chat-message:has(+ .chat-message--grouped) {
		border-bottom: none;
		padding-bottom: 0.15rem;
	}

	.chat-message__meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		color: var(--color-text-muted);
	}

	.chat-message__avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		object-fit: cover;
		border: 1px solid var(--color-border);
		flex-shrink: 0;
		background: var(--color-primary-soft, #e0e7ff);
		color: var(--color-primary, #6366f1);
		font-size: 0.85rem;
		font-weight: 600;
		text-align: center;
		line-height: 30px;
		overflow: hidden;
		text-overflow: clip;
	}

	.chat-message__author {
		color: var(--color-text);
		font-size: 0.95rem;
	}

	/* Style pour les messages de l'utilisateur connecté */
	.chat-message--own {
		background: var(--color-primary-soft, rgba(99, 102, 241, 0.1));
		border-radius: var(--radius-md);
		padding: 0.75rem;
		border-left: 3px solid var(--color-primary);
	}

	/* Groupement des messages propres */
	.chat-message--own.chat-message--grouped {
		border-radius: 0 0 var(--radius-md) var(--radius-md);
		margin-top: -0.75rem;
		padding-top: 0.25rem;
	}

	.chat-message--own:has(+ .chat-message--own.chat-message--grouped) {
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		padding-bottom: 0.25rem;
	}

	.chat-message--own.chat-message--grouped:has(+ .chat-message--own.chat-message--grouped) {
		border-radius: 0;
	}

	.chat-message--own .chat-message__author {
		color: var(--color-primary);
	}

	.badge--own {
		background: var(--color-primary-soft, rgba(99, 102, 241, 0.15));
		color: var(--color-primary);
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-sm);
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
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
		align-items: center;
	}

	/* Boutons d'actions desktop/mobile */
	.chat-action-desktop {
		display: flex;
	}

	.chat-action-mobile {
		display: none;
		position: relative;
	}

	/* Menu dropdown mobile */
	.chat-actions-dropdown {
		position: absolute;
		bottom: 100%;
		right: 0;
		min-width: 160px;
		margin-bottom: 0.5rem;
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-lg);
		z-index: 70;
		overflow: hidden;
	}

	.chat-actions-dropdown__item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.65rem 0.85rem;
		border: none;
		background: transparent;
		color: var(--color-text);
		font-size: 0.9rem;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
	}

	.chat-actions-dropdown__item:hover:not(:disabled) {
		background: var(--color-bg-muted);
	}

	.chat-actions-dropdown__item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

		/* Sur mobile/tablette : cacher boutons desktop, afficher menu */
		.chat-action-desktop {
			display: none;
		}

		.chat-action-mobile {
			display: block;
		}
	}

	/* Liste des participants */
	.participants-toggle {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		display: flex;
		align-items: center;
		gap: 0.35rem;
		z-index: 50;
	}

	.participants-panel {
		position: fixed;
		bottom: 4rem;
		right: 1rem;
		width: min(280px, 90vw);
		max-height: 300px;
		overflow-y: auto;
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-lg);
		z-index: 55;
	}

	.participants-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.participants-list {
		list-style: none;
		margin: 0;
		padding: 0.5rem;
	}

	.participant-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
	}

	.participant-item--self {
		background: var(--color-primary-soft, rgba(99, 102, 241, 0.1));
	}

	.participant-pseudo {
		font-size: 0.9rem;
	}
</style>
