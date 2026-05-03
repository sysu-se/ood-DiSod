<script>
	import { getContext } from 'svelte';
	import { BOX_SIZE } from '@sudoku/constants';
	import { settings } from '@sudoku/stores/settings';
	import { candidates } from '@sudoku/stores/candidates';
	import Cell from './Cell.svelte';
	//引入适配层
	const gameStore = getContext('gameStore');

	function isSelected(selectedCell, x, y) {
		return selectedCell.x === x && selectedCell.y === y;
	}

	function isSameArea(selectedCell, x, y) {
		if (selectedCell.x === null && selectedCell.y === null) return false;
		if (selectedCell.x === x || selectedCell.y === y) return true;

		const cursorBoxX = Math.floor(selectedCell.x / BOX_SIZE);
		const cursorBoxY = Math.floor(selectedCell.y / BOX_SIZE);
		const cellBoxX = Math.floor(x / BOX_SIZE);
		const cellBoxY = Math.floor(y / BOX_SIZE);
		return (cursorBoxX === cellBoxX && cursorBoxY === cellBoxY);
	}

	function getValueAtCursor(gridStore, selectedCell) {
		if (selectedCell.x === null && selectedCell.y === null) return null;

		return gridStore[selectedCell.y][selectedCell.x];
	}
</script>

<div class="board-padding relative z-10">
	<div class="max-w-xl relative">
		<div class="w-full" style="padding-top: 100%"></div>
	</div>
	<div class="board-padding absolute inset-0 flex justify-center">

		<div class="bg-white shadow-2xl rounded-xl overflow-hidden w-full h-full max-w-xl grid" class:bg-gray-200={$gameStore.isPaused}>

			{#each $gameStore.grid as row, y}
				{#each row as value, x}
					<Cell {value}
					      cellY={y + 1}
					      cellX={x + 1}
					      candidates={$candidates[x + ',' + y]}
					      disabled={$gameStore.isPaused}
					      selected={isSelected($gameStore.selectedCell, x, y)}
					      userNumber={value !== 0}
					      sameArea={$settings.highlightCells && !isSelected($gameStore.selectedCell, x, y) && isSameArea($gameStore.selectedCell, x, y)}
					      sameNumber={$settings.highlightSame && value && !isSelected($gameStore.selectedCell, x, y) && getValueAtCursor($gameStore.grid, $gameStore.selectedCell) === value}
					      conflictingNumber={$settings.highlightConflicting && value !== 0 && $gameStore.invalidCells.includes(x + ',' + y)} />
				{/each}
			{/each}

		</div>

	</div>
</div>

<style>
	.board-padding {
		@apply px-4 pb-4;
	}
</style>