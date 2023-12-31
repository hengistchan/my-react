import { FiberNode } from 'react-reconciler/src/fiber';
import { HostComponent, HostText } from 'react-reconciler/src/workTags';
import { DOMElement, updateFiberProps } from './SyntheicEvent';
import { Props } from 'shared/ReactTypes';

export type Container = Element;
export type Instance = Element;
export type TextInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
	const element = document.createElement(type) as unknown as DOMElement;
	updateFiberProps(element, props);
	return element;
};

export const appendInitialChild = (
	parent: Instance | Container,
	child: Instance
) => {
	parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
	return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
	switch (fiber.tag) {
		case HostText: {
			const text = fiber.memoizedProps.content;
			return commitTextUpdate(fiber.stateNode, text);
		}
		default: {
			if (__DEV__) {
				console.error('Not implemented', fiber.tag);
			}
		}
	}
}

export function commitTextUpdate(textInstance: TextInstance, content: string) {
	textInstance.textContent = content;
}

export function removeChild(
	child: Instance | TextInstance,
	container: Container
) {
	container.removeChild(child);
}

export function insertChildToContainer(
	container: Container,
	child: Instance | TextInstance,
	before?: Instance | TextInstance | null
) {
	container.insertBefore(child, before || null);
}

export const scheduleMicosTask =
	typeof queueMicrotask === 'function'
		? queueMicrotask
		: typeof Promise === 'function'
		? (fn: () => void) => Promise.resolve().then(fn)
		: setTimeout;
