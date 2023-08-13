import { Key, Props, ReactElementType, Ref } from 'shared/ReactTypes';
import { FunctionComponent, HostComponent, WorkTag } from './workTags';
import { Flags, NoFlags } from './fiberFlags';
import { Container } from 'hostConfig';
import { UpdateQueue } from './updateQueue';

export class FiberNode {
	type: any;
	tag: WorkTag;
	key: Key;
	stateNode: any;

	return: FiberNode | null;
	child: FiberNode | null;
	sibling: FiberNode | null;
	index: number;
	ref: Ref;

	pendingProps: Props;
	memoizedProps: Props | null;
	memoizedState: any;
	updateQueue: UpdateQueue<unknown> | null;

	// 用于双缓冲，如果当前 fiberNode 是 current，则 alternate 指向 workInProgress，反之亦然
	alternate: FiberNode | null;

	flags: Flags;
	subtreeFlags: Flags; // 子树的 flags

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key;
		// HostComponent <div> -> div DOM
		this.stateNode = null;
		this.type = null;
		// FunctionComponent <App /> -> App
		this.type = null;

		// 构成树状结构
		// 指向父 fiberNode
		this.return = null;
		// 指向右边的兄弟 fiberNode
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		// 作为工作单元的属性
		this.pendingProps = pendingProps;
		// 确定下来的 props
		this.memoizedProps = null;
		this.updateQueue = null;
		this.memoizedState = null;

		this.alternate = null;

		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
	}
}

export class FiberRootNode {
	// 挂载的 DOM 节点
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;

	constructor(container: Container, hostRootFiber: FiberNode) {
		this.container = container;
		this.current = hostRootFiber;
		hostRootFiber.stateNode = this;
		this.finishedWork = null;
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		// mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.type = current.type;
		wip.stateNode = current.stateNode;
		wip.alternate = current;
		// 交换
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
	}

	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;

	return wip;
};

export function createFIberForElement(element: ReactElementType) {
	const { type, key, props } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		fiberTag = HostComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.error('Element type is invalid', element);
	}

	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;

	return fiber;
}
