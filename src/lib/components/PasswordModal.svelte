<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { Lock, X, Loader2 } from 'lucide-svelte';

	export let visible = false;
	export let roomName = '';
	export let error = '';
	export let loading = false;
	export let onSubmit: (password: string) => void = () => {};
	export let onClose: () => void = () => {};

	let password = '';
	let inputRef: HTMLInputElement | null = null;
	let shakeError = false;

	$: if (visible && inputRef) {
		inputRef.focus();
	}

	// Trigger shake animation when error changes
	$: if (error) {
		triggerShake();
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		if (!password.trim()) {
			triggerShake();
			return;
		}
		onSubmit(password);
		password = '';
	}

	function handleClose() {
		password = '';
		onClose();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			handleClose();
		}
	}

	function triggerShake() {
		shakeError = true;
		setTimeout(() => {
			shakeError = false;
		}, 500);
	}

	export function shake() {
		triggerShake();
	}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-overlay" transition:fade={{ duration: 200 }} on:click={handleBackdropClick}>
		<div class="modal-card" class:shake={shakeError} transition:scale={{ duration: 250, start: 0.9 }}>
			<div class="modal-header">
				<h2>Room sécurisée</h2>
				<button type="button" class="btn btn--ghost btn--icon" on:click={handleClose} aria-label="Fermer">
					<X size={20} />
				</button>
			</div>

			<div class="lock-container">
				<div class="lock-icon">
					<Lock size={48} strokeWidth={1.5} />
				</div>
			</div>

			<p class="modal-description">
				La room <strong>{roomName}</strong> est protégée par un mot de passe.
			</p>

			<form on:submit={handleSubmit}>
				<div class="field-row">
					<input
						bind:this={inputRef}
						bind:value={password}
						type="password"
						class="input"
						class:input--error={!!error}
						placeholder="Entrez le mot de passe"
						aria-label="Mot de passe de la room"
						aria-invalid={!!error}
						autocomplete="off"
						disabled={loading}
					/>
				</div>
				{#if error}
					<p class="error-message" role="alert">{error}</p>
				{/if}
				<div class="modal-footer">
					<button type="button" class="btn btn--ghost" on:click={handleClose} disabled={loading}>
						Annuler
					</button>
					<button type="submit" class="btn btn--primary" disabled={loading}>
						{#if loading}
							<Loader2 size={16} class="spin" />
							Vérification...
						{:else}
							<Lock size={16} />
							Déverrouiller
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		display: grid;
		place-items: center;
		z-index: 100;
		backdrop-filter: blur(4px);
		padding: 1rem;
	}

	.modal-card {
		width: min(400px, 100%);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: clamp(1.25rem, 3vw, 2rem);
		box-shadow: var(--shadow-soft);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.modal-card.shake {
		animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
		20%, 40%, 60%, 80% { transform: translateX(6px); }
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.btn--icon {
		padding: 0.5rem;
		line-height: 1;
	}

	.lock-container {
		display: flex;
		justify-content: center;
		padding: 0.5rem 0;
	}

	.lock-icon {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		background: var(--color-accent-soft);
		display: grid;
		place-items: center;
		color: var(--color-accent);
		animation: pulse-lock 2s ease-in-out infinite;
	}

	@keyframes pulse-lock {
		0%, 100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 var(--color-accent-soft);
		}
		50% {
			transform: scale(1.05);
			box-shadow: 0 0 0 12px transparent;
		}
	}

	.modal-description {
		text-align: center;
		color: var(--color-text-secondary);
		margin: 0;
	}

	.modal-description strong {
		color: var(--color-text);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field-row {
		display: flex;
		gap: 0.5rem;
	}

	.field-row .input {
		flex: 1;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}

	.modal-footer .btn--primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.input--error {
		border-color: var(--color-danger) !important;
		box-shadow: 0 0 0 2px var(--color-danger-soft);
	}

	.error-message {
		color: var(--color-danger);
		font-size: 0.875rem;
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: var(--color-danger-soft);
		border-radius: var(--radius-sm);
		text-align: center;
	}

	.modal-footer .btn--primary :global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
