import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from 'shared/ReactSymbols';

import type {
	Type,
	Key,
	Ref,
	Props,
	ReactElementType,
	ElementType,
} from 'shared/ReactTypes';

// ReactElement
const ReactElement = function (
	type: Type,
	key: Key,
	ref: Ref,
	props: Props
): ReactElementType {
	const element = {
		$$typeof: REACT_ELEMENT_TYPE,
		type,
		key,
		ref,
		props,
		__mark: 'HJ',
	};
	return element;
};

export const jsx = function (
	type: ElementType,
	config: any,
	...maybeChildren: any
) {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	for (const prop in config) {
		const value = config[prop];
		if (prop === 'key' && value !== undefined) {
			key = '' + value;
		} else if (prop === 'ref' && value !== undefined) {
			ref = value;
		} else if (Object.hasOwnProperty.call(config, prop)) {
			props[prop] = value;
		}
	}

	const maybeChildrenLength = maybeChildren.length;
	if (maybeChildrenLength === 1) {
		props.children = maybeChildren[0];
	} else if (maybeChildrenLength > 1) {
		props.children = maybeChildren;
	}

	return ReactElement(type, key, ref, props);
};

export const jsxDEV = function (type: ElementType, config: any) {
	let key: Key = null;
	const props: Props = {};
	let ref: Ref = null;

	for (const prop in config) {
		const value = config[prop];
		if (prop === 'key' && value !== undefined) {
			key = '' + value;
		} else if (prop === 'ref' && value !== undefined) {
			ref = value;
		} else if (Object.hasOwnProperty.call(config, prop)) {
			props[prop] = value;
		}
	}

	return ReactElement(type, key, ref, props);
};

export const Fragment = REACT_FRAGMENT_TYPE;

export function isValidElement(object: any): boolean {
	return (
		typeof object === 'object' &&
		object !== null &&
		object.$$typeof === REACT_ELEMENT_TYPE
	);
}
