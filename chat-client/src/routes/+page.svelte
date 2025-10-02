<script lang="ts">
  function hello() {
    alert('Hello World');
  }
</script>

<button on:click={hello}>
  Afficher une alerte
</button>

<style>
  h1 { font: 600 1.5rem/1.2 system-ui, sans-serif; margin-bottom: 1rem; }
  button { padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 0.5rem; cursor: pointer; }
  button:hover { background: #f6f6f6; }
</style>
