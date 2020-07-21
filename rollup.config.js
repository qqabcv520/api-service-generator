// Rollup plugins

import json from 'rollup-plugin-json';
import commonjs from "rollup-plugin-commonjs";
import tslint from "rollup-plugin-tslint";
import typescript from "rollup-plugin-typescript";

export default {
    input: 'src/main.ts',
    output: {
        file: 'dist/index.js',
        format: 'cjs'
    },
    plugins: [
        json(),
        tslint(),
        typescript(),
        commonjs({extensions: ['.js', '.ts']}),
    ],
    // 指出应将哪些模块视为外部模块
    external: id => /node_modules/.test(id)
}
