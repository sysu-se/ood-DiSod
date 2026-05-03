import { writable } from 'svelte/store';
import { createGame, createGameFromJSON } from './game.js';
import { createSudoku } from './sudoku.js';

// In the original app these came from an external '@sudoku/stores' package
// (timer/modal). For the domain tests we provide minimal no-op
// implementations here so importing `src/domain/store.js` doesn't fail
// when that package isn't present in the test environment.
const timer = {
  start() {},
  stop() {},
  reset() {},
};

const modal = {
  show() {},
  hide() {},
};

/** Helper: 判断当前盘面是否已经填满（没有空格） */
function isFull(grid) {
  return grid.every(row => row.every(cell => cell !== 0));
}

/** 标准化选中格子输入，避免 store 保存非法值。 */
function normalizeSelectedCell(selectedCell) {
  if (!selectedCell || typeof selectedCell.x !== 'number' || typeof selectedCell.y !== 'number') {
    return { x: null, y: null };
  }
  return selectedCell;
}

function getSelectedCandidates(sudoku, selectedCell) {
  if (selectedCell.x === null || selectedCell.y === null) {
    return [];
  }

  if (typeof sudoku.getCandidates !== 'function') {
    return [];
  }

  return sudoku.getCandidates(selectedCell.y, selectedCell.x);
}

function getGridSignature(game) {
  if (typeof game.getCurrentGrid !== 'function') {
    return '';
  }

  return game.getCurrentGrid().map(row => row.join('')).join('|');
}

/**
 * 创建一个面向 Svelte 的 Sudoku 适配层。
 *
 * 它持有一个 Sudoku 对象，暴露 subscribe() 给组件消费。组件可以直接
 * 通过 this store 读取当前 grid、invalidCells 和 won 状态，同时调用 guess()。
 */

/**
 * 计算一个 Sudoku 适配层应暴露给 UI 的状态。
 * 这里把 Sudoku 领域对象的内部数据翻译成可被 Svelte 消费的纯数据。
 */
function computeSudokuState(sudoku, selectedCell) {
  const grid = sudoku.getGrid();
  const invalidCells = sudoku.getConflictingCells();
  const selectedCandidates = getSelectedCandidates(sudoku, selectedCell);

  return {
    grid,
    invalidCells,
    won: isFull(grid) && invalidCells.length === 0,
    selectedCell,
    selectedCandidates,
  };
}

/**
 * 计算一个 Game 适配层应暴露给 UI 的状态。
 * 包含 Sudoku 状态，并增加 undo/redo 能力的可用性信息。
 */
function computeGameState(game, selectedCell, pauseCount = 0) {
  const sudoku = game.getSudoku();
  const state = computeSudokuState(sudoku, selectedCell);
  const isFailed = typeof game.isFailed === 'function' ? game.isFailed() : false;
  const exploreStatus = typeof game.getStatus === 'function' ? game.getStatus() : null;
  const exploreFailureReason = typeof game.getFailureReason === 'function' ? game.getFailureReason() : null;

  return {
    ...state,
    canUndo: game.canUndo(),
    canRedo: game.canRedo(),
    pauseCount,
    isPaused: pauseCount > 0,
    isFailed,
    exploreStatus,
    exploreFailureReason,
  };
}



/** 作为adapter向svelte提供他需要的格式，同时封装相关函数，令数据更新时会触发UI更新 */
export function createSudokuStore({ sudoku }) {
  /** 允许传入已经是 Sudoku 实例，也可以传入初始 grid 数据。 */
  let sudokuInstance = sudoku && typeof sudoku.clone === 'function'
    ? sudoku
    : createSudoku(sudoku);

  let selectedCell = { x: null, y: null };

  const store = writable(computeSudokuState(sudokuInstance, selectedCell));

  /** 当 Sudoku 内部发生变化时，重新计算并推送所有 UI 状态。 */
  function refreshSudokuStore() {
    //计算新状态，用set进行更新，set会触发使用订阅者更新UI
    store.set(computeSudokuState(sudokuInstance, selectedCell));
  }

  function guess(move) {
    sudokuInstance.guess(move);
    refreshSudokuStore();
  }

  function clearCell(row, col) {
    if (typeof sudokuInstance.clearCell !== 'function') {
      throw new Error('Sudoku does not support clearCell');
    }
    sudokuInstance.clearCell(row, col);
    refreshSudokuStore();
  }

  function selectCell(x, y) {
    selectedCell = normalizeSelectedCell({ x, y });
    refreshSudokuStore();
  }

  function loadSudoku(sudokuInput) {
    sudokuInstance = sudokuInput && typeof sudokuInput.clone === 'function'
      ? sudokuInput
      : createSudoku(sudokuInput);
    selectedCell = { x: null, y: null };
    refreshSudokuStore();
  }

  return {
    subscribe: store.subscribe,
    guess,
    clearCell,
    selectCell,
    loadSudoku,
  };
}

/** 作为adapter向svelte提供他需要的格式，同时封装相关函数，令数据更新时会触发UI更新 */
export function createGameStore({ game, sudoku }) {
  let gameInstance = game || createGame({ sudoku: sudoku && sudoku.clone ? sudoku : createSudoku(sudoku) });
  let selectedCell = { x: null, y: null };
  let pauseCount = 0;
  let exploreSession = null;
  const exploreFailureMemory = {
    branchFailures: new Map(),
    failedStates: new Set()
  };
  let exploreFailureDialogOpen = false;
  const store = writable({
    ...computeGameState(gameInstance, selectedCell, pauseCount),
    isExploring: false,
  });

  function showExploreFailureDialog(activeGame) {
    if (!exploreSession || typeof activeGame.isFailed !== 'function' || !activeGame.isFailed()) {
      exploreFailureDialogOpen = false;
      return;
    }

    if (exploreFailureDialogOpen) {
      return;
    }

    exploreFailureDialogOpen = true;
    const failureReason = typeof activeGame.getFailureReason === 'function'
      ? activeGame.getFailureReason()
      : '探索失败';

    modal.show('explorefailure', {
      title: '探索失败',
      reason: failureReason,
      text: '当前探索分支已经不可继续。你可以回滚到探索前，或者保留临时状态继续用撤销/重做调整。',
      onRollback: () => {
        if (exploreSession && typeof exploreSession.rollbackToBranchPoint === 'function') {
          exploreSession.rollbackToBranchPoint();
        }
        endExplore();
      },
      onUndo: () => undo(),
      onRedo: () => redo()
    });
  }

  function refreshGameStore() {
    const activeGame = exploreSession || gameInstance;
    store.set({
      ...computeGameState(activeGame, selectedCell, pauseCount),
      isExploring: exploreSession !== null,
    });

    if (!exploreSession || typeof activeGame.isFailed !== 'function' || !activeGame.isFailed()) {
      exploreFailureDialogOpen = false;
      return;
    }

    showExploreFailureDialog(activeGame);
  }

  function resetExploreFailureMemory() {
    exploreFailureMemory.branchFailures.clear();
    exploreFailureMemory.failedStates.clear();
  }

  function guess(move) {
    const activeGame = exploreSession || gameInstance;
    if (exploreSession && typeof activeGame.isFailed === 'function' && activeGame.isFailed()) {
      refreshGameStore();
      return;
    }

    activeGame.guess(move);
    refreshGameStore();
  }

  function clearCell(x, y) {
    const activeGame = exploreSession || gameInstance;
    if (typeof activeGame.clearCell !== 'function') {
      throw new Error('Game does not support clearCell');
    }

    if (exploreSession && typeof activeGame.isFailed === 'function' && activeGame.isFailed()) {
      refreshGameStore();
      return;
    }

    activeGame.clearCell(y, x);
    refreshGameStore();
  }

  function undo() {
    const activeGame = exploreSession || gameInstance;
    activeGame.undo();
    refreshGameStore();
  }

  function redo() {
    const activeGame = exploreSession || gameInstance;
    activeGame.redo();
    refreshGameStore();
  }

  function getAnswerValue(x, y) {
    if (typeof gameInstance.getAnswerValue !== 'function') {
      throw new Error('Game does not support answer lookup');
    }
    return gameInstance.getAnswerValue(y, x);
  }

  function selectCell(x, y) {
    selectedCell = normalizeSelectedCell({ x, y });
    refreshGameStore();
  }

  function loadGame(newGame) {
    gameInstance = newGame;
    selectedCell = { x: null, y: null };
    pauseCount = 0;
    exploreSession = null;
    resetExploreFailureMemory();
    timer.reset();
    timer.start();
    refreshGameStore();
  }

  function reset(sudokuInput) {
    const newSudoku = sudokuInput && typeof sudokuInput.clone === 'function'
      ? sudokuInput
      : createSudoku(sudokuInput);
    gameInstance = createGame({ sudoku: newSudoku });
    selectedCell = { x: null, y: null };
    pauseCount = 0;
    exploreSession = null;
    resetExploreFailureMemory();
    timer.reset();
    timer.start();
    refreshGameStore();
  }

  function startNew(sudokuInput) {
    reset(sudokuInput);
  }

  function pause() {
    const wasRunning = pauseCount === 0;
    pauseCount += 1;
    if (wasRunning) {
      timer.stop();
    }
    refreshGameStore();
  }

  function resume() {
    const wasPaused = pauseCount > 0;
    pauseCount = Math.max(0, pauseCount - 1);
    if (wasPaused && pauseCount === 0) {
      timer.start();
    }
    refreshGameStore();
  }

  function togglePause() {
    if (pauseCount > 0) {
      resume();
      return;
    }
    pause();
  }

  function startExplore(options = {}) {
    if (typeof gameInstance.createExploreSession !== 'function') {
      throw new Error('Game does not support explore session');
    }

    const branchSelectedCell = options.selectedCell || selectedCell;
    const branchCandidates = Array.isArray(options.selectedCandidates)
      ? options.selectedCandidates
      : (branchSelectedCell.x === null || branchSelectedCell.y === null
        ? []
        : computeSudokuState(gameInstance.getSudoku(), branchSelectedCell).selectedCandidates);

    exploreSession = gameInstance.createExploreSession({
      failureMemory: exploreFailureMemory,
      branchCell: branchSelectedCell,
      branchCandidates
    });
    refreshGameStore();
    return exploreSession;
  }

  function commitExplore() {
    if (!exploreSession) {
      return;
    }

    if (typeof exploreSession.getSudoku !== 'function' || typeof exploreSession.toJSON !== 'function') {
      throw new Error('Explore session does not support merge');
    }

    const baseGameJson = typeof gameInstance.toJSON === 'function'
      ? gameInstance.toJSON()
      : { undoStack: [], redoStack: [], answerGrid: null };
    const exploreJson = exploreSession.toJSON();

    gameInstance = createGameFromJSON({
      currentSudoku: exploreJson.currentSudoku,
      answerGrid: baseGameJson.answerGrid,
      undoStack: [
        ...(baseGameJson.undoStack || []),
        ...(exploreJson.undoStack || [])
      ],
      redoStack: exploreJson.redoStack || []
    });
    exploreSession = null;
    resetExploreFailureMemory();
    refreshGameStore();
  }

  function endExplore() {
    exploreSession = null;
    exploreFailureDialogOpen = false;
    refreshGameStore();
  }

  return {
    subscribe: store.subscribe,
    guess,
    clearCell,
    undo,
    redo,
    getAnswerValue,
    pause,
    resume,
    togglePause,
    startExplore,
    commitExplore,
    endExplore,
    selectCell,
    loadGame,
    reset,
    startNew,
  };
}
