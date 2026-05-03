<script>
	import { getContext } from 'svelte';
	import { candidates } from '@sudoku/stores/candidates';
	import { hints } from '@sudoku/stores/hints';
	import { notes } from '@sudoku/stores/notes';
	import { settings } from '@sudoku/stores/settings';

	const gameStore = getContext('gameStore');
	let exploreMenuOpen = false;
	let menuRef;

	$: hintsAvailable = $hints > 0;
	$: selectedCell = $gameStore.selectedCell || { x: null, y: null };
	$: hasSelection = selectedCell.x !== null && selectedCell.y !== null;
	$: selectedCellValue = hasSelection ? $gameStore.grid[selectedCell.y][selectedCell.x] : null;

	function handleUndo() {
		gameStore.undo();
	}

	function handleRedo() {
		gameStore.redo();
	}

	function handleHint() {
		if ($gameStore.isPaused || !hintsAvailable || !hasSelection || selectedCellValue !== 0) {
			return;
		}

		const hintValue = gameStore.getAnswerValue(selectedCell.x, selectedCell.y);

		if (!hintValue) {
			return;
		}

		if ($candidates.hasOwnProperty(selectedCell.x + ',' + selectedCell.y)) {
			candidates.clear(selectedCell);
		}

		gameStore.guess({ row: selectedCell.y, col: selectedCell.x, value: hintValue });
		hints.useHint();
	}

	function handleExplore() {
		if ($gameStore.isPaused || !hasSelection || $gameStore.selectedCandidates.length <= 1) {
			return;
		}

		gameStore.startExplore({
			selectedCell,
			selectedCandidates: $gameStore.selectedCandidates
		});
		exploreMenuOpen = false;
	}

	function toggleExploreMenu() {
		if (!$gameStore.isExploring) {
			return;
		}

		exploreMenuOpen = !exploreMenuOpen;
	}

	function confirmExploreMerge() {
		gameStore.commitExplore();
		exploreMenuOpen = false;
	}

	function abandonExplore() {
		gameStore.endExplore();
		exploreMenuOpen = false;
	}

	function handleWindowClick(e) {
		if (exploreMenuOpen && menuRef && !menuRef.contains(e.target)) {
			exploreMenuOpen = false;
		}
	}
</script>

<div class="action-buttons space-x-3">

	<button class="btn btn-round" disabled={$gameStore.isPaused || !$gameStore.canUndo} title="Undo" on:click={handleUndo}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
		</svg>
	</button>

	<button class="btn btn-round" disabled={$gameStore.isPaused || !$gameStore.canRedo} title="Redo" on:click={handleRedo}>
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 90 00-8 8v2M21 10l-6 6m6-6l-6-6" />
		</svg>
	</button>

	<button class="btn btn-round btn-badge" disabled={$gameStore.isPaused || !hintsAvailable || !hasSelection || selectedCellValue !== 0} on:click={handleHint} title="Hints ({$hints})">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
		</svg>

		{#if $settings.hintsLimited}
			<span class="badge" class:badge-primary={hintsAvailable}>{$hints}</span>
		{/if}
	</button>

	<button class="btn btn-round btn-badge" on:click={notes.toggle} title="Notes ({$notes ? 'ON' : 'OFF'})">
		<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
		</svg>

		<span class="badge tracking-tighter" class:badge-primary={$notes}>{$notes ? 'ON' : 'OFF'}</span>
	</button>

	<div class="explore-control relative" bind:this={menuRef} window:click={handleWindowClick}>
		<button
			class="btn btn-round btn-badge"
			class:explore-active={$gameStore.isExploring}
			disabled={$gameStore.isPaused || (!$gameStore.isExploring && (!hasSelection || $gameStore.selectedCandidates.length <= 1))}
			on:click={$gameStore.isExploring ? toggleExploreMenu : handleExplore}
			title={$gameStore.isExploring ? 'Exit Explore' : 'Explore'}>
			<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 19.5l-1.5-1.5m0 0L5 14m4-4l4 4m0 0l4-4m-4 4V3" />
			</svg>

			<span class="badge tracking-tighter" class:badge-primary={$gameStore.isExploring}>{$gameStore.isExploring ? 'ON' : 'EXP'}</span>
		</button>

		{#if $gameStore.isExploring && exploreMenuOpen}
			<div class="explore-menu">
				<button class="explore-menu-item" on:click={confirmExploreMerge}>确认合并</button>
				<button class="explore-menu-item" on:click={abandonExplore}>放弃探索</button>
			</div>
		{/if}
	</div>

</div>


<style>
	.action-buttons {
		@apply flex flex-wrap justify-evenly self-end;
	}

	.btn-badge {
		@apply relative;
	}

	.badge {
		min-height: 20px;
		min-width:  20px;
		@apply p-1 rounded-full leading-none text-center text-xs text-white bg-gray-600 inline-block absolute top-0 left-0;
	}

	.badge-primary {
		@apply bg-primary;
	}

	.explore-active {
		@apply bg-primary-light text-gray-900;
	}

	.explore-menu {
		@apply absolute z-20 mt-3 right-0 flex flex-col rounded-lg shadow-xl overflow-hidden bg-white border border-gray-200;
	}

	.explore-menu-item {
		@apply px-4 py-2 text-sm text-gray-800 text-left;
		white-space: nowrap;
	}

	.explore-menu-item:hover {
		@apply bg-primary text-white;
	}
</style>