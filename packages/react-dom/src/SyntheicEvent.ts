import { Container } from 'hostConfig';
import { Props } from 'shared/ReactTypes';

export const elementPropsKey = '__props';

export interface DOMElement extends Element {
	[elementPropsKey]: Props;
}

interface SyntheticEvent extends Event {
	type: string;
	__stopPropagation: boolean;
}

type EventCallback = (e: Event) => void;

interface Paths {
	capture: EventCallback[];
	bubble: EventCallback[];
}

export function updateFiberProps(node: DOMElement, props: Props) {
	node[elementPropsKey] = props;
}

const vaildEventTpyeList = ['click'];

export function initEvent(container: Container, eventType: string) {
	if (!vaildEventTpyeList.includes(eventType)) {
		console.error('invalid event type', eventType);
		return;
	}

	if (__DEV__) {
		console.log('initEvent: ', 'eventType -> ', eventType, container);
	}

	container.addEventListener(eventType, (e) => {
		dispatchEvent(container, eventType, e);
	});
}

function dispatchEvent(container: Container, eventType: string, e: Event) {
	// 1. 收集沿途的事件处理函数
	// 2. 构造合成事件
	// 3. 遍历 capture
	// 4. 遍历 bubble
	const tragetElement = e.target as DOMElement;
	if (tragetElement === null) {
		console.error('targetElement is null');
		return;
	}
	const { bubble, capture } = collectPaths(tragetElement, container, eventType);

	// 构造合成事件
	const se = createSyntheticEvent(e);

	// 遍历 capture
	triggerEventFlow(capture, se);

	if (!se.__stopPropagation) {
		// 遍历 bubble
		triggerEventFlow(bubble, se);
	}
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
	for (let i = 0; i < paths.length; i++) {
		const callback = paths[i];
		console.log('triggerEventFlow: ', callback);

		callback.call(null, se);
		if (se.__stopPropagation) {
			break;
		}
	}
}

function createSyntheticEvent(e: Event): SyntheticEvent {
	const syntheticEvent = e as SyntheticEvent;
	syntheticEvent.__stopPropagation = false;
	const originStopPropagation = e.stopPropagation;

	syntheticEvent.stopPropagation = () => {
		syntheticEvent.__stopPropagation = true;
		if (originStopPropagation) {
			originStopPropagation.call(e);
		}
	};

	return syntheticEvent;
}

function getEventCallbackNameFromEventType(): Record<
	string,
	string[] | undefined
> {
	return {
		click: ['onClickCapture', 'onClick'],
	};
}

function collectPaths(
	targetElement: DOMElement,
	container: Container,
	eventType: string
) {
	const paths: Paths = {
		capture: [],
		bubble: [],
	};
	while (targetElement && targetElement !== container) {
		const elementProps = targetElement[elementPropsKey];
		if (elementProps) {
			// click -> onClick -> onClickCapture
			const callbackNameList = getEventCallbackNameFromEventType()[eventType];
			if (callbackNameList) {
				callbackNameList.forEach((callbackName, i) => {
					const eventCallback = elementProps[callbackName];
					if (eventCallback) {
						if (i === 0) {
							// capture 从前往后
							paths.capture.unshift(eventCallback);
						} else {
							// bubble 从后往前
							paths.bubble.push(eventCallback);
						}
					}
				});
			}
		}
		targetElement = targetElement.parentNode as DOMElement;
	}
	return paths;
}
