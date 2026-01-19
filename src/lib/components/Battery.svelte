<script lang="ts">
  import { onMount } from 'svelte';

  type BatteryManager = {
    charging: boolean;
    level: number; // 0..1
    addEventListener: (t: string, cb: () => void) => void;
    removeEventListener: (t: string, cb: () => void) => void;
  };

  let supported = false;
  let level = 1;
  let charging = false;
  let bm: BatteryManager | null = null;

  const update = () => {
    if (!bm) return;
    level = bm.level;
    charging = bm.charging;
  };

  onMount(() => {
    supported = 'getBattery' in navigator && window.isSecureContext;
    if (!supported) return;

    let active = true;

    (async () => {
      try {
        bm = await (navigator as any).getBattery();
        if (!active || bm === null) return;

        update();
        bm.addEventListener('levelchange', update);
        bm.addEventListener('chargingchange', update);
      } catch (e) {
        console.error('getBattery() failed:', e);
        supported = false;
      }
    })();

    // cleanup: retournée par onMount (équivalent onDestroy)
    return () => {
      active = false;
      if (!bm) return;
      bm.removeEventListener('levelchange', update);
      bm.removeEventListener('chargingchange', update);
    };
  });

  $: percent = Math.round(level * 100);
</script>


{#if supported}
	<div
		class="battery"
		title={charging ? `Batterie ${percent}% (en charge)` : `Batterie ${percent}%`}
	>
		<div class="icon">
			<div class="bar" style={`width:${percent}%;`}></div>
		</div>
		<span class="txt">{percent}%{charging ? ' ⚡' : ''}</span>
	</div>
{:else}
	<div class="battery muted" title="Indicateur de batterie non supporté">Batterie — n/s</div>
{/if}

<style>
	.battery {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.9rem;
	}
	.muted {
		color: #777;
	}
	.icon {
		width: 22px;
		height: 12px;
		border: 2px solid #333;
		border-radius: 3px;
		position: relative;
		box-sizing: content-box;
	}
	.icon::after {
		content: '';
		position: absolute;
		right: -5px;
		top: 3px;
		width: 3px;
		height: 6px;
		background: #333;
		border-radius: 1px;
	}
	.bar {
		height: 100%;
		background: #2ecc71;
	}
	.txt {
		min-width: 3ch;
		text-align: right;
	}
</style>
