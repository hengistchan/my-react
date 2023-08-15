import { Props, ReactElementType } from 'shared/ReactTypes';
import {
	FiberNode,
	createFiberForElement,
	createWorkInProgress
} from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { ChildDeletion, Placement } from './fiberFlags';

function ChildReconciler(shouldTrackEffects: boolean) {
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		// 在这段代码中，deleteChild 函数只在 shouldTrackEffects 为 true 时才会执行删除操作。这是因为 shouldTrackEffects 是一个标志位，用于指示是否需要跟踪副作用。在 React 中，副作用是指对 DOM 的实际更改，例如添加、删除或更新元素。当 shouldTrackEffects 为 false 时，React 不会跟踪副作用，因此也就不需要执行删除操作。
		if (!shouldTrackEffects) {
			return;
		}
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			returnFiber.deletions = [childToDelete];
			returnFiber.flags |= ChildDeletion;
		} else {
			deletions.push(childToDelete);
		}
	}

	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 更新流程
		const key = element.key;
		work: if (currentFiber !== null) {
			if (currentFiber.key === key) {
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					if (currentFiber.type === element.type) {
						// key 相同，type 相同，可以复用
						const existing = useFiber(currentFiber, element.props);
						existing.return = returnFiber;
						return existing;
					}
					// key 相同，但是 type 不同，删除旧的 fiber
					deleteChild(returnFiber, currentFiber);
					break work;
				} else {
					if (__DEV__) {
						console.error('Unknown child type', element);
					}
					break work;
				}
			} else {
				// 删除旧的 fiber
				deleteChild(returnFiber, currentFiber);
			}
		}
		// 根据 currentFiber 和 element 创建新的 fiber
		const fiber = createFiberForElement(element);
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		if (currentFiber !== null) {
			// update
			if (currentFiber.tag === HostText) {
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				return existing;
			}
			// delete
			deleteChild(returnFiber, currentFiber);
		}
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE: {
					return placeSingleChild(
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);
				}
				default: {
					if (__DEV__) {
						console.error('Unknown child type', newChild);
					}
				}
			}
		}

		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				reconcileTextNode(returnFiber, currentFiber, newChild)
			);
		}

		if (currentFiber !== null) {
			// 兜底删除
			deleteChild(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.error('Unknown child type', newChild);
		}

		return null;
	};
}

function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	const clone = createWorkInProgress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
