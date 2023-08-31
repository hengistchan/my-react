import { CallbackNode } from 'scheduler';
import './style.css';
import {
	unstable_ImmediatePriority as ImmediatePriority,
	unstable_UserBlockingPriority as UserBlockingPriority,
	unstable_NormalPriority as NormalPriority,
	unstable_LowPriority as LowPriority,
	unstable_IdlePriority as IdlePriority,
	unstable_scheduleCallback as scheduleSyncCallback,
	unstable_shouldYield as shouldYield,
	unstable_getFirstCallbackNode as getFirstCallbackNode,
	unstable_cancelCallback as cancelCallback,
} from 'scheduler';
const button = document.querySelector('button')!;
const root = document.querySelector('#root')!;

type Priority =
	| typeof ImmediatePriority
	| typeof UserBlockingPriority
	| typeof NormalPriority
	| typeof LowPriority
	| typeof IdlePriority;

interface Work {
	count: number;
	priority: Priority;
}

const workList: Work[] = [];
let prevPriority: Priority = IdlePriority;
let curCallback: CallbackNode | null = null;

function schedule() {
	const cbNode = getFirstCallbackNode();
	const curWork = workList.sort((a, b) => a.priority - b.priority)[0];
	const { priority: currentPriority } = curWork;
	//  策略逻辑
	if (!curWork) {
		curCallback = null;
		cbNode && cancelCallback(cbNode);
		return;
	}
	if (currentPriority === prevPriority) {
		return;
	}
	// 更高优先级
	cbNode && cancelCallback(cbNode);

	curCallback = scheduleSyncCallback(
		currentPriority,
		preform.bind(null, curWork)
	);
}

function preform(work: Work, didTimeout?: boolean) {
	/**
	 * 1. work 优先级
	 * 2. 处理饥饿问题
	 * 3. 时间切片
	 */
	const needSync = work.priority === ImmediatePriority || didTimeout;
	while ((needSync || !shouldYield()) && work.count) {
		work.count--;
		insertSpan('' + work.priority, work.priority);
	}
	// 中断执行或者执行完
	prevPriority = work.priority;
	if (!work.count) {
		const workIndex = workList.indexOf(work);
		workIndex !== -1 && workList.splice(workIndex, 1);
		prevPriority = IdlePriority;
	}
	const prevCallback = curCallback;
	schedule();
	const newCallback = curCallback;
	if (newCallback && prevCallback === newCallback) {
		return preform.bind(null, work);
	}
}

function insertSpan(content: string, priority: Priority) {
	const span = document.createElement('span');
	span.innerText = content;
	span.className = 'priority-' + priority;
	doSomeBusyWork(5000000);
	root.appendChild(span);
}

(
	[
		LowPriority,
		NormalPriority,
		UserBlockingPriority,
		ImmediatePriority,
	] as Priority[]
).forEach((priority) => {
	const button = document.createElement('button');
	button.innerText = [
		'',
		'ImmediatePriority',
		'UserBlockingPriority',
		'NormalPriority',
		'LowPriority',
	][priority];
	button.onclick = () => {
		workList.unshift({ count: 100, priority });
		schedule();
	};
	document.querySelector('#buttons')!.appendChild(button);
});

function doSomeBusyWork(duration: number) {
	let result = 0;
	while (duration--) {
		result += duration;
	}
}
