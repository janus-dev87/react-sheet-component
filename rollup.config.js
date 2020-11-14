/* eslint-disable import/no-anonymous-default-export */

import typescript from "rollup-plugin-typescript2";
import postcss from "rollup-plugin-postcss";
import pkg from "./package.json";

export default [
  {
    input: "src/index.tsx",
    output: {
      dir: "dist",
      format: "cjs",
      exports: "named",
      sourcemap: true,
    },
    plugins: [typescript(), postcss()],
    external: Object.keys(pkg.dependencies),
  },
  {
    input: "src/index.tsx",
    output: {
      dir: "dist/es",
      format: "es",
      exports: "named",
      sourcemap: true,
    },
    plugins: [typescript(), postcss()],
    external: Object.keys(pkg.dependencies),
  },
];
