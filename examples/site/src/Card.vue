<template>
  <article class="card">
    <h3>{{ tool.name }}</h3>
    <p v-if="tool.inStock">Ships Tuesday. Sharpened before it leaves.</p>
    <p v-else>Out of stock. We make a batch every six weeks.</p>
    <button :title="tool.name" aria-label="Add to cart">Add</button>
  </article>
</template>

<script setup>
const props = defineProps({ tool: Object });
const SOLD_OUT = "Sorry, that one just sold out.";
</script>

<style scoped>
.card { padding: 1rem; }
</style>
