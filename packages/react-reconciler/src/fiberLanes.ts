import { FiberRootNode } from './fiber';

export type Lane = number;
export type Lanes = number;

export const SyncLane: Lane = 0b0001;
export const NoLane: Lane = 0b0000;
export const NoLanes: Lanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lane {
	return laneA | laneB;
}

export function requestUpdateLane() {
	return SyncLane;
}

export function getHighestPriorityLane(lanes: Lanes) {
	return lanes & -lanes;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
	root.pendingLanes &= ~lane;
}
