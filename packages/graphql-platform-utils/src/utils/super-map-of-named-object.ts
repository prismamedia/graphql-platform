import { SuperMap } from './super-map';

interface NamedObject {
  name: string;
}

export class SuperMapOfNamedObject<TNamedObject extends NamedObject> extends SuperMap<
  TNamedObject['name'],
  TNamedObject
> {
  public getNames(): TNamedObject['name'][] {
    return [...this.keys()];
  }

  public assert(objectOrObjectName: TNamedObject['name'] | TNamedObject): TNamedObject {
    const object = this.get(typeof objectOrObjectName === 'string' ? objectOrObjectName : objectOrObjectName.name);
    if (!object) {
      throw new Error(`"${objectOrObjectName}" does not exist in the "${this.constructor.name}".`);
    }

    return object;
  }
}
