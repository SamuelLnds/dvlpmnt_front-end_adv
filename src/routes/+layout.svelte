<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { Menu, Moon, Sun, X } from 'lucide-svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Battery from '$lib/components/Battery.svelte';
	import { readProfile } from '$lib/storage/profile';

	type Theme = 'dark' | 'light';

	type NavLink = { href: string; label: string; requiresAuth: boolean };
	const NAV_LINKS: NavLink[] = [
		{ href: '/', label: 'Accueil', requiresAuth: true },
		{ href: '/test', label: 'Test', requiresAuth: true },
		{ href: '/gallery', label: 'Galerie', requiresAuth: true },
		{ href: '/reception', label: 'Réception', requiresAuth: true },
		{ href: '/user', label: 'Profil', requiresAuth: true },
	];

	const THEME_KEY = 'app-theme';
	const PREFERS_DARK_QUERY = '(prefers-color-scheme: dark)';

	let { children } = $props();
	let isSignedIn = $state(false);
	let navOpen = $state(false);
	let theme = $state<Theme>('dark');
	let mediaQuery: MediaQueryList | null = null;

	onMount(() => {
		const profile = readProfile();
		isSignedIn = !!profile.pseudo;

		const initial = getInitialTheme();
		applyTheme(initial);

		mediaQuery = window.matchMedia(PREFERS_DARK_QUERY);
		mediaQuery.addEventListener('change', handleSystemThemeChange);

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				navOpen = false;
			}
		};

		window.addEventListener('keydown', handleKeyDown);

		return () => {
			mediaQuery?.removeEventListener('change', handleSystemThemeChange);
			window.removeEventListener('keydown', handleKeyDown);
		};
	});

	afterNavigate(() => {
		navOpen = false;
	});

	function getInitialTheme(): Theme {
		if (typeof window === 'undefined') return 'dark';

		const stored = window.localStorage.getItem(THEME_KEY);
		if (stored === 'light' || stored === 'dark') {
			return stored;
		}

		const prefersDark = window.matchMedia(PREFERS_DARK_QUERY).matches;
		return prefersDark ? 'dark' : 'light';
	}

	function applyTheme(next: Theme) {
		theme = next;
		if (typeof document !== 'undefined') {
			document.documentElement.dataset.theme = next;
		}
	}

	function setTheme(next: Theme) {
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(THEME_KEY, next);
		}
		applyTheme(next);
	}

	function toggleTheme() {
		setTheme(theme === 'dark' ? 'light' : 'dark');
	}

	function handleSystemThemeChange(event: MediaQueryListEvent) {
		if (typeof window === 'undefined') return;
		const stored = window.localStorage.getItem(THEME_KEY);
		if (stored === 'light' || stored === 'dark') return;
		applyTheme(event.matches ? 'dark' : 'light');
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- <link rel="manifest" href="/manifest.webmanifest" /> -->
</svelte:head>

<div class="app-shell">
	<header class="navbar">
		<div class="container navbar__inner">
			<a href="/" class="navbar__brand" aria-label="Accueil">
				<span class="navbar__brand-icon" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none">
						<path
							d="M4.5 9.75L12 4.5l7.5 5.25v8.25a1.5 1.5 0 0 1-1.5 1.5h-4.5v-4.5h-3v4.5H6a1.5 1.5 0 0 1-1.5-1.5z"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
						<path
							d="M9.75 21V12.75h4.5V21"
							stroke="currentColor"
							stroke-width="1.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
				</span>
				<span class="navbar__brand-text">TP PWA</span>
			</a>

			{#if isSignedIn}
				<nav class="navbar__menu" aria-label="Navigation principale">
					{#each NAV_LINKS as link (link.href)}
						{#if link.requiresAuth === false || isSignedIn}
							<a
								href={link.href}
								class="navbar__item"
								aria-current={page.url.pathname === link.href ? 'page' : undefined}
								class:navbar__item--active={page.url.pathname === link.href}
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
					onclick={() => (navOpen = !navOpen)}
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
					onclick={toggleTheme}
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
					{#each NAV_LINKS as link (link.href)}
						{#if link.requiresAuth === false || isSignedIn}
							<a
								href={link.href}
								class="navbar__drawer-item"
								aria-current={page.url.pathname === link.href ? 'page' : undefined}
								class:navbar__drawer-item--active={page.url.pathname === link.href}
								onclick={() => (navOpen = false)}
							>
								{link.label}
							</a>
						{/if}
					{/each}
				</nav>
			</div>
		{/if}
	</header>

	<main class="app-main">
		<div class="container stack">
			{@render children?.()}
		</div>
	</main>
</div>
