function copyGrid(grid) {
  return grid.map(row => [...row]);
}

function gridSignature(grid) {
  return grid.map(row => row.join('')).join('|');
}

function cloneMove(move) {
  return {
    row: move.row,
    col: move.col,
    value: move.value
  };
}

function isValidSelectedCell(selectedCell) {
  return selectedCell
    && typeof selectedCell.x === 'number'
    && typeof selectedCell.y === 'number';
}

export function createExploreSession(options = {}) {
  const {
    sudoku,
    failureMemory = { branchFailures: new Map(), failedStates: new Set() },
    branchCell = null,
    branchCandidates = []
  } = options;

  const normalizedBranchCandidates = Array.isArray(branchCandidates)
    ? [...new Set(branchCandidates)]
    : [];

  const baseSnapshot = sudoku.clone();
  const branchAnchorSignature = gridSignature(baseSnapshot.getGrid());
  let currentSudoku = baseSnapshot.clone();
  let undoStack = [];
  let redoStack = [];
  const failedStates = new Set();
  let status = 'active';
  let failureReason = null;
  let branchChoiceValue = null;

  function rememberFailedState(signature) {
    failedStates.add(signature);
    failureMemory.failedStates.add(signature);
  }

  function recordBranchFailureIfNeeded() {
    if (branchChoiceValue === null) {
      return;
    }

    if (normalizedBranchCandidates.length > 0 && !normalizedBranchCandidates.includes(branchChoiceValue)) {
      return;
    }

    let failedCandidates = failureMemory.branchFailures.get(branchAnchorSignature);
    if (!failedCandidates) {
      failedCandidates = new Set();
      failureMemory.branchFailures.set(branchAnchorSignature, failedCandidates);
    }

    failedCandidates.add(branchChoiceValue);

    if (normalizedBranchCandidates.length > 0 && failedCandidates.size >= normalizedBranchCandidates.length) {
      rememberFailedState(branchAnchorSignature);
      status = 'failed';
      failureReason = '分支候选全部失败';
    }
  }

  function markFailed(reason) {
    status = 'failed';
    failureReason = reason;
    rememberFailedState(gridSignature(currentSudoku.getGrid()));
    recordBranchFailureIfNeeded();
  }

  function hasDeadEndCell() {
    if (typeof currentSudoku.getCandidates !== 'function') {
      return false;
    }

    const currentGrid = currentSudoku.getGrid();
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentGrid[row][col] !== 0) {
          continue;
        }

        if (currentSudoku.getCandidates(row, col).length === 0) {
          return true;
        }
      }
    }

    return false;
  }

  function ensureMutable() {
    if (status === 'failed') {
      throw new Error(failureReason || '探索失败');
    }

    if (status === 'solved') {
      throw new Error('探索已完成，不能继续修改');
    }
  }

  function refreshStatus() {
    const currentGrid = currentSudoku.getGrid();
    const invalidCells = currentSudoku.getConflictingCells();
    const signature = gridSignature(currentGrid);

    if (failedStates.has(signature) || failureMemory.failedStates.has(signature)) {
      status = 'failed';
      failureReason = '重复失败局面';
      return;
    }

    if (invalidCells.length > 0) {
      markFailed('冲突失败');
      return;
    }

    if (hasDeadEndCell()) {
      markFailed('死路失败');
      return;
    }

    const hasEmptyCell = currentGrid.some(row => row.some(cell => cell === 0));
    if (!hasEmptyCell) {
      status = 'solved';
      failureReason = null;
      return;
    }

    status = 'active';
    failureReason = null;
  }

  function rebuildFromHistory(history) {
    currentSudoku = baseSnapshot.clone();
    undoStack = [];
    redoStack = [];

    history.forEach(move => {
      currentSudoku.guess(move);
      undoStack.push(cloneMove(move));
    });

    refreshStatus();
  }

  refreshStatus();

  return {
    getBaseSnapshot() {
      return baseSnapshot.clone();
    },

    getSudoku() {
      return currentSudoku.clone();
    },

    getCurrentSudoku() {
      return currentSudoku.clone();
    },

    getCurrentGrid() {
      return currentSudoku.getGrid();
    },

    getCandidates(row, col) {
      if (typeof currentSudoku.getCandidates === 'function') {
        return currentSudoku.getCandidates(row, col);
      }
      return [];
    },

    guess(move) {
      ensureMutable();
      if (undoStack.length === 0 && branchChoiceValue === null) {
        if (!branchCell || (move.row === branchCell.y && move.col === branchCell.x)) {
          branchChoiceValue = move.value;
        }
      }
      currentSudoku.guess(move);
      undoStack.push(cloneMove(move));
      redoStack = [];
      refreshStatus();
    },

    clearCell(row, col) {
      ensureMutable();
      currentSudoku.clearCell(row, col);
      redoStack = [];
      refreshStatus();
    },

    undo() {
      if (undoStack.length === 0) {
        return;
      }

      const lastMove = undoStack.pop();
      redoStack.push(cloneMove(lastMove));
      currentSudoku.clearCell(lastMove.row, lastMove.col);
      if (undoStack.length === 0) {
        branchChoiceValue = null;
      }
      refreshStatus();
    },

    redo() {
      if (redoStack.length === 0) {
        return;
      }

      const nextMove = redoStack.pop();
      if (undoStack.length === 0 && branchChoiceValue === null) {
        if (!branchCell || (nextMove.row === branchCell.y && nextMove.col === branchCell.x)) {
          branchChoiceValue = nextMove.value;
        }
      }
      currentSudoku.guess(nextMove);
      undoStack.push(cloneMove(nextMove));
      refreshStatus();
    },

    canUndo() {
      return undoStack.length !== 0;
    },

    canRedo() {
      return redoStack.length !== 0;
    },

    rollbackToBranchPoint() {
      currentSudoku = baseSnapshot.clone();
      undoStack = [];
      redoStack = [];
      status = 'active';
      failureReason = null;
      branchChoiceValue = null;
    },

    forkWithCandidate(selectedCell, value) {
      if (!isValidSelectedCell(selectedCell)) {
        throw new Error('selectedCell 非法');
      }

      const forkSession = createExploreSession({ sudoku: baseSnapshot });
      forkSession.guess({ row: selectedCell.y, col: selectedCell.x, value });
      return forkSession;
    },

    hasConflict() {
      return currentSudoku.getConflictingCells().length > 0;
    },

    isFailed() {
      return status === 'failed';
    },

    getStatus() {
      return status;
    },

    getFailureReason() {
      return failureReason;
    },

    recordFailedState() {
      const signature = gridSignature(currentSudoku.getGrid());
      failedStates.add(signature);
      failureMemory.failedStates.add(signature);
    },

    hasSeenFailedState() {
      const signature = gridSignature(currentSudoku.getGrid());
      return failedStates.has(signature) || failureMemory.failedStates.has(signature);
    },

    toJSON() {
      return {
        baseSnapshot: baseSnapshot.toJSON(),
        currentSudoku: currentSudoku.toJSON(),
        undoStack: undoStack.map(cloneMove),
        redoStack: redoStack.map(cloneMove),
        failedStates: Array.from(failedStates),
        status,
        failureReason
      };
    },

    restoreHistory(history) {
      rebuildFromHistory(history.undoStack || []);
      redoStack = (history.redoStack || []).map(cloneMove);
      branchChoiceValue = undoStack.length > 0 ? undoStack[0].value : null;
    }
  };
}
