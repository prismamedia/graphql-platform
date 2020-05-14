import { SuperSet } from './super-set';

interface NamedObject {
  name: string;
}

export class SuperSetOfNamedObject<
  TNamedObject extends NamedObject
> extends SuperSet<TNamedObject> {
  public getNames(): TNamedObject['name'][] {
    return [...this].map(({ name }) => name);
  }

  public assert(
    objectOrObjectName: TNamedObject['name'] | TNamedObject,
  ): TNamedObject {
    const objectName =
      typeof objectOrObjectName === 'string'
        ? objectOrObjectName
        : objectOrObjectName.name;
    const object = this.find(({ name }) => name === objectName);
    if (!object) {
      throw new Error(
        `"${objectOrObjectName}" does not exist in the "${this.constructor.name}".`,
      );
    }

    return object;
  }

  public sortByName(): this {
    return this.sort(({ name: a }, { name: b }) =>
      a === b ? 0 : a < b ? -1 : 1,
    );
  }
}
