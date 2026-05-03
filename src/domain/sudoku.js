 /**提供深拷贝，在各个函数间传递grid
 */
function deepCopyGrid(grid) {
  return grid.map(row => [...row]);
}

/**
 * 候选数字在 3x3 小网格中的显示坐标。
 * 每项为 [rowStart, colStart]，索引 0..8 对应候选数 1..9。
 */
export function getCandidateCoords() {
  return [
    [1, 1], [1, 2], [1, 3],
    [2, 1], [2, 2], [2, 3],
    [3, 1], [3, 2], [3, 3]
  ];
}


/** sudoku下的创建对象函数
 * Sudoku 对象必须至少提供：
{
  getGrid(): number[][]
  guess(move): void
  clone(): SudokuLike
  toJSON(): any
  toString(): string
}
*/

export function createSudoku(input) {

  let grid = deepCopyGrid(input);

  return {
    /**用于返回grid的深拷贝的get接口 */
    getGrid() {
      return deepCopyGrid(grid);
    },

/** 将move步放入grid中，提供单格内的检查 */
    guess(move) {
      const { row, col, value } = move;

      if (row < 0 || row > 8 || col < 0 || col > 8||value < 1 || value > 9) {
        throw new Error('move 非法');
      }
      if (grid[row][col] !== 0) {
        throw new Error('这位置有人了');
      }

      grid[row][col] = value;
    },

    /**
     * 删除指定格子的值
     */
    clearCell(row, col) {
      if (row < 0 || row > 8 || col < 0 || col > 8) {
        throw new Error('move 非法');
      }
      if (grid[row][col] === 0) {
        throw new Error('该位置已为空');
      }
      grid[row][col] = 0;
    },


/**返回sudoku的深拷贝，注意不是grid */
    clone() {
      return createSudoku(deepCopyGrid(grid));
    },

/**序列化函数,toJSON负责了执行js自动json化的规则，这里我们只考虑grid本体 */
    toJSON() {
      return {
        grid: deepCopyGrid(grid)
      };
    },

/** 外表化函数，负责在终端输出一个形象化的图 */
    toString() {
      let result = '';
      for (let row = 0; row < 9; row++) {
        if (row === 3 || row === 6) {
          result += '------+-------+------\n';
        }

        for (let col = 0; col < 9; col++) {
          if (col === 3 || col === 6) {
            result += '| ';
          }

          const value = grid[row][col];
          result += value === 0 ? '. ' : value + ' ';
        }
        result += '\n';
      }
      return result.trim();
    },

    /**
     * 验证一次 guess 操作是否符合数独规则（不检查前置条件，只检查业务合法性）。
     * 返回 true 表示该位置填入该数字不违反行/列/宫规则；false 表示违反。
     */
    isValidMove(row, col, value) {
      // 行检查：检查该行是否已有相同数字
      for (let c = 0; c < 9; c++) {
        if (c !== col && grid[row][c] === value) {
          return false;
        }
      }

      // 列检查：检查该列是否已有相同数字
      for (let r = 0; r < 9; r++) {
        if (r !== row && grid[r][col] === value) {
          return false;
        }
      }

      // 3x3 宫检查：检查该宫是否已有相同数字
      const boxStartRow = Math.floor(row / 3) * 3;
      const boxStartCol = Math.floor(col / 3) * 3;
      for (let r = boxStartRow; r < boxStartRow + 3; r++) {
        for (let c = boxStartCol; c < boxStartCol + 3; c++) {
          if ((r !== row || c !== col) && grid[r][c] === value) {
            return false;
          }
        }
      }

      return true;
    },

    /**
     * 获取某个格子的合法候选数（1..9）。
     * 若格子已被填入数字，候选为空数组。
     */
    getCandidates(row, col) {
      if (row < 0 || row > 8 || col < 0 || col > 8) {
        throw new Error('move 非法');
      }

      if (grid[row][col] !== 0) {
        return [];
      }

      const candidates = [];
      for (let value = 1; value <= 9; value++) {
        if (this.isValidMove(row, col, value)) {
          candidates.push(value);
        }
      }

      return candidates;
    },

    /**
     * 找出当前盘面中所有违反数独规则的格子坐标。
     * 返回格式是 ["x,y", ...]，方便 UI 判断是否冲突。
     * 复用行/列/宫检查逻辑确保校验统一在 Sudoku 层。
     */
    getConflictingCells() {
      const conflicting = new Set();

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const value = grid[row][col];
          if (value !== 0) {
            // 检查该格子的值是否与其他格子冲突
            let hasConflict = false;

            // 行检查
            for (let c = 0; c < 9; c++) {
              if (c !== col && grid[row][c] === value) {
                hasConflict = true;
                break;
              }
            }

            // 列检查
            if (!hasConflict) {
              for (let r = 0; r < 9; r++) {
                if (r !== row && grid[r][col] === value) {
                  hasConflict = true;
                  break;
                }
              }
            }

            // 宫检查
            if (!hasConflict) {
              const boxStartRow = Math.floor(row / 3) * 3;
              const boxStartCol = Math.floor(col / 3) * 3;
              for (let r = boxStartRow; r < boxStartRow + 3; r++) {
                for (let c = boxStartCol; c < boxStartCol + 3; c++) {
                  if ((r !== row || c !== col) && grid[r][c] === value) {
                    hasConflict = true;
                    break;
                  }
                }
              }
            }

            if (hasConflict) {
              conflicting.add(`${col},${row}`);
            }
          }
        }
      }

      return Array.from(conflicting);
    }
  };
}
/**反序列化创建suduko，json只存放了图，把图作为输入就可以了 */
export function createSudokuFromJSON(json) {
  return createSudoku(json.grid);
}