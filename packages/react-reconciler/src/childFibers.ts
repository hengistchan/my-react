import { ReactElementType } from 'shared/ReactTypes';
import { FiberNode, createFIberForElement } from './fiber';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { HostText } from './workTags';
import { Placement } from './fiberFlags';

function ChildReconciler(shouldTrackEffects: boolean) {
	function reconcileSingleELement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		// 根据 currentFiber 和 element 创建新的 fiber
		const fiber = createFIberForElement(element);
		fiber.return = returnFiber;
		return fiber;
	}

	function reconcileTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags != Placement;
		}
		return fiber;
	}

	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFIber: FiberNode | null,
		newChild?: ReactElementType
	) {
		if (typeof newChild === 'object' && newChild !== null) {
			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE: {
					return placeSingleChild(
						reconcileSingleELement(returnFiber, currentFIber, newChild)
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
				reconcileTextNode(returnFiber, currentFIber, newChild)
			);
		}

		return null;
	};
}

export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
