<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { loadingStore } from '$lib/stores/loading';
</script>

{#if $loadingStore.visible}
	<div class="loading-overlay" transition:fade={{ duration: 200 }}>
		<div class="loading-card" transition:scale={{ duration: 250, start: 0.9 }}>
			<div class="loading-spinner">
				<div class="spinner-ring"></div>
				<div class="spinner-ring"></div>
				<div class="spinner-ring"></div>
				<div class="spinner-dot"></div>
			</div>
			<p class="loading-message">{$loadingStore.message}</p>
		</div>
	</div>
{/if}

<style>
	.loading-overlay {
		position: fixed;
		inset: 0;
		background: var(--color-overlay);
		display: grid;
		place-items: center;
		z-index: 100;
		backdrop-filter: blur(4px);
	}

	.loading-card {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: clamp(1.5rem, 3vw, 2.5rem);
		box-shadow: var(--shadow-soft);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.25rem;
		min-width: 200px;
	}

	.loading-spinner {
		position: relative;
		width: 64px;
		height: 64px;
	}

	.spinner-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 3px solid transparent;
		animation: spin 1.5s cubic-bezier(0.68, -0.55, 0.27, 1.55) infinite;
	}

	.spinner-ring:nth-child(1) {
		border-top-color: var(--color-accent);
		animation-delay: 0s;
	}

	.spinner-ring:nth-child(2) {
		inset: 6px;
		border-right-color: var(--color-secondary);
		animation-delay: 0.15s;
		animation-direction: reverse;
	}

	.spinner-ring:nth-child(3) {
		inset: 12px;
		border-bottom-color: var(--color-info);
		animation-delay: 0.3s;
	}

	.spinner-dot {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 10px;
		height: 10px;
		margin: -5px 0 0 -5px;
		background: var(--color-accent);
		border-radius: 50%;
		animation: pulse 1s ease-in-out infinite;
	}

	.loading-message {
		color: var(--color-text-secondary);
		font-weight: 500;
		text-align: center;
		margin: 0;
		font-size: 0.95rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes pulse {
		0%,
		100% {
			transform: scale(0.8);
			opacity: 0.6;
		}
		50% {
			transform: scale(1.2);
			opacity: 1;
		}
	}
</style>
