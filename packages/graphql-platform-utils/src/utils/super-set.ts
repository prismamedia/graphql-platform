export class SuperSet<V = any> extends Set<V> {
  public some(some: (value: V, index: number) => boolean): boolean {
    return [...this].some(some);
  }

  public every(every: (value: V, index: number) => boolean): boolean {
    return [...this].every(every);
  }

  public find(find: (value: V, index: number) => boolean): V | undefined {
    return [...this].find(find);
  }

  public first(): V | undefined {
    return this.find((_, index) => index === 0);
  }

  public assertFirst(): V {
    const first = this.first();
    if (typeof first === 'undefined') {
      throw new Error(`There is no "first" element as the "${this.constructor.name}" is empty.`);
    }

    return first;
  }

  public filter(filter: (value: V, index: number) => boolean): this {
    return new (this.constructor as typeof SuperSet)([...this].filter(filter)) as this;
  }

  public count(filter?: (value: V, index: number) => boolean): number {
    return filter ? [...this].filter(filter).length : this.size;
  }

  public push(...values: Array<V | this>): number {
    for (const value of values) {
      if (value instanceof Set) {
        this.push(...value);
      } else {
        this.add(value);
      }
    }

    return this.size;
  }

  public unshift(...values: Array<V | this>): number {
    const original: this = new (this.constructor as typeof SuperSet)(this) as this;
    this.clear();
    this.push(...values, original);

    return this.size;
  }

  public concat(...values: Array<V | this>): this {
    const newSet = new (this.constructor as typeof SuperSet)() as this;
    newSet.push(this, ...values);

    return newSet;
  }

  /**
   * Returns a new Set containing all the entries not present in any of the args.
   */
  public diff(...args: Array<V | this>): this {
    const argSet = (new (this.constructor as typeof SuperSet)() as this).concat(...args);

    return this.filter(value => !argSet.has(value));
  }

  /**
   * Returns a new Set containing all the entries present in all of the args.
   */
  public intersect(...args: Array<V | this>): this {
    return this.filter(value => args.every(arg => (arg instanceof Set ? arg.has(value) : arg === value)));
  }

  /**
   * Sort the Set "in place"
   * cf: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
   */
  public sort(sort?: (a: V, b: V) => number): this {
    const sortedValues = [...this].sort(sort);
    this.clear();
    this.push(...sortedValues);

    return this;
  }

  public join(separator: string = ','): string {
    return [...this].join(separator);
  }
}
