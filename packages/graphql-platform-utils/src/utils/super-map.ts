import { SuperSet } from './super-set';

export class SuperMap<K = any, V = any> extends Map<K, V> {
  public some(some: (entry: [K, V], index: number) => boolean): boolean {
    return [...this].some(some);
  }

  public every(every: (entry: [K, V], index: number) => boolean): boolean {
    return [...this].every(every);
  }

  public find(find: (entry: [K, V], index: number) => boolean): [K, V] | undefined {
    return [...this].find(find);
  }

  public first(): [K, V] | undefined {
    return this.find((_, index) => index === 0);
  }

  public assertFirst(): [K, V] {
    const first = this.first();
    if (typeof first === 'undefined') {
      throw new Error(`There is no "first" element as the "${this.constructor.name}" is empty.`);
    }

    return first;
  }

  public filter(filter: (entry: [K, V], index: number) => boolean): this {
    return new (this.constructor as typeof SuperMap)([...this].filter(filter)) as this;
  }

  public count(filter?: (entry: [K, V], index: number) => boolean): number {
    return filter ? [...this].filter(filter).length : this.size;
  }

  public push(...entries: Array<[K, V] | this>): number {
    for (const entry of entries) {
      if (entry instanceof Map) {
        this.push(...entry);
      } else {
        this.set(...entry);
      }
    }

    return this.size;
  }

  public unshift(...entries: Array<[K, V] | this>): number {
    const original: this = new (this.constructor as typeof SuperMap)(this) as this;
    this.clear();
    this.push(...entries, original);

    return this.size;
  }

  public concat(...entries: Array<[K, V] | this>): this {
    const newMap = new (this.constructor as typeof SuperMap)() as this;
    newMap.push(this, ...entries);

    return newMap;
  }

  public toSet(constructor: new (values: ReadonlyArray<V>) => SuperSet<V> = SuperSet): SuperSet<V> {
    return new constructor([...this.values()]);
  }
}
