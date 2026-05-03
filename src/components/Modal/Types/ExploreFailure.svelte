<script>
	export let data = {};
	export let hideModal;

	function handleRollback() {
		if (data.onRollback) data.onRollback();
		hideModal();
	}

	function handleUndo() {
		if (data.onUndo) data.onUndo();
		hideModal();
	}

	function handleRedo() {
		if (data.onRedo) data.onRedo();
		hideModal();
	}
</script>

<h1 class="text-3xl font-semibold mb-5 leading-none">{data.title || '探索失败'}</h1>

{#if data.reason}
	<p class="text-lg mb-3 font-medium text-red-600">{data.reason}</p>
{/if}

{#if data.text}
	<p class="text-lg mb-5">{data.text}</p>
{/if}

<div class="flex flex-col sm:flex-row sm:justify-end gap-3">
	<button class="btn btn-small" on:click={handleUndo}>撤销一步</button>
	<button class="btn btn-small" on:click={handleRedo}>重做一步</button>
	<button class="btn btn-small btn-primary" on:click={handleRollback}>回滚到探索前</button>
</div>