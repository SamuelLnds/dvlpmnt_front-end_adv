<script lang="ts">
	/**
	 * Panneau de conférence audio multi-participants.
	 * Remplace CallPanel pour gérer les conférences "opt-in" au lieu des appels 1-1.
	 */
	import { Mic, MicOff, Users, X, Radio, Volume2, LogIn, LogOut } from 'lucide-svelte';
	import type { ConferenceState, ConferenceParticipant } from '$lib/services/conference';

	// Props avec runes Svelte 5
	let {
		participants = [],
		conferenceState = { phase: 'idle', conferenceId: null, participants: [] } as ConferenceState,
		onJoin = () => {},
		onLeave = () => {}
	}: {
		participants: ConferenceParticipant[];
		conferenceState: ConferenceState;
		onJoin: () => void;
		onLeave: () => void;
	} = $props();

	// État d'ouverture du panneau
	let expanded = $state(false);

	// Éléments audio pour les flux distants (un par peer)
	let audioElements: Map<string, HTMLAudioElement> = $state(new Map());

	/**
	 * Attache un flux audio distant à un élément audio.
	 */
	export function setRemoteStream(peerId: string, stream: MediaStream | null) {
		if (stream) {
			let audioEl = audioElements.get(peerId);
			if (!audioEl) {
				audioEl = document.createElement('audio');
				audioEl.autoplay = true;
				audioElements.set(peerId, audioEl);
			}
			audioEl.srcObject = stream;
			audioEl.play().catch((e) => console.warn('Lecture audio refusée:', e));
		} else {
			const audioEl = audioElements.get(peerId);
			if (audioEl) {
				audioEl.srcObject = null;
				audioElements.delete(peerId);
			}
		}
	}

	// Track si l'utilisateur a manuellement fermé le panneau
	let userClosedPanel = $state(false);

	function toggle() {
		expanded = !expanded;
		// Marquer que l'utilisateur a fermé manuellement
		if (!expanded) {
			userClosedPanel = true;
		}
	}

	// Dérivations réactives
	let isInConference = $derived(conferenceState.phase === 'joined');
	let hasActiveConference = $derived(
		conferenceState.phase === 'active_not_joined' ||
		conferenceState.phase === 'joined' ||
		conferenceState.phase === 'joining'
	);
	let conferenceParticipantCount = $derived(conferenceState.participants.length);
	let isJoining = $derived(conferenceState.phase === 'joining');
	let isLeaving = $derived(conferenceState.phase === 'leaving');

	// Label pour l'état
	const phaseLabels: Record<ConferenceState['phase'], string> = {
		idle: 'Pas de conférence',
		active_not_joined: 'Conférence en cours',
		joining: 'Connexion...',
		joined: 'En conférence',
		leaving: 'Déconnexion...',
		error: 'Erreur'
	};

	$effect(() => {
		// Ouvrir automatiquement si une conf devient active
		// Sauf si l'utilisateur a explicitement fermé le panneau
		if (hasActiveConference && !expanded && !userClosedPanel) {
			expanded = true;
		}
		// Reset du flag quand la conf se termine
		if (!hasActiveConference) {
			userClosedPanel = false;
		}
	});
</script>

<!-- Bandeau de conférence active -->
{#if isInConference}
	<div class="conference-bar">
		<div class="conference-bar__info">
			<Radio size={16} class="conference-bar__icon" />
			<span>Conférence audio • <strong>{conferenceParticipantCount}</strong> participant{conferenceParticipantCount > 1 ? 's' : ''}</span>
		</div>
		<button class="conference-bar__leave btn btn--ghost" onclick={onLeave} disabled={isLeaving}>
			<LogOut size={16} />
			Quitter
		</button>
	</div>
{/if}

<aside class="conference-panel" class:conference-panel--expanded={expanded} class:conference-panel--active={isInConference}>
	<!-- Bouton toggle compact -->
	<button
		class="conference-panel__toggle btn btn--ghost btn--icon"
		onclick={toggle}
		aria-expanded={expanded}
		aria-label={expanded ? 'Réduire le panneau' : 'Ouvrir le panneau'}
	>
		{#if isInConference}
			<Radio size={20} />
		{:else if hasActiveConference}
			<Volume2 size={20} class="conference-panel__icon--active" />
		{:else}
			<Users size={20} />
		{/if}
		{#if participants.length > 0}
			<span class="conference-panel__badge">{participants.length}</span>
		{/if}
	</button>

	<!-- Contenu du panneau -->
	{#if expanded}
		<div class="conference-panel__content surface">
			<header class="conference-panel__header">
				<strong>
					{phaseLabels[conferenceState.phase]}
					{#if hasActiveConference}
						<span class="conference-panel__count">({conferenceParticipantCount})</span>
					{/if}
				</strong>
				<button class="btn btn--ghost btn--icon" onclick={toggle} aria-label="Fermer">
					<X size={18} />
				</button>
			</header>

			<!-- Actions de conférence -->
			<div class="conference-panel__actions">
				{#if !isInConference}
					<button
						class="btn btn--primary conference-btn"
						onclick={onJoin}
						disabled={isJoining}
					>
						{#if isJoining}
							<Mic size={18} class="animate-pulse" />
							Connexion...
						{:else if hasActiveConference}
							<LogIn size={18} />
							Rejoindre la conférence
						{:else}
							<Mic size={18} />
							Démarrer une conférence
						{/if}
					</button>
				{:else}
					<button
						class="btn btn--ghost conference-btn conference-btn--leave"
						onclick={onLeave}
						disabled={isLeaving}
					>
						<MicOff size={18} />
						{isLeaving ? 'Déconnexion...' : 'Quitter la conférence'}
					</button>
				{/if}
			</div>

			<!-- Liste des participants -->
			{#if participants.length === 0}
				<p class="conference-panel__empty muted">Aucun participant dans la room</p>
			{:else}
				<ul class="conference-panel__list">
					{#each participants as participant (participant.id)}
						<li class="conference-panel__item" class:conference-panel__item--self={participant.isSelf} class:conference-panel__item--in-conf={participant.inConference}>
							<span class="conference-panel__pseudo">
								{#if participant.inConference}
									<span class="conference-panel__indicator" title="Dans la conférence"></span>
								{/if}
								{participant.pseudo}
								{#if participant.isSelf}
									<span class="conference-panel__self-badge">vous</span>
								{/if}
							</span>
							{#if participant.inConference && !participant.isSelf}
								<Volume2 size={14} class="conference-panel__speaking" />
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<!-- Erreur -->
			{#if conferenceState.phase === 'error' && conferenceState.error}
				<p class="conference-panel__error">{conferenceState.error}</p>
			{/if}
		</div>
	{/if}
</aside>

<style>
	/* Bandeau de conférence active */
	.conference-bar {
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

	.conference-bar__info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	:global(.conference-bar__icon) {
		animation: pulse-radio 1.5s ease-in-out infinite;
	}

	@keyframes pulse-radio {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.conference-bar__leave {
		color: inherit;
		border-color: rgba(255, 255, 255, 0.3);
	}

	.conference-bar__leave:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	/* Panneau latéral */
	.conference-panel {
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

	.conference-panel > * {
		pointer-events: auto;
	}

	.conference-panel__toggle {
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

	.conference-panel__toggle:hover {
		background: var(--color-surface-hover);
	}

	.conference-panel--expanded .conference-panel__toggle {
		border-radius: var(--radius-md) 0 0 0;
	}

	.conference-panel__badge {
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

	.conference-panel--active .conference-panel__toggle {
		background: var(--color-secondary-soft);
		animation: pulse-conf 1.5s ease-in-out infinite;
	}

	@keyframes pulse-conf {
		0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
		50% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
	}

	:global(.conference-panel__icon--active) {
		color: var(--color-secondary);
		animation: pulse-radio 1s ease-in-out infinite;
	}

	.conference-panel__content {
		width: min(300px, 85vw);
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

	.conference-panel__content:hover {
		background: var(--color-surface);
	}

	.conference-panel__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.conference-panel__count {
		color: var(--color-text-muted);
		font-weight: normal;
	}

	.conference-panel__actions {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.conference-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
	}

	.conference-btn--leave {
		color: var(--color-danger);
	}

	.conference-btn--leave:hover {
		background: var(--color-danger-soft);
	}

	.conference-panel__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.conference-panel__item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		border-radius: var(--radius-sm);
		transition: background var(--transition-fast);
	}

	.conference-panel__item--self {
		background: var(--color-accent-soft);
	}

	.conference-panel__item--in-conf {
		background: var(--color-secondary-soft);
	}

	.conference-panel__item--self.conference-panel__item--in-conf {
		background: linear-gradient(135deg, var(--color-accent-soft), var(--color-secondary-soft));
	}

	.conference-panel__pseudo {
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.conference-panel__indicator {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-secondary);
		animation: pulse-indicator 1.5s ease-in-out infinite;
		flex-shrink: 0;
	}

	@keyframes pulse-indicator {
		0%, 100% { transform: scale(1); opacity: 1; }
		50% { transform: scale(1.2); opacity: 0.7; }
	}

	.conference-panel__self-badge {
		font-size: 0.7rem;
		padding: 0.1rem 0.4rem;
		border-radius: var(--radius-xs);
		background: var(--color-accent);
		color: var(--color-accent-contrast);
		font-weight: 500;
	}

	:global(.conference-panel__speaking) {
		color: var(--color-secondary);
		animation: pulse-radio 0.8s ease-in-out infinite;
	}

	.conference-panel__empty {
		text-align: center;
		padding: 1rem 0;
		font-size: 0.85rem;
	}

	.conference-panel__error {
		color: var(--color-danger);
		font-size: 0.85rem;
		padding: 0.5rem;
		background: var(--color-danger-soft);
		border-radius: var(--radius-sm);
		margin: 0;
	}

	:global(.animate-pulse) {
		animation: pulse-mic 1s ease-in-out infinite;
	}

	@keyframes pulse-mic {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	/* Responsive */
	@media (max-width: 600px) {
		.conference-panel {
			top: auto;
			bottom: 120px;
			transform: none;
		}

		.conference-panel__content {
			max-height: 50vh;
		}

		.conference-bar {
			flex-wrap: wrap;
			justify-content: center;
			text-align: center;
		}
	}
</style>
