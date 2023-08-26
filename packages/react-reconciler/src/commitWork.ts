import {
	Container,
	Instance,
	appendChildToContainer,
	commitUpdate,
	insertChildToContainer,
	removeChild,
} from 'hostConfig';
import { FiberNode } from './fiber';
import {
	ChildDeletion,
	MutationMask,
	NoFlags,
	Placement,
	Update,
} from './fiberFlags';
import {
	FunctionComponent,
	HostComponent,
	HostRoot,
	HostText,
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

function recordHostChildrenToDetele(
	childrenToDelete: FiberNode[],
	unmountFiber: FiberNode
) {
	// 1. 找到第一个 host root 节点
	// 2. 每找到一个 host root 节点，判断这个节点是不是 1 中找到的兄弟节点
	const lastOne = childrenToDelete[childrenToDelete.length - 1];
	if (!lastOne) {
		// 第一个 host root 节点
		childrenToDelete.push(unmountFiber);
	} else {
		let node = lastOne.sibling;
		while (node !== null) {
			if (unmountFiber === node) {
				childrenToDelete.push(unmountFiber);
			}
			node = node.sibling;
		}
	}
}

// 删除一个 Fiber 节点及其子树，并从 DOM 中移除对应的节点。
function commitDeletion(childToDelete: FiberNode) {
	// 需要删除的根 host 节点，因为 Fragment 的关系，可能会有多个
	/**
	 * <>
	 * 	<div></div>
	 * 	<div></div>
	 * </>
	 */
	const rootChildrenToDelete: FiberNode[] = [];

	// 递归子树
	commitNestedComponents(childToDelete, (unmountFiber) => {
		switch (unmountFiber.tag) {
			case HostComponent: {
				recordHostChildrenToDetele(rootChildrenToDelete, unmountFiber);
				// 解绑 ref
				return;
			}
			case HostText: {
				recordHostChildrenToDetele(rootChildrenToDelete, unmountFiber);
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
	if (rootChildrenToDelete.length !== 0) {
		const hostParent = getHostParent(childToDelete);
		if (hostParent !== null) {
			rootChildrenToDelete.forEach((child) => {
				removeChild((child as FiberNode).stateNode, hostParent);
			});
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

	// 寻找 host sibling
	const sibling = getHostSibling(finishedWork);

	if (hostParent === null) {
		console.warn('Expected host parent to exist', finishedWork);
		return;
	}
	insertOrAppendPlacementNodeIntoContainer(
		finishedWork,
		hostParent as Container,
		sibling
	);
};

function getHostSibling(fiber: FiberNode) {
	let node: FiberNode = fiber;
	findSibling: while (true) {
		// 寻找相同父级的下一个兄弟节点，相同父级只可能是 HostText 或 HostComponent 类型的节点。
		while (node.sibling === null) {
			const parent = node.return;
			if (
				parent === null ||
				parent.tag === HostComponent ||
				parent.tag === HostRoot
			) {
				return null;
			}
			node = parent;
		}

		node.sibling.return = node.return;
		node = node.sibling;
		while (node?.tag !== HostText && node?.tag !== HostComponent) {
			// 向下遍历
			if ((node?.flags & Placement) !== NoFlags) {
				continue findSibling;
			}
			if (node?.child === null) {
				continue findSibling;
			} else {
				node.child.return = node;
				node = node.child;
			}
		}

		if ((node.flags & Placement) === NoFlags) {
			return node.stateNode;
		}
	}
}

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

function insertOrAppendPlacementNodeIntoContainer(
	finishWork: FiberNode,
	hostContainer: Container,
	before?: Instance
) {
	if (finishWork.tag === HostComponent || finishWork.tag === HostText) {
		if (before) {
			insertChildToContainer(hostContainer, finishWork.stateNode, before);
		} else {
			appendChildToContainer(hostContainer, finishWork.stateNode);
		}
		return;
	}
	const child = finishWork.child;
	if (child !== null) {
		insertOrAppendPlacementNodeIntoContainer(child, hostContainer);
		let sibling = child.sibling;
		while (sibling !== null) {
			insertOrAppendPlacementNodeIntoContainer(sibling, hostContainer);
			sibling = sibling.sibling;
		}
	}
}
