


import { createSudoku } from './sudoku.js';
import { createExploreSession } from './explore-session.js';

function copyGrid(grid) {
  return grid.map(row => [...row]);
}

function isValidAnswerGrid(grid) {
  return Array.isArray(grid)
    && grid.length === 9
    && grid.every(row => Array.isArray(row) && row.length === 9);
}

function isValidInGrid(grid, row, col, value) {
  for (let i = 0; i < 9; i++) {
    if (grid[row][i] === value) return false;
    if (grid[i][col] === value) return false;
  }

  const boxStartRow = Math.floor(row / 3) * 3;
  const boxStartCol = Math.floor(col / 3) * 3;
  for (let r = boxStartRow; r < boxStartRow + 3; r++) {
    for (let c = boxStartCol; c < boxStartCol + 3; c++) {
      if (grid[r][c] === value) return false;
    }
  }

  return true;
}

function findEmptyCell(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] === 0) {
        return { row, col };
      }
    }
  }
  return null;
}

function solveGridBacktracking(grid) {
  const emptyCell = findEmptyCell(grid);
  if (!emptyCell) {
    return true;
  }

  const { row, col } = emptyCell;

  for (let value = 1; value <= 9; value++) {
    if (!isValidInGrid(grid, row, col, value)) {
      continue;
    }

    grid[row][col] = value;
    if (solveGridBacktracking(grid)) {
      return true;
    }
    grid[row][col] = 0;
  }

  return false;
}

function solveGrid(grid) {
  const solved = copyGrid(grid);
  const canSolve = solveGridBacktracking(solved);
  if (!canSolve) {
    throw new Error('无法求解当前数独局面');
  }
  return solved;
}

function cloneMove(move) {
  return {
    row: move.row,
    col: move.col,
    value: move.value
  };
}

/**
 * Game对象下的创建对象函数
 * Game 对象必须至少提供：
{
  getSudoku(): SudokuLike
  guess(move): void
  undo(): void
  redo(): void
  canUndo(): boolean
  canRedo(): boolean
  toJSON(): any
}
 */
export function createGame({ sudoku }) {

  // currentSudoku存放了目前的局面
  let currentSudoku = sudoku.clone();
  // answerGrid 存放该题目的完整解，后续提示和一键求解都直接读取它
  let answerGrid = solveGrid(sudoku.getGrid());
  
  // History management, 现在只存储 guess move 而不是整个 board snapshot
  let undoStack = [];
  let redoStack = [];

  return {
    /**
     * 返回当前sudoku
     */
    getSudoku() {
      return currentSudoku.clone();
    },

    createExploreSession(options = {}) {
      return createExploreSession({
        sudoku: currentSudoku,
        ...options
      });
    },

    getAnswerGrid() {
      return copyGrid(answerGrid);
    },

    getAnswerValue(row, col) {
      if (row < 0 || row > 8 || col < 0 || col > 8) {
        throw new Error('move 非法');
      }
      return answerGrid[row][col];
    },

    /**
     * 在currentGrid上move。注意要维护undo，redo动作
     */
    guess(move) {
      // 旧逻辑：先保存整个 board snapshot，再执行 guess
      // 新逻辑：只保存这一步 move，history stack 更轻量
      currentSudoku.guess(move);
      undoStack.push(cloneMove(move));

      // 进行了新的输入，我们清空 redo 栈
      redoStack = [];
    },

    /**
     * 直接求解当前局面，并把所有新增填入记录为可撤销的 move。
     */
    solveSudoku() {
      const currentGrid = currentSudoku.getGrid();
      const solvedGrid = answerGrid;

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const currentValue = currentGrid[row][col];
          const solvedValue = solvedGrid[row][col];

          if (currentValue === 0) {
            const move = { row, col, value: solvedValue };
            currentSudoku.guess(move);
            undoStack.push(cloneMove(move));
          }
        }
      }

      // 求解相当于新的用户动作，清空可重做栈
      redoStack = [];
    },

    /**
     * 清空指定格子。与 guess 一样，属于一次新的用户输入，
     * 因此会清空 redo 栈。
     */
    clearCell(row, col) {
      currentSudoku.clearCell(row, col);
      redoStack = [];
    },

    /**
     * 撤销上一次移动。把上一步 move 记录压入 redo，恢复到上一步局面
     */
    undo() {
      if (undoStack.length === 0) {
        return;
      }

      const lastMove = undoStack.pop();
      redoStack.push(cloneMove(lastMove));

      // 旧逻辑：恢复一个 snapshot board
      // 新逻辑：直接调用 Sudoku 的删除方法，不需要重建整个对象
      currentSudoku.clearCell(lastMove.row, lastMove.col);
    },

    /**
     * 重做上一次撤销。重新执行被撤销的 move
     */
    redo() {
      if (redoStack.length === 0) {
        return;
      }

      const nextMove = redoStack.pop();
      currentSudoku.guess(nextMove);
      undoStack.push(cloneMove(nextMove));
    },

    /**
     * 能不能撤销呢？就是问undo栈中有没有数据可供undo，检查栈就好了
     */
    canUndo() {
      return undoStack.length !== 0;
    },

    /**
     * 同canUndo
     */
    canRedo() {
      return redoStack.length !== 0;
    },

    /**
     * game包含sudoku，我们当然要json化。game的额外功能就是undo/redo
     */
    toJSON() {
      return {
        currentSudoku: currentSudoku.toJSON(),
        answerGrid: copyGrid(answerGrid),
        undoStack: undoStack.map(cloneMove),
        redoStack: redoStack.map(cloneMove)
      };
    },

    restoreHistory(history) {
      undoStack = history.undoStack.map(cloneMove);
      redoStack = history.redoStack.map(cloneMove);
    },

    restoreAnswerGrid(grid) {
      if (!isValidAnswerGrid(grid)) {
        throw new Error('answerGrid 非法');
      }
      answerGrid = copyGrid(grid);
    }
  };
}

/**
 * 反序列化创建game，实际上就是把sudoku，两个栈反序列化
 */
export function createGameFromJSON(json) {
  const currentSudoku = createSudoku(json.currentSudoku.grid);
  const game = createGame({ sudoku: currentSudoku });

  if (json.answerGrid) {
    game.restoreAnswerGrid(json.answerGrid);
  }

  if (json.undoStack || json.redoStack) {
    game.restoreHistory({
      undoStack: json.undoStack || [],
      redoStack: json.redoStack || []
    });
  }

  return game;
}
