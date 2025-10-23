<script lang="ts">
	import { onMount } from 'svelte';
	import {
		readProfile,
		writeProfile,
		fileToDataURL,
		type Profile,
		PROFILE_KEY,
		LAST_ROOM_KEY,
		defaultAvatarDataURL
	} from '$lib/storage/profile';
	import { addPhotoFromDataURL, readPhotos, type PhotoItem } from '$lib/storage/photos';
	import { resetSocket } from '$lib/socket';
	import CameraCapture from '$lib/components/CameraCapture.svelte';

	let profile: Profile = { pseudo: '' };
	let saved = '';

	// Caméra
	let avatarCam: InstanceType<typeof CameraCapture> | null = null;

	// Galerie locale
	let photos: PhotoItem[] = [];
	let showGallery = false;

	// État avatar
	let isDefaultAvatar = false;

	onMount(() => {
		profile = readProfile();
		photos = readPhotos();

		// Avatar par défaut si absent
		if (!profile.photoDataUrl) {
			defaultAvatarDataURL().then((dataUrl) => {
				profile.photoDataUrl = dataUrl;
				isDefaultAvatar = true;
			});
		}
	});

	async function onAvatarFile(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		profile.photoDataUrl = await fileToDataURL(file);
		isDefaultAvatar = false;
		saved = '';
		addPhotoFromDataURL(profile.photoDataUrl);
		photos = readPhotos();
	}

	async function resetAvatar() {
		profile.photoDataUrl = await defaultAvatarDataURL();
		isDefaultAvatar = true;
		saved = '';
	}

	// Choix depuis galerie
	function pickFromGallery(p: PhotoItem) {
		profile.photoDataUrl = p.dataUrl;
		isDefaultAvatar = false;
		showGallery = false;
		saved = '';
	}

	async function save(e: Event) {
		e.preventDefault();
		profile.pseudo = (profile.pseudo ?? '').trim();

		if (!profile.pseudo) {
			saved = 'Le pseudo est requis';
			return;
		}
		if (!profile.photoDataUrl) {
			profile.photoDataUrl = await defaultAvatarDataURL();
			isDefaultAvatar = true;
		}

		writeProfile(profile);
		// reload dur pour réinitialiser l’app avec l’utilisateur
		location.assign('/');
	}

	async function logout() {
		try {
			localStorage.removeItem(PROFILE_KEY);
			localStorage.removeItem(LAST_ROOM_KEY);
		} finally {
			resetSocket();
			location.assign('/user');
		}
	}
</script>

<svelte:head><title>Mon profil</title></svelte:head>

<main class="wrap">
	<h1>Mon profil</h1>

	<form class="card" on:submit={save}>
		<label>
			Pseudo
			<input type="text" bind:value={profile.pseudo} required placeholder="Votre pseudo" />
		</label>

		<fieldset class="avatar-choices">
			<legend>Avatar</legend>

			<div class="row">
				<label class="btn file-btn">
					Importer
					<input type="file" accept="image/*" on:change={onAvatarFile} hidden />
				</label>

				<button type="button" class="btn" on:click={() => (showGallery = !showGallery)}>
					Galerie
				</button>

				<button type="button" class="btn" on:click={() => avatarCam?.open()}>
					Prendre une photo
				</button>
			</div>

			<div class="preview">
				{#if profile.photoDataUrl}
					<img src={profile.photoDataUrl} alt="Aperçu avatar" />
					{#if !isDefaultAvatar}
						<button type="button" class="btn" on:click={resetAvatar}>Réinitialiser</button>
					{/if}
				{:else}
					<div class="placeholder">Aucun avatar</div>
				{/if}
			</div>
		</fieldset>

		<CameraCapture
			bind:this={avatarCam}
			facingMode="user"
			mirror={true}
			on:captured={(e) => {
				profile.photoDataUrl = e.detail;
				isDefaultAvatar = false;
				saved = '';
				addPhotoFromDataURL(e.detail);
				photos = readPhotos();
			}}
		/>

		{#if showGallery}
			<div class="gallery">
				{#if photos.length === 0}
					<p class="muted">
						Aucune photo enregistrée dans la galerie.
					</p>
				{:else}
					<ul class="grid">
						{#each photos as p (p.ts)}
							<li>
								<button type="button" class="thumb" on:click={() => pickFromGallery(p)}>
									<img src={p.dataUrl} alt="miniature" />
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		{/if}

		<div class="actions">
			<button type="submit" class="btn primary">Enregistrer</button>
			{#if saved}<span class="ok">{saved}</span>{/if}
		</div>
	</form>

	{#if profile.accountExists}
		<button type="button" class="btn danger" on:click={logout}>Se déconnecter</button>
	{/if}
</main>

<style>
	.wrap {
		max-width: 960px;
		margin: 0 auto;
		padding: 1rem;
	}
	.card {
		border: 1px solid #eee;
		border-radius: 0.5rem;
		padding: 0.75rem;
		background: #fff;
		display: grid;
		gap: 0.75rem;
		max-width: 640px;
	}
	input,
	button {
		padding: 0.5rem 0.75rem;
	}

	.avatar-choices {
		border: 1px dashed #e5e7eb;
		border-radius: 0.5rem;
		padding: 0.5rem;
	}
	.row {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.btn {
		border: 1px solid #ddd;
		background: #f9f9f9;
		border-radius: 0.5rem;
		cursor: pointer;
	}
	.btn.primary {
		background: #111827;
		color: #fff;
		border-color: #111827;
	}
	.btn.danger {
		margin-top: 0.75rem;
		border-color: #dc2626;
		color: #dc2626;
		background: #fff;
	}

	.file-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}

	.preview {
		margin-top: 0.5rem;
	}
	.preview img {
		width: 96px;
		height: 96px;
		object-fit: cover;
		border-radius: 50%;
		border: 1px solid #ddd;
	}
	.placeholder {
		width: 96px;
		height: 96px;
		display: grid;
		place-items: center;
		border: 1px dashed #bbb;
		border-radius: 50%;
		color: #777;
	}

	/* Galerie */
	.gallery {
		border-top: 1px solid #f3f4f6;
		padding-top: 0.5rem;
	}
	.grid {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
		gap: 0.5rem;
	}
	.thumb {
		border: 1px solid #e5e7eb;
		background: #fff;
		border-radius: 0.5rem;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
	}
	.thumb img {
		display: block;
		width: 100%;
		height: 96px;
		object-fit: cover;
	}

	.ok {
		margin-left: 0.5rem;
		color: #0a7d25;
		font-weight: 600;
	}
	.muted {
		color: #777;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
</style>
