<script lang="ts">
	import { onMount } from 'svelte';
	import {
		readProfile,
		writeProfile,
		fileToDataURL,
		type Profile,
		PROFILE_KEY,
		LAST_ROOM_KEY,
		defaultAvatarDataURL,
	} from '$lib/storage/profile';
	import { addPhotoFromDataURL, readPhotos, type PhotoItem } from '$lib/storage/photos';
	import { resetSocket } from '$lib/socket';
	import CameraCapture from '$lib/components/CameraCapture.svelte';
	import { loadingStore } from '$lib/stores/loading';

	let profile: Profile = { pseudo: '' };
	let saved = '';
	let avatarCam: InstanceType<typeof CameraCapture> | null = null;
	let photos: PhotoItem[] = [];
	let showGallery = false;
	let isDefaultAvatar = false;

	onMount(() => {
		profile = readProfile();
		photos = readPhotos();

		// si pas d'avatar, mettre l'avatar par défaut
		if (!profile.photoDataUrl) {
			defaultAvatarDataURL().then((dataUrl) => {
				profile.photoDataUrl = dataUrl;
				isDefaultAvatar = true;
			});
		}
	});

	async function onAvatarFile(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		loadingStore.show('Chargement de l\'image...');
		try {
			profile.photoDataUrl = await fileToDataURL(file);
			isDefaultAvatar = false;
			saved = '';
			addPhotoFromDataURL(profile.photoDataUrl);
			photos = readPhotos();
		} finally {
			loadingStore.hide();
		}
	}

	async function resetAvatar() {
		loadingStore.show('Réinitialisation...');
		try {
			profile.photoDataUrl = await defaultAvatarDataURL();
			isDefaultAvatar = true;
			saved = '';
		} finally {
			loadingStore.hide();
		}
	}

	function pickFromGallery(photo: PhotoItem) {
		profile.photoDataUrl = photo.dataUrl;
		isDefaultAvatar = false;
		showGallery = false;
		saved = '';
	}

	async function save(event: Event) {
		event.preventDefault();
		profile.pseudo = (profile.pseudo ?? '').trim();

		if (!profile.pseudo) {
			saved = 'Le pseudo est requis';
			return;
		}

		loadingStore.show('Enregistrement du profil...');
		try {
			if (!profile.photoDataUrl) {
				profile.photoDataUrl = await defaultAvatarDataURL();
				isDefaultAvatar = true;
			}

			writeProfile(profile);
			location.assign('/');
		} finally {
			loadingStore.hide();
		}
	}

	async function logout() {
		loadingStore.show('Déconnexion...');
		try {
			localStorage.removeItem(PROFILE_KEY);
			localStorage.removeItem(LAST_ROOM_KEY);
		} finally {
			resetSocket();
			loadingStore.hide();
			location.assign('/user');
		}
	}
</script>

<svelte:head>
	<title>Mon profil</title>
</svelte:head>

<section class="surface stack">
	<header class="section-title">
		<div>
			<div class="eyebrow">Profil</div>
			<h1>Mon profil</h1>
			<p class="muted">Personnalisez votre identité et votre avatar hors ligne.</p>
		</div>
	</header>

	<form class="card stack" on:submit={save}>
		<div class="profile-header">
			<div class="profile-preview">
				{#if profile.photoDataUrl}
					<img
						class="avatar avatar--lg"
						src={profile.photoDataUrl}
						alt={`Avatar de ${profile.pseudo || 'l’utilisateur'}`}
					/>
				{:else}
					<div class="avatar-placeholder">Aucun avatar</div>
				{/if}

				{#if !isDefaultAvatar}
					<button type="button" class="btn btn--ghost btn--small" on:click={resetAvatar}>
						Réinitialiser
					</button>
				{/if}
			</div>

			<label class="form-control profile-input" for="pseudo">
				<span>Pseudo</span>
				<input
					id="pseudo"
					class="input"
					type="text"
					bind:value={profile.pseudo}
					required
					placeholder="Votre pseudo"
				/>
			</label>
		</div>

		<fieldset class="profile-panel">
			<legend>Avatar</legend>

			<div class="field-row">
				<label class="btn btn--ghost profile-upload">
					<input type="file" accept="image/*" on:change={onAvatarFile} hidden />
					<span>Importer</span>
				</label>

				<button type="button" class="btn btn--ghost" on:click={() => (showGallery = !showGallery)}>
					{showGallery ? 'Fermer la galerie' : 'Galerie'}
				</button>

				<button type="button" class="btn btn--ghost" on:click={() => avatarCam?.open()}>
					Prendre une photo
				</button>
			</div>

			{#if showGallery}
				<div class="profile-gallery stack">
					{#if photos.length === 0}
						<p class="muted">Aucune photo enregistrée dans la galerie.</p>
					{:else}
						<ul class="thumb-grid">
							{#each photos as photo (photo.ts)}
								<li>
									<button
										type="button"
										class="media-thumb"
										on:click={() => pickFromGallery(photo)}
									>
										<img src={photo.dataUrl} alt="Miniature avatar" />
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</fieldset>

		<CameraCapture
			bind:this={avatarCam}
			facingMode="user"
			mirror={true}
			onCaptured={(dataUrl) => {
				profile.photoDataUrl = dataUrl;
				isDefaultAvatar = false;
				saved = '';
				addPhotoFromDataURL(dataUrl);
				photos = readPhotos();
			}}
		/>

		{#if saved}
			<span class="badge badge--danger">{saved}</span>
		{/if}

		<div class="card-actions">
			<button type="submit" class="btn btn--primary">Enregistrer</button>
		</div>
	</form>

	{#if profile.accountExists}
		<button type="button" class="btn btn--danger" on:click={logout}>Se déconnecter</button>
	{/if}
</section>

<style>
	.profile-header {
		display: grid;
		gap: 1.25rem;
		align-items: center;
		grid-template-columns: minmax(0, auto) minmax(0, 1fr);
	}

	.profile-preview {
		display: grid;
		gap: 0.5rem;
		justify-items: center;
		text-align: center;
	}

	.avatar-placeholder {
		width: 112px;
		height: 112px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 2px dashed var(--color-border);
		color: var(--color-text-muted);
		background: var(--color-bg-muted);
		font-size: 0.85rem;
		padding: 0.5rem;
	}

	.btn--small {
		padding: 0.35rem 0.65rem;
	}

	.profile-panel {
		display: grid;
		gap: 0.75rem;
		border: 1px dashed var(--color-border);
		background: var(--color-bg-muted);
	}

	.profile-upload {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.profile-gallery {
		display: grid;
		gap: 0.75rem;
	}

	.thumb-grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
		gap: 0.6rem;
	}

	@media (max-width: 960px) {
		.profile-header {
			grid-template-columns: 1fr;
			text-align: center;
		}

		.profile-preview {
			justify-items: center;
		}
	}
</style>
