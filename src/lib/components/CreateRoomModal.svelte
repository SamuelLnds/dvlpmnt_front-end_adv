<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { Lock, LockOpen, X, Plus } from 'lucide-svelte';

	export let visible = false;
	export let roomName = '';
	export let onSubmit: (password: string | null) => void = () => {};
	export let onClose: () => void = () => {};

	let password = '';
	let confirmPassword = '';
	let isPrivate = false;
	let inputRef: HTMLInputElement | null = null;
	let error = '';

	// Réinitialiser les champs uniquement à l'ouverture du modal
	// Utiliser une variable séparée pour tracker le changement de visible uniquement
	let lastVisibleState = false;
	$: if (visible !== lastVisibleState) {
		if (visible) {
			// Modal vient de s'ouvrir → reset
			password = '';
			confirmPassword = '';
			isPrivate = false;
			error = '';
		}
		lastVisibleState = visible;
	}

	function handleSubmit(event: Event) {
		event.preventDefault();
		error = '';

		if (isPrivate) {
			if (!password.trim()) {
				error = 'Le mot de passe est requis pour une room privée';
				return;
			}
			if (password !== confirmPassword) {
				error = 'Les mots de passe ne correspondent pas';
				return;
			}
			onSubmit(password);
		} else {
			onSubmit(null);
		}

		password = '';
		confirmPassword = '';
	}

	function handleClose() {
		password = '';
		confirmPassword = '';
		isPrivate = false;
		error = '';
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
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="modal-overlay" transition:fade={{ duration: 200 }} on:click={handleBackdropClick}>
		<div class="modal-card" transition:scale={{ duration: 250, start: 0.9 }}>
			<div class="modal-header">
				<h2>Créer une room</h2>
				<button type="button" class="btn btn--ghost btn--icon" on:click={handleClose} aria-label="Fermer">
					<X size={20} />
				</button>
			</div>

			<div class="room-preview">
				<div class="room-icon" class:private={isPrivate}>
					{#if isPrivate}
						<Lock size={32} strokeWidth={1.5} />
					{:else}
						<LockOpen size={32} strokeWidth={1.5} />
					{/if}
				</div>
				<div class="room-info">
					<strong>{roomName}</strong>
					<span class="muted">Nouvelle room</span>
				</div>
			</div>

			<form on:submit={handleSubmit}>
				<div class="privacy-toggle">
					<label class="toggle-label">
						<input
							type="checkbox"
							bind:checked={isPrivate}
							on:change={() => {
								if (isPrivate && inputRef) {
									setTimeout(() => inputRef?.focus(), 100);
								}
							}}
						/>
						<span class="toggle-switch"></span>
						<span class="toggle-text">
							{#if isPrivate}
								<Lock size={16} />
								Room privée (protégée par mot de passe)
							{:else}
								<LockOpen size={16} />
								Room publique (accessible à tous)
							{/if}
						</span>
					</label>
				</div>

				{#if isPrivate}
					<div class="password-fields" transition:fade={{ duration: 150 }}>
						<div class="field">
							<label for="create-password">Mot de passe</label>
							<input
								bind:this={inputRef}
								bind:value={password}
								id="create-password"
								type="password"
								class="input"
								placeholder="Définir un mot de passe"
								autocomplete="new-password"
							/>
						</div>
						<div class="field">
							<label for="confirm-password">Confirmer le mot de passe</label>
							<input
								bind:value={confirmPassword}
								id="confirm-password"
								type="password"
								class="input"
								placeholder="Confirmer le mot de passe"
								autocomplete="new-password"
							/>
						</div>
					</div>
				{/if}

				{#if error}
					<p class="error-message">{error}</p>
				{/if}

				<div class="modal-footer">
					<button type="button" class="btn btn--ghost" on:click={handleClose}>
						Annuler
					</button>
					<button type="submit" class="btn btn--primary">
						<Plus size={16} />
						Créer la room
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
		width: min(450px, 100%);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: clamp(1.25rem, 3vw, 2rem);
		box-shadow: var(--shadow-soft);
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
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

	.room-preview {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: var(--color-bg-muted);
		border-radius: var(--radius-md);
	}

	.room-icon {
		width: 56px;
		height: 56px;
		border-radius: var(--radius-md);
		background: var(--color-accent-soft);
		display: grid;
		place-items: center;
		color: var(--color-accent);
		transition: all var(--transition-medium);
	}

	.room-icon.private {
		background: var(--color-warning-soft);
		color: var(--color-warning);
	}

	.room-info {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.room-info strong {
		font-size: 1.1rem;
	}

	.privacy-toggle {
		padding: 0.5rem 0;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.toggle-label input {
		display: none;
	}

	.toggle-switch {
		position: relative;
		width: 44px;
		height: 24px;
		background: var(--color-bg-muted);
		border-radius: 12px;
		transition: background var(--transition-fast);
		flex-shrink: 0;
	}

	.toggle-switch::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 20px;
		height: 20px;
		background: var(--color-text-muted);
		border-radius: 50%;
		transition: all var(--transition-fast);
	}

	.toggle-label input:checked + .toggle-switch {
		background: var(--color-warning-soft);
	}

	.toggle-label input:checked + .toggle-switch::after {
		left: 22px;
		background: var(--color-warning);
	}

	.toggle-text {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.95rem;
		color: var(--color-text-secondary);
	}

	.password-fields {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.field label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.error-message {
		color: var(--color-danger);
		font-size: 0.875rem;
		margin: 0;
		padding: 0.5rem;
		background: var(--color-danger-soft);
		border-radius: var(--radius-sm);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 0.5rem;
	}

	.modal-footer .btn--primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
