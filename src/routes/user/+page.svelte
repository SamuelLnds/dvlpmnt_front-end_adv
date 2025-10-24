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

		if (!profile.photoDataUrl) {
			profile.photoDataUrl = await defaultAvatarDataURL();
			isDefaultAvatar = true;
		}

		writeProfile(profile);
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
			on:captured={(event) => {
				profile.photoDataUrl = event.detail;
				isDefaultAvatar = false;
				saved = '';
				addPhotoFromDataURL(event.detail);
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
