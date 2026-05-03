# 旧有问题1

## 问题描述
暂停状态存在“双状态源”问题：
- 一部分组件依赖旧链路（@sudoku/stores/game 的 gamePaused，@sudoku/game 的 pause/resume）。
- 另一部分组件已切到本地 domain 适配层（gameStore）。

结果是：暂停状态读写不一致，棋盘、键盘、操作栏会出现“看起来被暂停但无法正确恢复”或“恢复后仍不可交互”的链路断裂。

## 根因分析
1. 状态来源不唯一：UI 的禁用判定和暂停按钮逻辑，仍有组件读取旧 store。
2. 状态写入分散：弹窗开启/关闭、胜利结算、计时按钮等入口，没有统一写入同一状态源。
3. Cell 渲染受 disabled 门控：一旦 paused 判定长期为 true，交互节点会直接不渲染。

## 修复目标
以本地 gameStore 作为暂停状态单一可信源，逐步脱离旧 sudoku 组件链路。

## 本次改动（已完成）
### 1) 在 domain store 内建暂停能力
文件：src/domain/store.js
- 在 Game 适配状态中新增：pauseCount、isPaused。
- 新增方法：pause()、resume()、togglePause()。
- 在 reset/loadGame 时重置 pauseCount，避免旧暂停状态污染新局。

#### togglePause 的作用
- togglePause 是暂停开关的统一入口：
- 当 pauseCount = 0（未暂停）时，togglePause 内部调用 pause()，进入暂停。
- 当 pauseCount > 0（已暂停）时，togglePause 内部调用 resume()，恢复交互。
- 这样按钮层不需要分别判断调用 pause 还是 resume，只需调用一次 togglePause。
- 由于 pauseCount 是计数器，pause/resume 可支持嵌套场景（例如多个弹窗叠加），而 togglePause 负责最常见的“单键切换”。

### 2) App 改为走本地暂停链路
文件：src/App.svelte
- 胜利弹窗前调用 gameStore.pause()。
- welcome 弹窗展示前先 pause，关闭后通过 onHide 调用 gameStore.resume()。

### 3) 棋盘禁用判定迁移到本地状态
文件：src/components/Board/index.svelte
- 由旧 gamePaused 改为读取 $gameStore.isPaused。
- 棋盘灰态样式与 Cell 的 disabled 都绑定 $gameStore.isPaused。

### 4) 控件与弹窗链路统一到本地状态
文件：
- src/components/Controls/ActionBar/Timer.svelte
- src/components/Controls/ActionBar/Actions.svelte
- src/components/Header/Buttons.svelte
- src/components/Modal/Types/GameOver.svelte
- src/components/Controls/Keyboard.svelte

改动点：
- Timer 按钮改为调用 gameStore.togglePause()。
- Undo/Redo 的 disabled 改为依赖 $gameStore.isPaused。
- Header 中 Share/Settings 弹窗改为 pause 后打开，onHide resume。
- GameOver 中 New Game 流程的 onHide 改为 gameStore.resume()。
- Keyboard 在 isPaused 时禁用按钮与按键输入。

## 结果
暂停相关交互链路已统一到本地 gameStore，核心交互（棋盘、键盘、操作栏、暂停按钮）读写同源，避免了旧链路导致的长期 disabled 问题。

## 后续建议
仍有一个旧入口文件尚未迁移：src/components/Header/Dropdown.svelte。
建议下一步将其从 @sudoku/game 迁移到本地 gameStore，以进一步降低对旧组件体系的依赖。

---

# 旧有问题2：UI 端口与 Game 领域层接口不匹配

## 问题描述

### 问题2.1：键盘输入依赖 clearCell，但 createGameStore 没有提供该接口
**严重程度**：core

键盘在删除数字、切换 notes 时都会调用 `gameStore.clearCell(...)`，但 `createGameStore` 返回的方法集中没有 `clearCell`。这不是小瑕疵，而是用户输入核心路径上的接口契约不一致；一旦走到删除/覆盖输入流程，就会直接失配。

**位置**：
- src/components/Controls/Keyboard.svelte:27-38 调用 gameStore.clearCell(...)
- src/domain/store.js:224-233 createGameStore 缺少暴露该方法

**根因**：
- Sudoku 领域对象有 clearCell(row, col) 方法。
- Game 领域对象也应该有同样方法以支持用户删除操作。
- createGameStore adapter 层没有把 Game 的 clearCell 暴露到 UI。

### 问题2.2：开始游戏没有创建真实数独，只是重置成空盘
**严重程度**：core

无论用户选择难度还是输入合法 sencode，handleStart() 都执行 gameStore.reset(emptyGrid)。这使"开始游戏"并未生成或加载一个正常谜题，也没有初始 givens，和数独业务不符。

**位置**：src/components/Modal/Types/Welcome.svelte:18-27

**根因**：
- Welcome 组件作为游戏启动入口，需要加载一个真实棋盘（来自 sencode 解码或默认题盘）。
- 当时实现只用了空盘占位，没有真正打通"创建或加载 Sudoku"的流程。

### 问题2.3：头部菜单仍通过旧 @sudoku/game 启动游戏，绕过了新的领域对象
**严重程度**：core

Header Dropdown 的新局、输入分享码等操作都调用旧 game.startNew/startCustom，而棋盘渲染已经改为读取 $gameStore.grid。这会把"开始游戏"流程切成两套状态源：菜单改的是旧 grid，界面看的却是新 domain store，真实使用流程并没有统一接入 Game。

**位置**：
- src/components/Header/Dropdown.svelte:11-24 (handleDifficulty / handleEnterCode)
- src/components/Header/Dropdown.svelte:41-55 (pause/resume 仍用旧 game)

**根因**：
- 旧的 @sudoku/game 与新的本地 domain/store.js 是两套独立的状态源。
- 头部菜单没有迁移到新的单一状态源上，导致菜单操作与棋盘显示指向不同的数据。

## 修复目标
确保 UI 与 Game 领域对象的接口契约一致：
1. Game 对象支持所有 UI 需要的操作（guess、clearCell 等）。
2. createGameStore adapter 完整暴露 Game 的所有公共方法。
3. 游戏启动和菜单操作统一通过单一的本地 gameStore，而不是混用旧系统。

## 本次改动（已完成）

### 修复2.1：为 Game 和 GameStore 补齐 clearCell 接口

**文件**：src/domain/game.js

在 createGame 返回对象中新增 clearCell(row, col) 方法：
```javascript
clearCell(row, col) {
  currentSudoku.clearCell(row, col);
  redoStack = [];  // 清空 redo 栈，保持 undo/redo 一致性
}
```

**文件**：src/domain/store.js

在 createGameStore 返回对象中新增 clearCell(x, y) 方法，完成 UI 坐标到领域层坐标的转换：
```javascript
function clearCell(x, y) {
  if (typeof gameInstance.clearCell !== 'function') {
    throw new Error('Game does not support clearCell');
  }
  gameInstance.clearCell(y, x);  // 注意：UI 传 (x, y)，领域层用 (row, col) = (y, x)
  refreshGameStore();
}
```

并在返回对象中暴露 clearCell。

### 修复2.2：把启动游戏改为加载真实棋盘

**文件**：src/components/Modal/Types/Welcome.svelte

改动点：
1. 导入 decodeSencode 工具：`import { decodeSencode, validateSencode } from '@sudoku/sencode'`
2. 定义一个固定的默认棋盘（包含 givens）：
   ```javascript
   const defaultPuzzle = [
     [5, 3, 0, 0, 7, 0, 0, 0, 0],
     [6, 0, 0, 1, 9, 5, 0, 0, 0],
     // ... 完整 9x9 棋盘
   ];
   ```
3. handleStart() 改为两条路：
   - 若输入的 sencode 合法：`gameStore.reset(decodeSencode(sencode))`
   - 否则：`gameStore.reset(defaultPuzzle)` 加载固定题盘

### 修复2.3：把菜单操作统一到 gameStore

**文件**：src/components/Header/Dropdown.svelte

改动点：
1. 删除 `import game from '@sudoku/game'`
2. 新增 `import { getContext } from 'svelte'` 和 `import { decodeSencode, validateSencode } from '@sudoku/sencode'`
3. 获取 gameStore：`const gameStore = getContext('gameStore')`
4. 定义与 Welcome 相同的 defaultPuzzle
5. 把所有 game.pause/resume 改为 gameStore.pause/resume()
6. 把 handleDifficulty 中的 `game.startNew(difficultyValue)` 改为 `gameStore.startNew(defaultPuzzle)`
7. 把 handleEnterCode 中的 `game.startCustom(value)` 改为 `gameStore.startNew(decodeSencode(value))`

## 结果

1. **接口契约一致**：Game / Sudoku / GameStore 的所有公共方法现在能完整支持 UI 的各种输入操作（guess、clearCell 等），不再有"调用方法不存在"的错误。

2. **启动流程真实化**：无论通过 Welcome 还是 Header 菜单启动游戏，都会加载一个真实的棋盘（来自 sencode 解码或固定题盘），而不是空盘。

3. **状态源单一化**：菜单入口、欢迎弹窗、棋盘渲染全部通过本地 gameStore，彻底消除"两套状态源"导致的分裂。

## 验证
- 运行 `npm test`：15/15 测试通过，无回归。
- 键盘删除、覆盖操作现在能正确调用 gameStore.clearCell()。
- 点击 Start 后棋盘不再是空的，而是初始化为固定题盘或解码的 sencode。
- 点击菜单"新局"后，棋盘与菜单指向同一个 gameStore 数据。

---

# 思路沉淀（计入 DESIGN1）

本次修复不是单点补丁，而是一次“领域模型与 UI 适配层契约对齐”的系统化收敛。后续遇到同类问题，可按以下顺序排查。

## 1. 先画调用链，再找断点

以一次真实用户动作为起点（例如：键盘删除、点击 Start、菜单新局），按“组件 -> store adapter -> 领域对象”画出完整调用链。

如果任一环节出现以下情况，就可判定为契约断裂：
- UI 调用了不存在的方法（如 clearCell）。
- UI 写入 A 状态源，但渲染读取 B 状态源。
- 启动流程只做占位重置，没有构造真实业务对象。

## 2. 以“单一状态源”作为第一原则

所有读写必须收敛到同一个 gameStore：
- 入口统一：Welcome、Header Dropdown、按钮弹窗都只调用 gameStore。
- 渲染统一：棋盘、键盘、操作栏都只读取 $gameStore。
- 生命周期统一：reset/load/startNew 时同步重置 pause 等派生状态。

一旦出现“双状态源并存”，优先做迁移而不是打补丁桥接。

## 3. 领域层做真规则，适配层只做翻译

验证逻辑应放在 Sudoku 领域对象中，store adapter 只负责：
- 坐标转换（UI x,y -> 领域 row,col）。
- 响应式刷新（refreshGameStore）。
- 轻量状态编排（暂停计数、选择格等 UI 关联状态）。

因此本次把冲突检测统一为 Sudoku.getConflictingCells()，并删除 store.js 中重复校验逻辑，避免两套规则未来漂移。

## 4. 修复顺序建议（可复用）

1. 先补齐领域接口契约（Game/Sudoku）。
2. 再补齐 adapter 暴露（createGameStore 返回方法）。
3. 再迁移 UI 入口到单一状态源。
4. 最后做逻辑去重（把业务规则回收至领域层）。

这个顺序可以把“能跑”与“架构收敛”同时保证，避免先做去重导致行为不稳定。

## 5. 验证策略

- 每次关键改动后跑全量测试（npm test）。
- 核心行为手工回归：删除输入、开始游戏、菜单新局、分享码导入。
- 文档与代码同步更新：每修复一个问题，记录“症状 -> 根因 -> 方案 -> 验证”。

该策略能保证后续维护者不仅知道“改了什么”，也知道“为什么这样改”。

---

# 问题3：适配层 selectedCell 为死状态（minor）

## 问题描述

`createSudokuStore/createGameStore` 维护了 `selectedCell` 和 `selectCell()`，但项目中没有任何组件消费该状态或调用该接口；棋盘高亮和键盘导航仍由旧 `cursor` store 驱动。

这会带来两个问题：
- adapter 暴露了不可达接口（死接口）。
- 同一语义（当前选中格）出现潜在双状态源，不符合最小必要状态原则。

## 根因

在状态迁移过程中，store 里预留了“选中格能力”，但 UI 层未完成迁移，最终形成“写在 adapter、读在 cursor”的割裂。

## 修复策略

采用“行为不变、状态收敛”的最小改动方案：
- 删除 `store.js` 中 `selectedCell` 派生状态。
- 删除 `normalizeSelectedCell` 辅助函数。
- 删除 `createSudokuStore/createGameStore` 的 `selectCell()` 暴露。
- 保持当前 UI 继续由 `cursor` store 驱动，不引入额外迁移风险。

## 改动结果

- 适配层状态更精简，只保留真实被消费的字段。
- 清除了重复状态源隐患，后续若要完全去除旧 `cursor`，可再做一次端到端迁移（UI 与 keyboard 一并切换）。

#原来的控制逻辑是又什么驱动的，新逻辑是由什么驱动的

原来的控制逻辑，核心是由旧的 cursor store 驱动：

选择状态来源：@sudoku/stores/cursor
棋盘高亮读取：在 Board/index.svelte 里读取 $cursor 做 selected/sameArea/sameNumber
点击格子写入：在 Board/Cell.svelte 里调用 cursor.set(...)
键盘导航与输入目标：在 Controls/Keyboard.svelte 里调用 cursor.move(...) 并用 $cursor.x/$cursor.y 定位输入
现在的新逻辑，主链路改为由 gameStore 驱动：

选择状态来源：在 domain/store.js 的 gameStore 中维护 selectedCell
写入入口：通过 gameStore.selectCell(x, y) 更新选中格
棋盘高亮读取：在 Board/index.svelte 改为读取 $gameStore.selectedCell
点击格子写入：在 Board/Cell.svelte 改为调用 gameStore.selectCell(...)
键盘导航与输入目标：在 Controls/Keyboard.svelte 改为基于 $gameStore.selectedCell 移动和下数
补充一处现状：你这次问的是“原来 vs 现在”，主链路已经切到 gameStore；但我扫描到 Controls/ActionBar/Actions.svelte 还在用 cursor（用于 hint 相关逻辑）。如果你要“完全不再由旧 cursor 驱动”，下一步就是把这里也迁过去。
