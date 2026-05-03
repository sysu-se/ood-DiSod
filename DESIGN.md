# design说明（2026.4.5）
# 抱歉！由于不熟悉classroom，第一次作业我提交在了系统自动提供的项目地址的fork：https://github.com/DiSod/2026-SE-exp1 。原作业repo超时了看不了，重创建一个作业提示没有权限:(。
## 整体说明
- 整体架构：目前的实现中，我们仅有sudoku和game两层。
<br />
- sudoku架构: sudoku是最基本的数独对象。它的基本功能有：
    1. 储存数独图，我们用双层数组来储存图。每个位置要么有1-9的一个数字，要么是空的
    2. 负责输入的函数guess：负责向指定的一个位置填入一个值。需要判断填入位置和填入值的合法性
    3. 其余的结尾方便数据传输的辅助函数。在后续说明。
<br />
- game架构：game是在sudoku之上的一层。除了提供sudoku之外，它还提供了额外的撤销/恢复的历史操作功能
    1. game能执行的操作有guess，undo和redo
    2. 对于guess，我们是通过game的函数传入sudoku进行操作。在game对象的guess中，我们还要根据这个操作维护undo/redo相关数据结构（栈），以便功能实现。
    3. undo/redo是类似的。它们都是通过栈保证了先前操作的记录，通过函数来还原到先前的状态。
    4. 同样的，我们还要有方便数据传输的辅助函数，在后续说明
<br />
- 总的来说，我们的任务有：
    1. sudoku基本功能实现
    2. sudoku额外功能实现：1.序列化与反序列化 2.外表化
    3. game基本功能实现
    4. game额外功能实现：1.序列化与反序列化 2.undo/redo功能
    5. 此外，作业还要求检查一些辅助函数，如clone，canUndo等
<br/>
## sudoku说明
- sudoku作为一个对象，是在createSudoku中创建的。createSudoku接受一个input输入，它的类型为双重数组（即grid[][])。我们要用deepCopyGrid对数据进行深拷贝，创建一个属于这个sudoku对象的自己的grid。
**<span style="color: #6495ED;">deepCopyGrid是用map函数实现的自动遍历赋值实现的深拷贝，它接收一个grid，return一个grid</span>**
- 核心guess功能实现：guess接收一个move参数，move={row，col，value}。对于传入的move，我们会检查两方面:
    1. 插入的行列位是否在grid的范围内；插入值是否在1-9范围内
    2. 插入的位置是否已经有填入数字了，我们只能填入空位。


如果符合条件，我们才在grid[row][col]填入value。
<br/>
- 序列化与反序列化：作业要求从当前局面导出json。无论是guess函数，还是序列化反序列化等函数，它们都是在整个游戏中“通用”的功能，跟当前局面无关。当前局面只有一个，就是数独的图，即grid。我们序列化就是从sudoku中只保存grid的数据。
我们的方法就是编写toJSON函数，JavaScript会通过toJSON函数知晓对象想要序列化的数据，而后自动将指定数据序列化为JSON。注意我们不能直接序列化grid，因为序列化后的数据已经独立于这个sudoku对象了，因而需要深拷贝，同样用deepCopyGrid函数解决。
那么反序列化呢？我们在创建函数时接受一个grid同类型的input输入，我们只要把json中的grid拿出来送入createSudoku就好了。通过定义一个reateSudokuFromJSON的接口解决。它内部将json的grid送入createSudoku，实现了反序列化。
<br/>
- 外表化：外表化的目的，是输出当前grid的信息，便于调试。我们的方法是通过格式化的打印到端口上，用字符模拟图像。我们用‘-’和'|'来隔开格子，在已填的格子中放入数字，没填的放入‘*’。
<br/>
- 局面校检：定义一个isValidMove。对一个指定的位置检查是否符合数独规则：整个图内的，这一个的横竖行列不能有跟输入重复的数字。对于所在的3x3大方格，同样不能有重复的。
<br/>
- clone:提供作业检查的clone函数，我们将现有的grid深拷贝一份送入createSudoku中，函数return一个新创建的sudoku对象，不会有浅拷贝问题。

## game说明
- undo/redo:撤销恢复实质都是要恢复到先前一步的状态。“先前”要求保留之前的数据。“一步”要求了要有时间上的最新性。这就很适合具有FIFO特性的栈来解决。因而对于undo/redo，我们都用栈来保存。保存什么呢？我们保存一个sudoku的序列化json，也就是grid<span style="color: #6495ED;">（我们将json放入反序列化函数创建，后续默认如此，直接用grid指代）</span>。我们存储了先前每一步的grid全貌。undo/redo实质上就是将栈中的grid替换现在的grid。除此之外，undo/redo也是一步操作，同样需要redo/undo操作。以undo为例，，我们先需要向redo栈压入现状态（才能恢复到undo前状态），再从undoStack中弹出并替换。redo同理
<br/>
- guess实现：对于guess的基本功能，我们将其直接传入sudoku的guess就好了。在game的guess中，我们的额外任务是维护undo/redo功能所需的数据。我们会向undoStack中压入guess前状态，以便后续撤销到guess前。我们会清空redoStack，这是规则要求的。
<br/>
- 序列化与反序列化：game保护sudoku，序列化sudoku部分直接调用sudoku的就好了。game额外实现了undo/redo功能。对于game对象，它们都有相应的函数，真正区别的是undo/redo栈的内容。因而我们要序列化的就是栈。栈中的元素是序列化的json，无需再处理，我们单独序列化栈就好，同样用map实现。
<br/>

- 对于反序列化。我们的createGame要求一个sudoku输入，我们将sudoku的序列化json进行反序列化传入就好了。对于两个栈，我们用map直接赋值就好了（要先创建game对象再赋值，因为两个栈是存在在game对象里的）。

- 辅助函数：canUndo/canRedo检查了是否能进行对应操作。操作要求栈内有历史数据，无数据自然不能操作，我们检查栈是否空就好了。getSudoku返回现在的Sudoku(通过clone函数进行深拷贝)

## 回答一些问题
1.你的 Sudoku / Game 的职责边界是什么？
2.Move 是值对象还是实体对象？为什么？
3.history 中存储的是什么？为什么？
4.你的复制策略是什么？哪些地方需要深拷贝？
5.你的序列化 / 反序列化设计是什么？
6.你的外表化接口是什么？为什么这样设计？

1. sudoku的职责是储存数独图，负责填入操作。game维护了现在的sudoku，负责了undo/redo进行sudoku的切换

2. move是值对象。我们只关注它要干嘛，只关心其值，不关心它是“哪个”move。
3. history我们写成了undoStack。我们储存了sudoku的json，即grid数据。撤销恢复要么直接恢复到先前的图，要么还原操作。还原操作要通过函数操作现在的sudoku执行，实现比较麻烦。sudoku的json占用空间并没有特别大，而实现明显非常简单。
4. 复制策略在sudoku的clone一节已说明。事实上目前涉及的操作中没有强制要求浅拷贝的，为了安全我们都设置成了深拷贝。
5. 序列化设计是设置toJSON。反序列化是设计是create函数本身就接受一个类型和JSON储存的数据类型一直的参数进行创建，反序列化只需要设计一个接口就好了。
6. 外表化接口是通过打印实现的。因为展示sudoku的grid是单纯的图形展示，也不甚复杂，暴力打印思路简单。在终端上也能立马看到。对于目前涉及的图大小，性能负担也不算严重。



# EXP2-design说明（2026.4.5）

## A.领域对象如何被消费
1.  **View 层直接消费的是什么？**
- 直接消费的是gameStore。
2. **View 层拿到的数据是什么**
- view层通过gamestore拿到:grid(当前棋盘)，invaildCells（冲突格子坐标）；won（是否解决数独判断）；canUndo/canRedo(历史操作是否可进行)；selectedCell（目前选中格子）
3. **用户操作如何进入领域对象**
- 用户操作的读取基本上均在svelte构建的前端代码上进行，通过修改（点击redo/undo按钮或者响应键盘输入时触发的）的函数参数，我们让用户的操作数据进入gameStore的方法，gameStore的方法内会调用相应的Game/sudoku方法，它们在进行对sudoku/game的更新。
4. **领域对象变化后，Svelte 为什么会更新？**
- svelte不会很智能的自动识别数据更新并更新渲染。svelte提供了store机制用于手动更新。我们使用的svelte前端都是响应gameStore的。每次我们修改领域对象（也就是gameStore）后，我们都会调用**refreshGameStore()**。refreshGameStore内部会继续gamestore的更新，将新的gamestore对象传入store.set()。store.set()收到后就会按照新的数据绘制。
## B. 响应式机制说明
1.  **你依赖的是 store、$:、重新赋值，还是其他机制？**
- 本方案主要依赖的是 Svelte store + $store 自动订阅机制，不是依赖对象内部字段的直接修改。机制见A的第四小问。
2. **你的方案中，哪些数据是响应式暴露给 UI 的？通过 gameStore 暴露给 UI 的响应式状态主要有：**
- UI 通过 gameStore 响应式消费的核心状态包括：grid（当前棋盘）、invalidCells（冲突格坐标）、won（是否胜利）、canUndo/canRedo（撤销与重做可用性）以及 selectedCell（当前选中格，预留）；同时，UI 并不直接修改领域对象内部数据，而是通过 gameStore 暴露的命令接口驱动状态演进，包括 guess(move)、clearCell(row, col)、undo()、redo()、reset与 startNew
3. **哪些状态留在领域对象内部？**
game对象的undoStack/redoStack会留在内部。
4. **如果不用你的方案，而是直接 mutate 内部对象，会出现什么问题？**
- svelte不会自动更新。如果只更新内部对象，svelte就不会更新渲染。如果在内部对象内置更新相关函数，则渲染和数据层会耦合，后续维护会很笨重

## C. 改进说明
1. **相比 HW1，你改进了什么？**
- 我们更新了game的undo/redoStack，将存储数据由snapshot改为了move。同时了为了适应这个改动，为sudoku增加了一个删除用的函数。

- 为了将数据传入svelte中，我们设计了一个store adapter，实现了：**game/sudoku --> gamestore --> svelte绘制相关代码**
- game/sudoku只实现了很简单的输入/输出。没有足够的局面校检能力。我们将win以及输入合法性的判断放入了storeadapter层。让storeadapter来判断并决定：1.返回什么给svelte层 2.输入什么给game/sudoku
2. **为什么 HW1 中的做法不足以支撑真实接入？**
- 考虑到本人没有接触过svelte，我们的想法是尽量复用先前的代码。为了复用先前的代码，我们要将我们的game/sudoku类的数据以他需要的格式送入；同时它还需要一些更高级的信息：如局面校检/win判断）。在HW1的game/sudoku类内实现会使数独游戏本身的逻辑与前端设计耦合。也就是说，HW1的层级不足以实现很好的模块化。

- 同时，Svelte 对对象内部 mutate 不会稳定触发更新，容易出现“数据变了但界面不刷新”或“undo/redo 与渲染不同步”的问题。
3. **你的新设计有哪些权衡？**
- 我们只对关键的几个数据通路做了适配，确保最低限度的实现核心对象的OOP封装。很多辅助的代码都是处于沿用原先的OO的代码，宏观的架构事实上还处在一个杂乱的情况。由于老代码的混用，我们也不能删去先前的文件或者进行（简单的）重构，项目文件的架构不够清晰。

- 目前的对象的功能也不够健全，架构没有给暂停/提示等功能预留空间