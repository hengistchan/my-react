import internals from 'shared/internals';
import { FiberNode } from './fiber';
import { Dispatcher } from 'react/src/currentDispatcher';
import { Dispatch } from 'react/src/currentDispatcher';
import {
	UpdateQueue,
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
} from './updateQueue';
import { Action } from 'shared/ReactTypes';
import { scheduleUpdateOnFiber } from './workLoop';
import { Lane, NoLane, requestUpdateLane } from './fiberLanes';

let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;

const { currentDispatcher } = internals;

interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}

export function renderWithHooks(wip: FiberNode, lane: Lane) {
	renderLane = lane;
	// 赋值操作
	currentlyRenderingFiber = wip;
	wip.memoizedState = null;
	wip.updateQueue = null;

	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}

	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置操作
	currentlyRenderingFiber = null;
	currentHook = null;
	workInProgressHook = null;
	renderLane = NoLane;

	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
};

function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前 useState 对应的数据
	const hook = updateWorkInProgressHook();

	// 计算新的 state
	const queue = hook.updateQueue as UpdateQueue<State>;
	const pending = queue.shared.pending;
	queue.shared.pending = null;

	if (pending !== null) {
		const { memoizedState } = processUpdateQueue<State>(
			hook.memoizedState,
			pending,
			renderLane
		);
		hook.memoizedState = memoizedState;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前 useState 对应的数据
	const hook = mountWorkInProgressHook();

	let memoizedState: State;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;

	// @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber!, queue);
	queue.dispatch = dispatch;

	return [memoizedState, dispatch];
}

function dispatchSetState<State = any>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const lane = requestUpdateLane();
	const update = createUpdate(action, lane);
	enqueueUpdate(updateQueue, update);
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgressHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		next: null,
		updateQueue: null,
	};

	if (workInProgressHook === null) {
		// mount 时并且是第一个 hook
		if (currentlyRenderingFiber === null) {
			// 没有在一个函数组件内执行 hook
			throw new Error('没有在一个函数组件内执行 hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// mount 时后续的 hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
	// TODO: render 阶段不能触发 update
	let nextCurrentHook: Hook | null;

	if (currentHook === null) {
		// 这是 FC update 的第一个 hook
		const current = currentlyRenderingFiber?.alternate;
		if (current !== null) {
			nextCurrentHook = current?.memoizedState;
		} else {
			nextCurrentHook = null;
		}
	} else {
		// 这是 FC update 的后续 hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		console.error('hook 个数不匹配');
	}

	currentHook = nextCurrentHook;

	const newHook: Hook = {
		memoizedState: currentHook?.memoizedState,
		updateQueue: currentHook?.updateQueue,
		next: null,
	};

	if (workInProgressHook === null) {
		// update 时并且是第一个 hook
		if (currentlyRenderingFiber === null) {
			// 没有在一个函数组件内执行 hook
			throw new Error('没有在一个函数组件内执行 hook');
		} else {
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHook;
		}
	} else {
		// update 时后续的 hook
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}

	return workInProgressHook;
}
