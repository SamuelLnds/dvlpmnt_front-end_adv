<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import type { PageData as OriginalPageData } from './$types';

	type PageData = OriginalPageData & {
		roomId: string;
	};
	import { getSocket, withSocket } from '$lib/socket';
	import { readProfile } from '$lib/storage/profile';

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

	let status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' = 'connecting';
	let messages: ChatMsg[] = [];
	let text = '';

	onMount(() => {
		const { pseudo } = readProfile();

		const s = withSocket((socket) => {
			// branchement des handlers
			socket.on('connect', () => {
				status = 'connected';
				// on rejoint la room à la connexion
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

			// réception d'un message serveur
			socket.on('chat-msg', (msg: ChatMsg) => {
				messages = [...messages, msg];
			});

			// connexion
			if (!socket.connected) socket.connect();

			// on descend en bas à l'arrivée
			scrollToBottom(false);
			updateJumpButton();
		});

		onDestroy(() => {
			const s2 = getSocket();
			s2.off('connect');
			s2.off('disconnect');
			s2.off('error');
			s2.off('chat-msg');
		});
	});

	function send(e: Event) {
		e.preventDefault();
		const content = text.trim();
		if (!content) return;
		const payload: ChatMsg = { content, roomName: roomId, categorie: 'MESSAGE' };
		const s = getSocket();
		s.emit('chat-msg', payload);
		text = '';
	}

	let logEl: HTMLElement; // conteneur scrollable
	let endEl: HTMLDivElement; // sentinel (fin de liste)
	let showJump = false; // affiche le bouton "Dernier" si pas en bas

	function scrollToBottom(smooth = true) {
		endEl?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
	}

	function isNearBottom(): boolean {
		if (!logEl) return true;
		const gap = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight;
		return gap < 72; // seuil ~72px
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
					<p class="text">{m.content}</p>
				</article>
			{/each}
			<!-- Sentinel (fin de liste) -->
			<div bind:this={endEl} aria-hidden="true"></div>
		{/if}

		<!-- Bouton flottant pour aller au dernier message -->
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
	</section>

	<form class="composer" on:submit={send}>
		<input name="text" bind:value={text} placeholder="Votre message…" autocomplete="off" />
		<button type="submit" disabled={status !== 'connected'}>Envoyer</button>
	</form>
</main>

<style>
	.wrap {
		max-width: 800px;
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
		overflow: auto;
	}
	.jump-to-bottom {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
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
	}
	.composer {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
	}
	input,
	button {
		padding: 0.5rem 0.75rem;
	}
</style>
