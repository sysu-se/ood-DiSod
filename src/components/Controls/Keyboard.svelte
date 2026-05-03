<script>
	import { getContext } from 'svelte';
	import { SUDOKU_SIZE } from '@sudoku/constants';
	import { notes } from '@sudoku/stores/notes';
	import { candidates } from '@sudoku/stores/candidates';

	const gameStore = getContext('gameStore');

	$: selectedCandidates = $gameStore.selectedCandidates || [];

	function moveSelectedCell(xDir = 0, yDir = 0) {
		const selectedCell = $gameStore.selectedCell || { x: null, y: null };
		let newX = selectedCell.x + xDir;
		let newY = selectedCell.y + yDir;

		if (newX < 0) newX = SUDOKU_SIZE - 1;
		if (newX >= SUDOKU_SIZE) newX = 0;
		if (newY < 0) newY = SUDOKU_SIZE - 1;
		if (newY >= SUDOKU_SIZE) newY = 0;

		gameStore.selectCell(newX, newY);
	}

	function handleKeyButton(num) {
		const selectedCell = $gameStore.selectedCell;
		if ($gameStore.isPaused || selectedCell.x === null || selectedCell.y === null) {
			return;
		}

		const cursorKey = `${selectedCell.x},${selectedCell.y}`;
		const currentValue = $gameStore.grid[selectedCell.y][selectedCell.x];

		if ($notes) {
			if (num === 0) {
				candidates.clear(selectedCell);
			} else {
				candidates.add(selectedCell, num);
			}

			if (currentValue !== 0) {
				gameStore.clearCell(selectedCell.x, selectedCell.y);
			}
		} else {
			if ($candidates.hasOwnProperty(cursorKey)) {
				candidates.clear(selectedCell);
			}

			if (num === 0) {
				gameStore.clearCell(selectedCell.x, selectedCell.y);
			} else {
				gameStore.guess({ row: selectedCell.y, col: selectedCell.x, value: num });
			}
		}
	}

	function handleKey(e) {
		switch (e.key || e.keyCode) {
			case 'ArrowUp':
			case 38:
			case 'w':
			case 87:
					moveSelectedCell(0, -1);
				break;

			case 'ArrowDown':
			case 40:
			case 's':
			case 83:
					moveSelectedCell(0, 1);
				break;

			case 'ArrowLeft':
			case 37:
			case 'a':
			case 65:
					moveSelectedCell(-1);
				break;

			case 'ArrowRight':
			case 39:
			case 'd':
			case 68:
					moveSelectedCell(1);
				break;

			case 'Backspace':
			case 8:
			case 'Delete':
			case 46:
				handleKeyButton(0);
				break;

			default:
				if (e.key && e.key * 1 >= 0 && e.key * 1 < 10) {
					handleKeyButton(e.key * 1);
				} else if (e.keyCode - 48 >= 0 && e.keyCode - 48 < 10) {
					handleKeyButton(e.keyCode - 48);
				}
				break;
		}
	}
</script>

<svelte:window on:keydown={handleKey} /><!--on:beforeunload|preventDefault={e => e.returnValue = ''} />-->

<div class="keyboard-grid">

	{#each Array(10) as _, keyNum}
		{#if keyNum === 9}
			<button class="btn btn-key" disabled={$gameStore.isPaused} title="Erase Field" on:click={() => handleKeyButton(0)}>
				<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
				</svg>
			</button>
		{:else}
			<button class="btn btn-key" class:candidate-legal={selectedCandidates.includes(keyNum + 1)} disabled={$gameStore.isPaused} title="Insert {keyNum + 1}" on:click={() => handleKeyButton(keyNum + 1)}>
				{keyNum + 1}
			</button>
		{/if}
	{/each}

</div>

<style>
	.keyboard-grid {
		@apply grid grid-rows-2 grid-cols-5 gap-3;
	}


	.btn-key {
		@apply py-4 px-0;
	}

	.candidate-legal {
		@apply bg-primary-light text-gray-900 border-2 border-primary;
	}
</style>