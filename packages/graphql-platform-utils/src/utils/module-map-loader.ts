import { loadModuleMapSync } from '@prismamedia/ts-module-loader';
import { Maybe } from '../types';

export type ModuleMap<T> = Map<string, T>;

export type ModuleMapConfig<T> = Maybe<
  ModuleMap<T> | Record<string, T> | string
>;

export type GetModuleMapConfigType<T> = T extends Record<string, infer M>
  ? M
  : never;

export const loadModuleMap = <T>(config: ModuleMapConfig<T>): ModuleMap<T> =>
  config != null
    ? typeof config === 'string'
      ? loadModuleMapSync<T>({
          directory: config,
          strict: true,
        })
      : config instanceof Map
      ? config
      : new Map(Object.entries(config))
    : new Map();
