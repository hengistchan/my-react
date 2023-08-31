import { Action } from 'shared/ReactTypes';
import { Dispatch } from '../../react/src/currentDispatcher';
import { Lane, NoLane, isSubsetOfLanes } from './fiberLanes';

export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}

export const createUpdate = <State>(
	action: Action<State>,
	lane: Lane
): Update<State> => {
	return {
		action,
		lane,
		next: null,
	};
};

export const createUpdateQueue = <State>(): UpdateQueue<State> => {
	return {
		shared: {
			pending: null,
		},
		dispatch: null,
	};
};

export const enqueueUpdate = <Action>(
	updateQueue: UpdateQueue<Action>,
	update: Update<Action>
) => {
	// pending 指向最后一个 update
	// 最后一个 update 的 next 指向第一个 update
	const pending = updateQueue.shared.pending;
	if (!pending) {
		// This is the first update. Create a circular list.
		update.next = update;
	} else {
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

export const processUpdateQueue = <State>(
	baseState: State,
	pendindUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		memoizedState: baseState,
		baseState,
		baseQueue: null,
	};

	if (pendindUpdate !== null) {
		// 从第一个 update 开始，依次执行
		const first = pendindUpdate.next;
		let pending = pendindUpdate.next as Update<any>;

		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		let newState = baseState;

		do {
			const updateLane = pending.lane;
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够，跳过
				const clone = createUpdate(pending.action, pending.lane);
				// 是不是第一个 update
				if (newBaseQueueLast === null) {
					newBaseQueueFirst = newBaseQueueLast = clone;
					newBaseState = newState; // 被固定，不会再变化
				} else {
					newBaseQueueLast = (newBaseQueueLast as Update<State>).next = clone;
				}
			} else {
				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending.action, NoLane);
					newBaseQueueLast = (newBaseQueueLast as Update<State>).next = clone;
				}
				// 优先级足够
				const action = pendindUpdate.action;
				// useState 的 action 可能是一个函数，也可能是一个值
				if (action instanceof Function) {
					newState = action(baseState);
				} else {
					newState = action;
				}
			}
			pending = pending?.next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 本次计算没有 update 被跳过
			newBaseState = newState;
		} else {
			(newBaseQueueLast as Update<State>).next = newBaseQueueFirst;
		}
		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}
	return result;
};
