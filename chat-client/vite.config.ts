import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA(
			{
				registerType: 'autoUpdate',
				devOptions: {
					enabled: true
				},
				manifest: {
					name: 'Chat Client',
					short_name: 'Chat',
					start_url: '/',
					display: 'standalone',
					background_color: '#f1f1f1ff',
					theme_color: '#1095d3ff',
					icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
					]
				}
			}
		)
	]
});
