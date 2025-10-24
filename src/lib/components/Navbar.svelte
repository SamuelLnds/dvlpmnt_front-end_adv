<script lang="ts" context="module">
	export type NavLink = { href: string; label: string; requiresAuth: boolean };
</script>

<script lang="ts">
	import { Home, Menu, Moon, Sun, X } from 'lucide-svelte';
	import Battery from '$lib/components/Battery.svelte';

	export let links: NavLink[] = [];
	export let isSignedIn = false;
	export let currentPath = '/';
	export let navOpen = false;
	export let theme: 'dark' | 'light' = 'dark';

	const noop = () => {};
	export let onToggleNav: () => void = noop;
	export let onToggleTheme: () => void = noop;
	export let onNavigate: (href?: string) => void = noop;

	function handleToggleNav() {
		onToggleNav();
	}

	function handleToggleTheme() {
		onToggleTheme();
	}

	function handleNavigate(href: string) {
		onNavigate(href);
	}
</script>

<header class="navbar">
	<div class="container navbar__inner">
		<a href="/" class="navbar__brand" aria-label="Accueil">
			<span class="navbar__brand-text">TP PWA</span>
		</a>

		{#if isSignedIn}
			<nav class="navbar__menu" aria-label="Navigation principale">
				{#each links as link (link.href)}
					{#if !link.requiresAuth || isSignedIn}
						<a
							href={link.href}
							class="navbar__item"
							aria-current={currentPath === link.href ? 'page' : undefined}
							class:navbar__item--active={currentPath === link.href}
						>
							{link.label}
						</a>
					{/if}
				{/each}
			</nav>
		{/if}

		<div class="navbar__tray">
			<button
				type="button"
				class="navbar__toggle btn btn--icon"
				onclick={handleToggleNav}
				aria-label={navOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
				aria-expanded={navOpen}
				aria-controls="mobile-navigation"
			>
				{#if navOpen}
					<X size={20} stroke-width={2} aria-hidden="true" />
				{:else}
					<Menu size={20} stroke-width={2} aria-hidden="true" />
				{/if}
			</button>

			<button
				type="button"
				class="theme-pill"
				onclick={handleToggleTheme}
				data-theme={theme}
				aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
			>
				<span class="theme-pill__thumb" aria-hidden="true"></span>
				<span class="theme-pill__icon theme-pill__icon--sun" aria-hidden="true">
					<Sun size={16} stroke-width={2} aria-hidden="true" />
				</span>
				<span class="theme-pill__icon theme-pill__icon--moon" aria-hidden="true">
					<Moon size={16} stroke-width={2} aria-hidden="true" />
				</span>
				<span class="theme-pill__label">{theme === 'dark' ? 'Sombre' : 'Clair'}</span>
			</button>

			<Battery />
		</div>
	</div>

	{#if isSignedIn}
		<div class="navbar__drawer" data-open={navOpen}>
			<nav id="mobile-navigation" class="navbar__drawer-list" aria-label="Navigation mobile">
				{#each links as link (link.href)}
					{#if !link.requiresAuth || isSignedIn}
						<a
							href={link.href}
							class="navbar__drawer-item"
							aria-current={currentPath === link.href ? 'page' : undefined}
							class:navbar__drawer-item--active={currentPath === link.href}
							onclick={() => handleNavigate(link.href)}
						>
							{link.label}
						</a>
					{/if}
				{/each}
			</nav>
		</div>
	{/if}
</header>
