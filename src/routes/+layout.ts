import type { LayoutLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

export const load: LayoutLoad = ({ url }) => {
  // page user OK
  if (url.pathname.startsWith('/user')) return {};

  if (browser) {
    try {
      const raw = localStorage.getItem('chat.profile.v1');
      const p = raw ? JSON.parse(raw) : null;
      const pseudo = typeof p?.pseudo === 'string' ? p.pseudo.trim() : '';
      if (!pseudo) {
        throw redirect(307, '/user'); // pas de user => redirection
      }
    } catch {
      throw redirect(307, '/user');
    }
  }

  return {};
};
