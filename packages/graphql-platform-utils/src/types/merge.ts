export type Merge<T0, T1> = Omit<T0, Extract<keyof T0, keyof T1>> & T1;
