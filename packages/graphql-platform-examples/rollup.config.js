import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import builtinModules from 'builtin-modules';

export default {
  input: 'src/gp.ts',
  external: builtinModules,
  output: {
    dir: 'build',
    format: 'cjs',
  },
  plugins: [typescript(), commonjs(), resolve({ preferBuiltins: true })],
};
