<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar, { type NavLink } from '$lib/components/Navbar.svelte';
	import { readProfile } from '$lib/storage/profile';

	type Theme = 'dark' | 'light';

	const NAV_LINKS: NavLink[] = [
		{ href: '/', label: 'Accueil', requiresAuth: true },
		{ href: '/camera', label: 'Caméra', requiresAuth: true },
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
	<Navbar
		links={NAV_LINKS}
		{isSignedIn}
		currentPath={page.url.pathname}
		{navOpen}
		{theme}
		onToggleNav={() => (navOpen = !navOpen)}
		onToggleTheme={toggleTheme}
		onNavigate={() => (navOpen = false)}
	/>

	<main class="app-main">
		<div class="container stack">
			{@render children?.()}
		</div>
	</main>
</div>
