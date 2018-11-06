export type Class<TInstance = any, TArgs extends any[] = any[]> = new (...args: TArgs) => TInstance;
