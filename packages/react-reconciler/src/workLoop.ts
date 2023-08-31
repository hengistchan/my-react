import { scheduleMicosTask } from 'hostConfig';
import { beginWork } from './beginWork';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestory,
	commitHookEffectListUnmount,
	commitMutationEffects,
} from './commitWork';
import { completeWork } from './completeWork';
import {
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects,
	createWorkInProgress,
} from './fiber';
import { MutationMask, NoFlags, PassiveMask } from './fiberFlags';
import {
	Lane,
	NoLane,
	SyncLane,
	getHighestPriorityLane,
	lansToSchedulerPriority,
	markRootFinished,
	mergeLanes,
} from './fiberLanes';
import { flushSyncCallbackQueue, scheduleSyncCallback } from './syncTaskQueue';
import { HostRoot } from './workTags';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback,
} from 'scheduler';
import { HookHasEffect, Passive } from './hookEffectTags';

let workInProgress: FiberNode | null = null;
let wipRootLane: Lane = NoLane;
let rootDoesHavePassiveEffects: boolean = false;

type RootExitStatus = number;
const RootIncomplete = 0;
const RootCompleted = 1;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
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
	const existingCallback = root.callbackNode;
	if (updateLane === NoLane) {
		if (existingCallback !== null) {
			unstable_cancelCallback(existingCallback);
		}
		root.callbackNode = null;
		root.callbackPriority = NoLane;
		return;
	}
	const curPriority = updateLane;
	const prevPriority = root.callbackPriority;
	if (curPriority === prevPriority) {
		return;
	}
	if (existingCallback !== null) {
		unstable_cancelCallback(existingCallback);
	}
	let newCallbackNode = null;
	if (updateLane === SyncLane) {
		// 同步优先级，微任务调度
		if (__DEV__) {
			console.log('同步优先级，微任务调度', updateLane);
		}
		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicosTask(flushSyncCallbackQueue);
	} else {
		if (__DEV__) {
			console.log('其他优先级，宏任务调度', updateLane);
		}
		// 其他优先级，宏任务调度
		const schedulerPriority = lansToSchedulerPriority(updateLane);
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}

	root.callbackPriority = curPriority;
	root.callbackNode = newCallbackNode;
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

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	// 保证 useEffect 被执行了
	const curCallback = root.callbackNode;
	const didFlushPassiveEffects = flushPassiveEffects(
		root.pendingPassiveEffects
	);
	if (didFlushPassiveEffects) {
		// 在 effect 中出现了优先级更高的更新
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}
	const lane = getHighestPriorityLane(root.pendingLanes);
	const currentCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	const neesSync = lane === SyncLane || didTimeout;
	// render 阶段，可能会出现中断
	const exitStatus = renderRoot(root, lane, !neesSync);
	ensureRootIsScheduled(root);
	if (exitStatus === RootIncomplete) {
		// 中断
		if (root.callbackNode !== currentCallbackNode) {
			// 存在更高优先级被调度
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root);
	}
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootLane = NoLane;

		commitRoot(root, lane);
	} else if (__DEV__) {
		console.error('renderRoot 未完成 同步', exitStatus);
	}
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

	const exitStatus = renderRoot(root, nextLane, false);
	if (exitStatus === RootCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootLane = NoLane;

		commitRoot(root, lane);
	} else if (__DEV__) {
		console.error('renderRoot 未完成 同步', exitStatus);
	}
}

function renderRoot(root: FiberRootNode, lane: Lane, shouleTimeSlice: boolean) {
	if (__DEV__) {
		console.log('renderRoot', shouleTimeSlice ? '时间切片' : '非时间切片');
	}
	if (wipRootLane !== lane) {
		// 初始化，让 workInProgress 指向第一个 fiberNode
		prepareFreshStack(root, lane);
	}

	// 执行递归流程
	do {
		try {
			shouleTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (error) {
			console.error(error);
			workInProgress = null;
		}
	} while (true);

	// 中断执行 || 执行完
	if (shouleTimeSlice && workInProgress !== null) {
		return RootIncomplete;
	}
	if (!shouleTimeSlice && workInProgress !== null && __DEV__) {
		console.error('workInProgress 不应该存在', workInProgress);
	}
	// TODO: 报错
	return RootCompleted;
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

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		// 需要执行 useEffect 回调
		if (rootDoesHavePassiveEffects === false) {
			rootDoesHavePassiveEffects = true;
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在 3 个子阶段需要执行的操作
	// root flags root subTreeFlags
	const subTreeHasEffects =
		(finishedWork.subtreeFlags & MutationMask) !== NoFlags;
	const rootHasEffects = (finishedWork.flags & MutationMask) !== NoFlags;

	if (subTreeHasEffects || rootHasEffects) {
		// 1. before mutation
		// 2. mutation
		commitMutationEffects(finishedWork, root);
		root.current = finishedWork;

		// 3. layout
	} else {
		root.current = finishedWork;
	}

	rootDoesHavePassiveEffects = false;
	ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffects = false;
	pendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffects = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	pendingPassiveEffects.unmount = [];
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffects = true;
		commitHookEffectListDestory(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffects = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	pendingPassiveEffects.update = [];
	flushSyncCallbackQueue();
	return didFlushPassiveEffects;
}

function workLoopSync() {
	// 从 workInProgress 开始，递归执行
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	// 从 workInProgress 开始，递归执行
	while (workInProgress !== null && !unstable_shouldYield()) {
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
