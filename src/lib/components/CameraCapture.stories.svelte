<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import CameraCapture from './CameraCapture.svelte';

  /**
   * ===================================================================
   * STORIES : CameraCapture.svelte
   * ===================================================================
   * 
   * Composant de capture photo utilisant l'API MediaDevices du navigateur.
   * Permet de prendre des photos avec la webcam et les sauvegarder.
   * 
   * PROPS :
   * - quality: number (0-1)           - Qualité JPEG de la capture
   * - facingMode: 'user' | 'environment' - Caméra avant/arrière
   * - mirror: boolean                 - Effet miroir pour selfie
   * 
   * CALLBACKS :
   * - onOpen()                        - Appelé quand la caméra s'ouvre
   * - onClose()                       - Appelé quand la caméra se ferme
   * - onCaptured(dataUrl)             - Appelé avec la photo capturée
   * - onError(message)                - Appelé en cas d'erreur
   * 
   * MÉTHODES EXPOSÉES (bind:this) :
   * - open()    - Ouvrir la caméra et démarrer le stream
   * - close()   - Fermer la caméra et libérer les ressources
   * - capture() - Capturer un frame et le sauvegarder
   * - retake()  - Reprendre une nouvelle photo
   * ===================================================================
   */
  const { Story } = defineMeta({
    title: 'Composants/CameraCapture',
    component: CameraCapture,
    tags: ['autodocs'],
    args: {
      quality: 0.85,
      facingMode: 'user',
      mirror: true,
    },
    argTypes: {
      quality: {
        description: 'Qualité JPEG (0-1)',
        control: { type: 'range', min: 0.1, max: 1, step: 0.05 },
      },
      facingMode: {
        description: 'Mode de caméra',
        control: 'radio',
        options: ['user', 'environment'],
      },
      mirror: {
        description: 'Effet miroir',
        control: 'boolean',
      },
    },
    parameters: {
      docs: {
        description: {
          component: 'Composant de capture photo utilisant l\'API MediaDevices pour accéder a la webcam.'
        }
      }
    }
  });
</script>

<script lang="ts">
  /** Référence vers le composant CameraCapture pour appeler ses méthodes */
  let camRef: CameraCapture | null = null;
  /** Dernière photo capturée (data URL) */
  let lastPhoto = '';
  /** Message d'erreur éventuel */
  let errorMsg = '';
  
  function openCamera(): void {
    errorMsg = '';
    camRef?.open();
  }
  
  function capturePhoto(): void {
    camRef?.capture();
  }
  
  function retakePhoto(): void {
    camRef?.retake();
  }
  
  function closeCamera(): void {
    camRef?.close();
    lastPhoto = '';
  }
  
  function handleCapture(url: string): void {
    lastPhoto = url;
    console.log('Photo capturée');
  }
  
  function handleError(msg: string): void {
    errorMsg = msg;
  }
</script>

<!-- Story : État initial -->
<Story name="État initial (fermé)">
  <div class="story-container">
    <p class="story-info">
      Le composant CameraCapture est invisible a l'état initial.
      Il faut appeler la méthode open() pour démarrer la caméra.
    </p>
    <CameraCapture quality={0.85} facingMode="user" mirror={true} />
  </div>
</Story>

<!-- Story : Contrôles interactifs -->
<Story name="Contrôles interactifs">
  <div class="story-container">
    <div class="story-controls">
      <button class="story-btn story-btn--primary" onclick={openCamera}>
        Ouvrir la caméra
      </button>
      <button class="story-btn story-btn--success" onclick={capturePhoto}>
        Capturer
      </button>
      <button class="story-btn" onclick={retakePhoto}>
        Reprendre
      </button>
      <button class="story-btn story-btn--danger" onclick={closeCamera}>
        Fermer
      </button>
    </div>
    
    {#if errorMsg}
      <div class="story-error">
        <strong>Erreur :</strong> {errorMsg}
      </div>
    {/if}
    
    <CameraCapture
      bind:this={camRef}
      quality={0.85}
      facingMode="user"
      mirror={true}
      onOpen={() => console.log('Caméra ouverte')}
      onClose={() => console.log('Caméra fermée')}
      onCaptured={handleCapture}
      onError={handleError}
    />
    
    {#if lastPhoto}
      <div class="story-preview">
        <span class="story-label">Dernière capture :</span>
        <img src={lastPhoto} alt="Dernière capture" class="story-thumbnail" />
      </div>
    {/if}
    
    <p class="story-hint">
      <strong>Instructions :</strong><br />
      1. Cliquez sur "Ouvrir la caméra"<br />
      2. Accordez la permission si demandée<br />
      3. Cliquez sur "Capturer" pour prendre une photo<br />
      4. La photo sera sauvegardée dans la galerie locale
    </p>
  </div>
</Story>

<!-- Story : Qualité haute -->
<Story name="Qualité haute (1.0)">
  <div class="story-container">
    <div class="story-badge">Qualité: 100%</div>
    <p class="story-info">
      Configuration avec qualité JPEG maximale.
      Produit des images plus lourdes mais de meilleure qualité.
    </p>
    <CameraCapture quality={1.0} facingMode="user" mirror={true} />
  </div>
</Story>

<!-- Story : Qualité basse -->
<Story name="Qualité basse (0.5)">
  <div class="story-container">
    <div class="story-badge story-badge--warning">Qualité: 50%</div>
    <p class="story-info">
      Configuration avec qualité JPEG réduite.
      Produit des images plus légères, idéal pour le chat.
    </p>
    <CameraCapture quality={0.5} facingMode="user" mirror={true} />
  </div>
</Story>

<!-- Story : Sans effet miroir -->
<Story name="Sans effet miroir">
  <div class="story-container">
    <div class="story-badge">Mirror: OFF</div>
    <p class="story-info">
      Mode sans miroir - utile pour photographier du texte ou des documents.
    </p>
    <CameraCapture quality={0.85} facingMode="user" mirror={false} />
  </div>
</Story>

<!-- Story : Caméra arrière -->
<Story name="Caméra arrière">
  <div class="story-container">
    <div class="story-badge story-badge--info">Caméra: Arrière</div>
    <p class="story-info">
      Mode "environment" - sur mobile, utilise la caméra arrière.
      L'effet miroir est désactivé pour ce mode.
    </p>
    <CameraCapture quality={0.85} facingMode="environment" mirror={false} />
  </div>
</Story>

<style>
  .story-container {
    padding: 2rem;
    background: var(--color-bg, #0f0f23);
    color: var(--color-text, #fff);
    min-height: 400px;
    border-radius: 0.5rem;
  }

  .story-info {
    color: var(--color-text-secondary, #888);
    font-style: italic;
    margin-bottom: 1rem;
  }

  .story-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .story-btn {
    padding: 0.6rem 1.2rem;
    border: 1px solid var(--color-border, #333);
    background: var(--color-surface, #1a1a2e);
    color: var(--color-text, #fff);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.95rem;
  }

  .story-btn:hover {
    background: var(--color-surface-hover, #252542);
  }

  .story-btn--primary {
    background: var(--color-accent, #4f46e5);
    border-color: var(--color-accent, #4f46e5);
  }

  .story-btn--primary:hover {
    background: #6366f1;
  }

  .story-btn--success {
    background: #059669;
    border-color: #059669;
  }

  .story-btn--success:hover {
    background: #10b981;
  }

  .story-btn--danger {
    background: var(--color-danger, #dc2626);
    border-color: var(--color-danger, #dc2626);
  }

  .story-btn--danger:hover {
    background: #ef4444;
  }

  .story-badge {
    display: inline-block;
    padding: 0.35rem 0.75rem;
    background: var(--color-accent, #4f46e5);
    color: white;
    border-radius: 1rem;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .story-badge--warning {
    background: #d97706;
  }

  .story-badge--info {
    background: #0891b2;
  }

  .story-hint {
    color: var(--color-text-secondary, #888);
    font-size: 0.9rem;
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--color-surface, #1a1a2e);
    border-radius: 0.5rem;
    border-left: 3px solid var(--color-accent, #4f46e5);
  }

  .story-error {
    padding: 1rem;
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid var(--color-danger, #dc2626);
    border-radius: 0.5rem;
    color: #fca5a5;
    margin-bottom: 1rem;
  }

  .story-preview {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--color-surface, #1a1a2e);
    border-radius: 0.5rem;
  }

  .story-label {
    display: block;
    font-size: 0.75rem;
    color: var(--color-text-secondary, #888);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.75rem;
  }

  .story-thumbnail {
    max-width: 200px;
    border-radius: 0.5rem;
    border: 2px solid var(--color-border, #333);
  }
</style>
