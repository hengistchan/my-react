import { scheduleMicosTask } from 'hostConfig';
import { beginWork } from './beginWork';
import { commitMutationEffects } from './commitWork';
import { completeWork } from './completeWork';
import { FiberNode, FiberRootNode, createWorkInProgress } from './fiber';
import { MutationMask, NoFlags } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	markRootFinished,
	mergeLanes,
} from './fiberLanes';
import { flushSyncCallbackQueue, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';

let workInProgress: FiberNode | null = null;
let wipRootLane: Lane = NoLane;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	workInProgress = createWorkInProgress(root.current, {});
	wipRootLane = lane;
}

// 在给定的 fiber 上调度更新，并触发根节点的渲染。具体来说，它会通过 markUpdateFromFiberToRoot 函数找到 fiber 所在的根节点，然后调用 renderRoot 函数开始进行递归更新流程。
export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// 找到 fiberRootNode
	const root = markUpdateFromFiberToRoot(fiber);
	if (!root) {
		if (__DEV__) {
			console.warn('fiber root node is not exist', fiber);
		}
		return;
	}
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
}

// 在给定的 fiberRootNode 上调度更新，并触发根节点的渲染。具体来说，它会通过 markUpdateFromFiberToRoot 函数找到 fiberRootNode，然后调用 renderRoot 函数开始进行递归更新流程。
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	if (updateLane === NoLane) {
		return;
	}
	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度
		if (__DEV__) {
			console.log('同步优先级，微任务调度', updateLane);
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicosTask(flushSyncCallbackQueue);
	} else {
		// 其他优先级，宏任务调度
	}
}

function markRootUpdated(root: FiberRootNode, updateLane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, updateLane);
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

// 该函数理论上会在一次更新中被调用多次，但是因为调度的关系，只会执行一个 updateLane 的更新。
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 其他比 SyncLane 低的优先级，不执行
		// NoLane
		ensureRootIsScheduled(root);
		return;
	}
	// 初始化，让 workInProgress 指向第一个 fiberNode
	prepareFreshStack(root, lane);

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
	root.finishedLane = lane;
	wipRootLane = NoLane;

	commitRoot(root, lane);
}

function commitRoot(root: FiberRootNode, lane: Lane) {
	const finishedWork = root.finishedWork;

	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.log('commitRoot', finishedWork);
	}

	if (lane === NoLane && __DEV__) {
		console.error('commit 阶段不应该是 NoLane');
	}

	markRootFinished(root, lane);
	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

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
	const next = beginWork(fiber, wipRootLane);
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
