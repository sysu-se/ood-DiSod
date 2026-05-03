<script>
	import { onMount, onDestroy, setContext } from 'svelte';
	import { validateSencode } from '@sudoku/sencode';
	import { modal } from '@sudoku/stores/modal';
	import Board from './components/Board/index.svelte';
	import Controls from './components/Controls/index.svelte';
	import Header from './components/Header/index.svelte';
	import Modal from './components/Modal/index.svelte';

	// 这里的 gameStore 是一个适配层，持有本地 domain 的 Sudoku/Game 对象，并提供必要的方法供 UI 组件调用。
	import { createGameStore } from './domain/store.js';
	import { createSudoku } from './domain/sudoku.js';

	// 这里创建一个最小的 Game store 适配层，持有本地 domain 的 Sudoku/Game 对象。
	// 这使得 App 及其子组件可以通过一个统一的 store 来消费游戏状态。
	const emptyGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
	const gameStore = createGameStore({ sudoku: createSudoku(emptyGrid) });

	// 将 gameStore 放到 Svelte 上下文中，方便子组件通过 getContext('gameStore') 获取。
	setContext('gameStore', gameStore);

	// 订阅 gameStore 的状态变化，找到游戏胜利时触发弹窗。
	//每次状态更新都会判断won，赢了就暂停。App销毁就unsubscribe。
	const unsubscribe = gameStore.subscribe(state => {
		if (state.won) {
			gameStore.pause();
			modal.show('gameover');
		}
	});

	// 组件销毁时取消订阅，避免内存泄漏。
	onDestroy(() => {
		unsubscribe();
	});

	// 页面加载时检查 URL hash 是否包含合法的 Sudoku 共享码。
	onMount(() => {
		let hash = location.hash;

		if (hash.startsWith('#')) {
			hash = hash.slice(1);
		}

		let sencode;
		if (validateSencode(hash)) {
			sencode = hash;
		}

		// 初始显示欢迎弹窗，关闭时恢复游戏状态。
		gameStore.pause();
		modal.show('welcome', { onHide: () => gameStore.resume(), sencode });
	});
</script>

<!-- 根组件只负责页面布局和全局控制，不直接处理游戏逻辑。 -->
<!-- Header / Board / Controls / Modal 都可通过上下文或 store 获取 gameStore。 -->
<header>
	<Header />
</header>

<!-- Sudoku Field -->
<section>
	<Board />
</section>

<!-- Keyboard -->
<footer>
	<Controls />
</footer>

<!-- Modal 负责显示 welcome、gameover 等全局弹窗。 -->
<Modal />

<style global>
	@import "./styles/global.css";
</style>