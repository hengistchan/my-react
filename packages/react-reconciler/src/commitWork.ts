import {
	Container,
	appendChildToContainer,
	commitUpdate,
	removeChild
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText
} from './workTags';

let nextEffect: FiberNode | null = null;

export const commitMutationEffects = (finishedWork: FiberNode) => {
	nextEffect = finishedWork;

	while (nextEffect !== null) {
		const child: FiberNode | null = nextEffect.child;

		// 检查 finishedWork 的 subtreeFlags 是否包含 MutationMark 标记，如果包含，则需要遍历 finishedWork 的子树，直到找到第一个包含 MutationMark 标记的节点。如果不包含，则直接遍历 finishedWork 的兄弟节点或者父节点的兄弟节点，直到找到包含 MutationMark 标记的节点。这个判断的目的是为了优化遍历的性能，避免不必要的遍历。
		if (
			(nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
			child !== null
		) {
			nextEffect = child;
		} else {
			up: while (nextEffect !== null) {
				commitMutationEffectsOnFiber(nextEffect);
				const sibling = nextEffect.sibling as FiberNode | null;
				if (sibling !== null) {
					nextEffect = sibling;
					break up;
				}
				nextEffect = nextEffect.return;
			}
		}
	}
};

const commitMutationEffectsOnFiber = (finishedWork: FiberNode) => {
	const flags = finishedWork.flags;

	if ((flags & Placement) !== NoFlags) {
		// 插入 / 移动
		commitPlacement(finishedWork);
		finishedWork.flags &= ~Placement;
	}

	if ((flags & Update) !== NoFlags) {
		commitUpdate(finishedWork);
		finishedWork.flags &= ~Update;
	}

	if ((flags & ChildDeletion) !== NoFlags) {
		const deletions = finishedWork.deletions;
		if (deletions !== null) {
			deletions.forEach((childToDelete) => commitDeletion(childToDelete));
		}
		finishedWork.flags &= ~ChildDeletion;
	}
};

function commitDeletion(childToDelete: FiberNode) {
	let rootHostNode: FiberNode | null = null;
	// 递归子树
	commitNestedComponents(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent: {
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				// 解绑 ref
				return;
			}
			case HostText: {
				if (rootHostNode === null) {
					rootHostNode = unmountFiber;
				}
				return;
			}
			case FunctionComponent: {
				// TODO: useEffect unmount
				return;
			}
			default: {
				if (__DEV__) {
					console.warn('unhandled fiber', unmountFiber);
				}
				break;
			}
		}
	});

	// 移除 rootHostComponent 的 DOM 节点
	if (rootHostNode !== null) {
		const hostParent = getHostParent(rootHostNode);
		if (hostParent !== null) {
			removeChild((rootHostNode as FiberNode).stateNode, hostParent);
		}
	}

	childToDelete.return = null;
	childToDelete.child = null;
}

function commitNestedComponents(
	root: FiberNode,
	onCommitUnmount: (fiber: FiberNode) => void
) {
	let node = root;
	while (true) {
		onCommitUnmount(node);
		if (node.child !== null) {
			// 向下遍历
			node.child.return = node;
			node = node.child;
			continue;
		}
		if (node === root) {
			// 终止条件
			return;
		}
		while (node.sibling === null) {
			if (node.return === null || node.return === root) {
				return;
			}
			node = node.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}

const commitPlacement = (finishedWork: FiberNode) => {
	// parent DOM
	// finishWork -> DOM
	if (__DEV__) {
		console.log('commitPlacement', finishedWork);
	}
	const hostParent = getHostParent(finishedWork);
	if (hostParent === null) {
		console.warn('Expected host parent to exist', finishedWork);
		return;
	}
	appendPlacementNodeIntoContainer(finishedWork, hostParent as Container);
};

// 获取当前节点的宿主节点的父节点。在 React 中，每个组件都有一个对应的 Fiber 节点，Fiber 节点是 React 内部用来描述组件的数据结构。在 React 中，组件可以是 DOM 元素，也可以是自定义组件，而 DOM 元素和自定义组件的父节点是不同的，因此需要通过 getHostParent 函数来获取当前节点的宿主节点的父节点。在 commitPlacement 函数中，会使用 getHostParent 函数来获取当前节点的宿主节点的父节点，然后将当前节点插入到宿主节点的父节点中。
function getHostParent(fiber: FiberNode): Container | null {
	let parent = fiber.return;
	while (parent) {
		const parentTag = parent.tag;
		if (parentTag === HostComponent) {
			return parent.stateNode as Container;
		}
		if (parentTag === HostRoot) {
			return parent.stateNode.container as Container;
		}
		parent = parent.return;
	}
	return null;
}

function appendPlacementNodeIntoContainer(
	finishWork: FiberNode,
	hostContainer: Container
) {
	if (finishWork.tag === HostComponent || finishWork.tag === HostText) {
		appendChildToContainer(hostContainer, finishWork.stateNode);
		return;
	}
	const child = finishWork.child;
	if (child !== null) {
		appendPlacementNodeIntoContainer(child, hostContainer);
		let sibling = child.sibling;
		while (sibling !== null) {
			appendPlacementNodeIntoContainer(sibling, hostContainer);
			sibling = sibling.sibling;
		}
	}
}
