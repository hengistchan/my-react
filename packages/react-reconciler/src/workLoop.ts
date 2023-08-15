import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
	workInProgress = createWorkInProgress(root.current, {});
}

// 在给定的 fiber 上调度更新，并触发根节点的渲染。具体来说，它会通过 markUpdateFromFiberToRoot 函数找到 fiber 所在的根节点，然后调用 renderRoot 函数开始进行递归更新流程。
export function scheduleUpdateOnFiber(fiber: FiberNode) {
	// 找到 fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	if (!root) {
		if (__DEV__) {
			console.warn('fiber root node is not exist', fiber);
		}
		return;
	}
	renderRoot(root);
}

function markUpdateFromFiberToRoot(fiber: FiberNode): FiberRootNode | null {
	let node = fiber;
	let parent = node.return;

	while (parent !== null) {
		node = parent;
		parent = node.return;
	}

	if (node.tag === HostRoot) {
		return node.stateNode;
	}

	return null;
}

function renderRoot(root: FiberRootNode) {
	// 初始化，让 workInProgress 指向第一个 fiberNode
	prepareFreshStack(root);

	// 执行递归流程
	do {
		try {
			workLoop();
			break;
		} catch (error) {
			console.error(error);
			workInProgress = null;
		}
	} while (true);

	const finishedWork = root.current.alternate;
	root.finishedWork = finishedWork;

	commitRoot(root);
}

function commitRoot(root: FiberRootNode) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.log('commitRoot', finishedWork);
	}

	// 重置
	root.finishedWork = null;

	// 判断是否存在 3 个子阶段需要执行的操作
	// root flags root subTreeFlags
	const subTreeHasEffects =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffects = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subTreeHasEffects || rootHasEffects) {
		// 1. before mutation
		// 2. mutation
		commitMutationEffects(finishedWork);
		root.current = finishedWork;

		// 3. layout
	} else {
		root.current = finishedWork;
	}
}

function workLoop() {
	// 从 workInProgress 开始，递归执行
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function performUnitOfWork(fiber: FiberNode) {
	// 执行当前 fiberNode 的任务
	const next = beginWork(fiber);
	fiber.memoizedProps = fiber.pendingProps;

	if (next === null) {
		completeUnitOfWork(fiber);
	} else {
		workInProgress = next;
	}
}

function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	do {
		completeWork(node);

		const sibling = node?.sibling ?? null;
		if (sibling !== null) {
			workInProgress = sibling;
			return;
		}
		node = node?.return ?? null;
		workInProgress = null;
	} while (node !== null);
}
