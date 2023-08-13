import path from 'path';
import fs from 'fs';

import ts from 'rollup-plugin-typescript2';
import cjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const pkgsPath = path.resolve(__dirname, '../../packages');
const distPath = path.resolve(__dirname, '../../dist/node_modules');

export function resolvePkgPath(pkgName, isDist = false) {
	if (isDist) {
		return path.resolve(distPath, pkgName);
	}
	return path.resolve(pkgsPath, pkgName);
}

export function getPackageJSON(pkgName) {
	const path = `${resolvePkgPath(pkgName)}/package.json`;
	const str = fs.readFileSync(path, 'utf-8');
	return JSON.parse(str);
}

export function getBaseRollupPlugins({
	alias = {
		__DEV__: true,
		preventAssignment: true
	},
	typescript = {}
} = {}) {
	return [replace(alias), cjs(), ts(typescript)];
}
