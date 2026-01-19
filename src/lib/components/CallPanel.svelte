<script lang="ts">
	/**
	 * Panneau flottant de gestion des appels.
	 * Affiche la liste des participants et permet d'initier/recevoir des appels.
	 */
	import { Phone, PhoneOff, PhoneIncoming, PhoneOutgoing, Users, X, User } from 'lucide-svelte';
	import type { CallState, Participant } from '$lib/webrtc';

	// Props avec runes Svelte 5
	let {
		participants = [],
		callState = { phase: 'idle' } as CallState,
		onCall = (_p: Participant) => {},
		onAccept = () => {},
		onReject = () => {},
		onHangup = () => {}
	}: {
		participants: Participant[];
		callState: CallState;
		onCall: (participant: Participant) => void;
		onAccept: () => void;
		onReject: () => void;
		onHangup: () => void;
	} = $props();

	// État d'ouverture du panneau (réduit par défaut)
	let expanded = $state(false);

	// Élément audio pour le flux distant
	let audioEl: HTMLAudioElement | null = $state(null);
	let remoteStream: MediaStream | null = $state(null);

	/**
	 * Attache le flux audio distant à l'élément audio.
	 * Exporté pour être appelé depuis le parent.
	 */
	export function setRemoteStream(stream: MediaStream | null) {
		remoteStream = stream;
		if (audioEl && stream) {
			audioEl.srcObject = stream;
			audioEl.play().catch((e) => console.warn('Lecture audio refusée:', e));
		} else if (audioEl) {
			audioEl.srcObject = null;
		}
	}

	// Label de phase pour l'affichage
	const phaseLabels: Record<CallState['phase'], string> = {
		idle: '',
		outgoing: 'Appel en cours...',
		incoming: 'Appel entrant',
		active: 'En communication'
	};

	function toggle() {
		expanded = !expanded;
	}

	function handleCall(participant: Participant) {
		// Empêcher de s'appeler soi-même
		if (participant.isSelf) return;
		onCall(participant);
	}

	// Ouvre automatiquement le panneau lors d'un appel entrant
	$effect(() => {
		if (callState.phase === 'incoming') {
			expanded = true;
		}
	});
</script>

<!-- Modal plein écran pour appel entrant -->
{#if callState.phase === 'incoming'}
	<div class="call-modal-overlay">
		<div class="call-modal surface">
			<div class="call-modal__icon">
				<PhoneIncoming size={48} />
			</div>
			<h2 class="call-modal__title">Appel entrant</h2>
			<p class="call-modal__caller">{callState.peerPseudo ?? 'Inconnu'}</p>
			<div class="call-modal__actions">
				<button class="call-modal__btn call-modal__btn--accept" onclick={onAccept}>
					<Phone size={24} />
					<span>Accepter</span>
				</button>
				<button class="call-modal__btn call-modal__btn--reject" onclick={onReject}>
					<PhoneOff size={24} />
					<span>Refuser</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Indicateur d'appel actif (bandeau en haut) -->
{#if callState.phase === 'active'}
	<div class="call-active-bar">
		<div class="call-active-bar__info">
			<Phone size={16} />
			<span>En appel avec <strong>{callState.peerPseudo}</strong></span>
		</div>
		<button class="call-active-bar__hangup btn btn--ghost" onclick={onHangup}>
			<PhoneOff size={16} />
			Raccrocher
		</button>
	</div>
{/if}

<aside class="call-panel" class:call-panel--expanded={expanded} class:call-panel--active={callState.phase !== 'idle' && callState.phase !== 'incoming'}>
	<!-- Bouton toggle compact -->
	<button
		class="call-panel__toggle btn btn--ghost btn--icon"
		onclick={toggle}
		aria-expanded={expanded}
		aria-label={expanded ? 'Réduire le panneau d\'appel' : 'Ouvrir le panneau d\'appel'}
	>
		{#if callState.phase === 'incoming'}
			<PhoneIncoming size={20} class="call-panel__icon--incoming" />
		{:else if callState.phase !== 'idle'}
			<Phone size={20} />
		{:else}
			<Users size={20} />
		{/if}
		{#if participants.length > 0 && callState.phase === 'idle'}
			<span class="call-panel__badge">{participants.length}</span>
		{/if}
	</button>

	<!-- Contenu du panneau -->
	{#if expanded}
		<div class="call-panel__content surface">
			<header class="call-panel__header">
				<strong>
					{#if callState.phase === 'idle'}
						Participants ({participants.length})
					{:else}
						{phaseLabels[callState.phase]}
					{/if}
				</strong>
				<button class="btn btn--ghost btn--icon" onclick={toggle} aria-label="Fermer">
					<X size={18} />
				</button>
			</header>

			<!-- Appel entrant (aussi visible dans le panneau) -->
			{#if callState.phase === 'incoming'}
				<div class="call-panel__incoming">
					<p class="call-panel__caller">
						<PhoneIncoming size={18} />
						<span><strong>{callState.peerPseudo}</strong> vous appelle</span>
					</p>
					<div class="call-panel__actions">
						<button class="btn btn--primary call-btn call-btn--accept" onclick={onAccept}>
							<Phone size={18} />
							Accepter
						</button>
						<button class="btn btn--ghost call-btn call-btn--reject" onclick={onReject}>
							<PhoneOff size={18} />
							Refuser
						</button>
					</div>
				</div>
			{/if}

			<!-- Appel sortant -->
			{#if callState.phase === 'outgoing'}
				<div class="call-panel__outgoing">
					<p class="call-panel__status">
						<PhoneOutgoing size={18} />
						<span>Appel vers <strong>{callState.peerPseudo}</strong>...</span>
					</p>
				<button class="btn btn--ghost call-btn call-btn--hangup" onclick={onHangup}>
						<PhoneOff size={18} />
						Annuler
					</button>
				</div>
			{/if}

			<!-- Appel actif -->
			{#if callState.phase === 'active'}
				<div class="call-panel__active">
					<p class="call-panel__status">
						<Phone size={18} />
						<span>En appel avec <strong>{callState.peerPseudo}</strong></span>
					</p>
				<button class="btn btn--ghost call-btn call-btn--hangup" onclick={onHangup}>
						<PhoneOff size={18} />
						Raccrocher
					</button>
				</div>
			{/if}

			<!-- Liste des participants -->
			{#if callState.phase === 'idle'}
				{#if participants.length === 0}
					<p class="call-panel__empty muted">Aucun participant</p>
				{:else}
					<ul class="call-panel__list">
						{#each participants as participant (participant.id)}
							<li class="call-panel__item" class:call-panel__item--self={participant.isSelf}>
								<span class="call-panel__pseudo">
									{participant.pseudo}
									{#if participant.isSelf}
										<span class="call-panel__self-badge">vous</span>
									{/if}
								</span>
								{#if !participant.isSelf}
									<button
										class="btn btn--ghost btn--icon call-panel__call-btn"
										onclick={() => handleCall(participant)}
										title="Appeler {participant.pseudo}"
									>
										<Phone size={16} />
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Élément audio caché pour le flux distant -->
	<audio bind:this={audioEl} autoplay></audio>
</aside>

<style>
	/* Modal plein écran pour appel entrant */
	.call-modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		z-index: 100;
		display: grid;
		place-items: center;
		padding: 1rem;
		animation: fade-in 0.2s ease-out;
	}

	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.call-modal {
		width: min(360px, 90vw);
		padding: 2rem;
		border-radius: var(--radius-lg);
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		animation: slide-up 0.3s ease-out;
	}

	@keyframes slide-up {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	.call-modal__icon {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--color-secondary-soft);
		color: var(--color-secondary);
		display: grid;
		place-items: center;
		animation: ring-large 1s ease-in-out infinite;
	}

	@keyframes ring-large {
		0%, 100% { transform: rotate(0deg) scale(1); }
		10% { transform: rotate(-15deg) scale(1.05); }
		20% { transform: rotate(15deg) scale(1.05); }
		30% { transform: rotate(-15deg) scale(1); }
		40% { transform: rotate(15deg) scale(1); }
		50%, 100% { transform: rotate(0deg) scale(1); }
	}

	.call-modal__title {
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text-muted);
	}

	.call-modal__caller {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.call-modal__actions {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}

	.call-modal__btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem 1.5rem;
		border-radius: var(--radius-md);
		border: none;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: transform var(--transition-fast), filter var(--transition-fast);
	}

	.call-modal__btn:hover {
		transform: scale(1.05);
	}

	.call-modal__btn--accept {
		background: var(--color-secondary);
		color: var(--color-secondary-contrast);
	}

	.call-modal__btn--reject {
		background: var(--color-danger);
		color: var(--color-danger-contrast);
	}

	/* Bandeau d'appel actif */
	.call-active-bar {
		position: fixed;
		top: var(--nav-height, 64px);
		left: 0;
		right: 0;
		z-index: 45;
		background: var(--color-secondary);
		color: var(--color-secondary-contrast);
		padding: 0.5rem 1rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		animation: slide-down 0.2s ease-out;
	}

	@keyframes slide-down {
		from { transform: translateY(-100%); }
		to { transform: translateY(0); }
	}

	.call-active-bar__info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.call-active-bar__hangup {
		color: inherit;
		border-color: rgba(255, 255, 255, 0.3);
	}

	.call-active-bar__hangup:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Panneau latéral */
	.call-panel {
		position: fixed;
		right: 0;
		top: 50%;
		transform: translateY(-50%);
		z-index: 50;
		display: flex;
		flex-direction: row;
		align-items: flex-start;
		max-height: 80vh;
		pointer-events: none;
	}

	.call-panel > * {
		pointer-events: auto;
	}

	.call-panel__toggle {
		position: relative;
		border-radius: var(--radius-md) 0 0 var(--radius-md);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-right: none;
		padding: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		transition: background var(--transition-fast);
		flex-shrink: 0;
	}

	.call-panel__toggle:hover {
		background: var(--color-surface-hover);
	}

	.call-panel--expanded .call-panel__toggle {
		border-radius: var(--radius-md) 0 0 0;
	}

	.call-panel__badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 18px;
		height: 18px;
		padding: 0 4px;
		border-radius: 9px;
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		font-size: 0.7rem;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	/* Animation pour appel en cours (pas incoming car on a la modal) */
	.call-panel--active .call-panel__toggle {
		background: var(--color-accent-soft);
		animation: pulse-call 1.5s ease-in-out infinite;
	}

	@keyframes pulse-call {
		0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
		50% { box-shadow: 0 0 0 8px rgba(99, 102, 241, 0); }
	}

	:global(.call-panel__icon--incoming) {
		color: var(--color-secondary);
		animation: ring 0.5s ease-in-out infinite;
	}

	@keyframes ring {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-15deg); }
		75% { transform: rotate(15deg); }
	}

	.call-panel__content {
		width: min(280px, 85vw);
		max-height: calc(80vh - 2rem);
		overflow-y: auto;
		border-radius: 0 0 0 var(--radius-md);
		border: 1px solid var(--color-border);
		border-right: none;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	/* Désactiver le hover global de .surface pour ce composant */
	.call-panel__content:hover {
		background: var(--color-surface);
	}

	.call-modal:hover {
		background: var(--color-surface);
	}

	.call-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.call-panel__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.call-panel__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: background var(--transition-fast);
	}

	.call-panel__item:hover:not(.call-panel__item--self) {
		background: var(--color-surface-hover);
	}

	.call-panel__item--self {
		background: var(--color-accent-soft);
		cursor: default;
	}

	.call-panel__pseudo {
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.call-panel__self-badge {
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-xs);
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		font-weight: 500;
	}

	:global(.call-panel__self-icon) {
		color: var(--color-text-muted);
	}

	.call-panel__call-btn {
		flex-shrink: 0;
		color: var(--color-secondary);
	}

	.call-panel__call-btn:hover {
		background: var(--color-secondary-soft);
	}

	.call-panel__empty {
		text-align: center;
		padding: 1rem 0;
		font-size: 0.85rem;
	}

	.call-panel__incoming,
	.call-panel__outgoing,
	.call-panel__active {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.call-panel__caller,
	.call-panel__status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
		font-size: 0.9rem;
	}

	.call-panel__actions {
		display: flex;
		gap: 0.5rem;
	}

	.call-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.85rem;
	}

	.call-btn--accept {
		background: var(--color-secondary);
		color: var(--color-secondary-contrast);
	}

	.call-btn--accept:hover {
		background: var(--color-secondary);
		filter: brightness(1.1);
	}

	.call-btn--reject,
	.call-btn--hangup {
		color: var(--color-danger);
	}

	.call-btn--reject:hover,
	.call-btn--hangup:hover {
		background: var(--color-danger-soft);
	}

	/* Responsive */
	@media (max-width: 600px) {
		.call-panel {
			top: auto;
			bottom: 120px;
			transform: none;
		}

		.call-panel__content {
			max-height: 50vh;
		}

		.call-active-bar {
			flex-wrap: wrap;
			justify-content: center;
			text-align: center;
		}
	}
</style>
