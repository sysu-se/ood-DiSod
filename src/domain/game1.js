
import { createSudoku } from './sudoku.js';

/**
调用sudoku的序列化函数，将sudoku对象转化为只有grid数据的冷数据，便于存储
 */
function sudokuToJSON(sudoku) {
  return {
    sudoku: sudoku.toJSON()
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
  
  // History management
  let undoStack = [];
  let redoStack = [];

  return {
    /**
     * 返回当前sudoku
     */
    getSudoku() {
      return   currentSudoku.clone();
    },

    /**
     * 在currentGrid上move。注意要维护undo，redo动作
     */
    guess(move) {
      //压入执行前状态
      undoStack.push(sudokuToJSON(currentSudoku));

      // 进行了新的输入，我们清空redo栈
      redoStack = [];

      // 进行sudoku对象的move操作，这里后续可以加一个判断，move方法需要撤回undo,redo动作。或者记录这一步是非法的
      currentSudoku.guess(move);
    },

    /**
     * 撤销上一次移动。把现在的状态压入redo，再弹出undo中的最接近当前的上一步，作为新的状态
     */
    undo() {
      if (undoStack.length === 0) {
        return;
      }

      // 压入redo栈
      redoStack.push(sudokuToJSON(currentSudoku));

      // 弹出undo(json格式)，再恢复成sudoku
      const newSudoku = undoStack.pop();
      currentSudoku = createSudoku(newSudoku.sudoku.grid);
    },

    /**
     * 重做上一次撤销的移动。操作跟undo反过来就行了
     */
    redo() {
      if (redoStack.length === 0) {
        return;
      }

      undoStack.push(sudokuToJSON(currentSudoku));

      const newSudoku = redoStack.pop();
      currentSudoku = createSudoku(newSudoku.sudoku.grid);
    },

    /**
     * 能不能撤销呢？就是问undo栈中有没有数据可供undo，检查栈就好了
     */
    canUndo() {
      return undoStack.length != 0;
    },

    /**
     * 同canUndo
     */
    canRedo() {
      return redoStack.length != 0;
    },

    /**
     * game包含sudoku，我们当然要json化。game的额外功能就是undo/redo
     *操作undo/redo都是围绕栈展开的，我们把栈json化就好了，站内元素已经是json化的了
     */
    toJSON() {
      return {
        currentSudoku: currentSudoku.toJSON(),
        undoStack: undoStack.map(temp => temp.sudoku),
        redoStack: redoStack.map(temp => temp.sudoku)
      };
    }
  };
}

/**
 * 反序列化创建game，实际上就是把sudoku，两个栈反序列化
 */
export function createGameFromJSON(json) {
  //调用创建对象函数，先创建sudoku，再把sudoku传入creategame创建game
  const currentSudoku = createSudoku(json.currentSudoku.grid);
  const game = createGame({ sudoku: currentSudoku });       //key-value指明对象类型，后续同
  
  // 反序列化两个栈，就是直接填充
    game.undoStack = json.undoStack.map(temp => ({ sudoku: temp }));
    game.redoStack = json.redoStack.map(temp => ({ sudoku: temp }));


  return game;
}