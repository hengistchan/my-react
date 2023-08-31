import currentBatchConfig from 'react/src/currentBatchConfig';
import { FiberRootNode } from './fiber';
import {
	unstable_IdlePriority,
	unstable_ImmediatePriority,
	unstable_NormalPriority,
	unstable_UserBlockingPriority,
	unstable_getCurrentPriorityLevel,
} from 'scheduler';

export type Lane = number;
export type Lanes = number;

export const SyncLane: Lane = 0b00001;
export const InputContinuousLane: Lane = 0b00010;
export const DefaultLane: Lane = 0b00100;
export const IdleLane: Lane = 0b01000;
export const TransitionLane = 0b1000;
export const NoLane: Lane = 0b00000;
export const NoLanes: Lanes = 0b00000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lane {
	return laneA | laneB;
}

export function requestUpdateLane() {
	const isTransition = currentBatchConfig.transition !== null;
	if (isTransition) {
		return TransitionLane;
	}
	// 从上下文环境中获取优先级
	const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
	const lane = schedulerPriorityToLane(currentSchedulerPriority);
	return lane;
}

export function getHighestPriorityLane(lanes: Lanes) {
	return lanes & -lanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lanes) {
	return (set & subset) === subset;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}

export function lansToSchedulerPriority(lanes: Lanes) {
	const lane = getHighestPriorityLane(lanes);

	if (lane === SyncLane) {
		return unstable_ImmediatePriority;
	}

	if (lane === InputContinuousLane) {
		return unstable_UserBlockingPriority;
	}

	if (lane === DefaultLane) {
		return unstable_NormalPriority;
	}

	return unstable_IdlePriority;
}

export function schedulerPriorityToLane(priority: number): Lane {
	if (priority === unstable_ImmediatePriority) {
		return SyncLane;
	}

	if (priority === unstable_UserBlockingPriority) {
		return InputContinuousLane;
	}

	if (priority === unstable_NormalPriority) {
		return DefaultLane;
	}

	if (priority === unstable_IdlePriority) {
		return IdleLane;
	}

	return NoLane;
}
