import {
  fromEntries,
  getEnumValues,
  isPlainObject,
  MaybeUndefinedDecorator,
  POJO,
} from '@prismamedia/graphql-platform-utils';
import {
  AnyComponent,
  AnyField,
  Component,
  ComponentMap,
  FieldValue,
  List,
  NodeValue,
  RelationValue,
  Resource,
  UndefinedComponentError,
} from '../../../resource';
import { UndefinedComponentValueError } from '../../../resource/component';

function getComponentByPropertyKey(componentMap: ComponentMap, propertyKey: keyof any): Component | undefined {
  return typeof propertyKey === 'string' ? componentMap.get(propertyKey) : undefined;
}

const updateInputHookProxyHandler: ProxyHandler<UpdateOneValue> = {
  ownKeys(update) {
    return [...update.resource.getComponentMap().keys()];
  },
  has(update, propertyKey) {
    return typeof getComponentByPropertyKey(update.resource.getComponentMap(), propertyKey) !== 'undefined';
  },
  get(update, propertyKey) {
    if (propertyKey === 'toJSON') {
      return () => update.toJSON();
    }

    const component = getComponentByPropertyKey(update.resource.getComponentMap(), propertyKey);
    if (!component) {
      throw new UndefinedComponentError(update.resource, String(propertyKey));
    }

    return update.get(component);
  },
  set(update, propertyKey, value) {
    const component = getComponentByPropertyKey(update.resource.getComponentMap(), propertyKey);
    if (!component) {
      throw new UndefinedComponentError(update.resource, String(propertyKey));
    }

    update.set(component, value);

    return true;
  },
  deleteProperty(update, propertyKey) {
    const component = getComponentByPropertyKey(update.resource.getComponentMap(), propertyKey);
    if (!component) {
      throw new UndefinedComponentError(update.resource, String(propertyKey));
    }

    update.set(component, undefined);

    return true;
  },
};

export enum FieldListUpdateKind {
  Set = 'set',
  Push = 'push',
  Pop = 'pop',
  Remove = 'remove',
}

// For scalar lists, cf: https://github.com/prisma/prisma/issues/1275
export type FieldListUpdate =
  | {
      [FieldListUpdateKind.Set]: FieldValue;
    }
  | {
      [FieldListUpdateKind.Push]: FieldValue;
      location?: number;
    }
  | {
      [FieldListUpdateKind.Pop]: number;
    }
  | {
      [FieldListUpdateKind.Remove]: POJO;
    };

export type FieldUpdate = FieldValue | FieldListUpdate;

export type RelationUpdate = RelationValue;

export type ComponentUpdate = FieldUpdate | RelationUpdate;

export type UpdateOneRawValue = Partial<{ [componentName: string]: ComponentUpdate }>;

export class UpdateOneValue {
  protected data: Map<Component, ComponentUpdate> = new Map();

  constructor(readonly resource: Resource, data: UpdateOneRawValue) {
    for (const component of resource.getComponentSet()) {
      this.set(component, data[component.name] as any);
    }
  }

  public set<TComponent extends AnyComponent>(
    component: TComponent,
    update:
      | (TComponent extends AnyField
          ? (TComponent extends List<AnyField> ? FieldListUpdate : FieldValue)
          : RelationUpdate)
      | undefined,
  ): boolean {
    this.resource.assertComponent(component);

    if (typeof update === 'undefined') {
      this.data.delete(component);
    } else {
      if (component.isField()) {
        if (component.isList()) {
          if (!isPlainObject(update)) {
            throw new Error(`The field "${component}"'s action has to be an object: "${update}" given`);
          }

          if (FieldListUpdateKind.Set in update) {
            this.data.set(component, {
              [FieldListUpdateKind.Set]: component.assertValue((update as any)[FieldListUpdateKind.Set]),
            } as FieldUpdate);
          } else {
            throw new Error(
              `The field "${component}" supports exactly 1 action among: ${getEnumValues(FieldListUpdateKind).join(
                ', ',
              )}`,
            );
          }

          throw new Error(`The field "${component}"'s list type is not supported, yet`);
        } else {
          this.data.set(component, component.assertValue(update));
        }
      } else {
        this.data.set(component, component.assertValue(update, true));
      }
    }

    return true;
  }

  public get<TComponent extends AnyComponent, TStrict extends boolean>(
    component: TComponent,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<
    TComponent extends AnyField ? (TComponent extends List<AnyField> ? FieldListUpdate : FieldValue) : RelationUpdate,
    TStrict
  > {
    const value = this.data.get(component);
    if (typeof value === 'undefined' && strict === true) {
      throw new UndefinedComponentValueError(component);
    }

    return value as any;
  }

  public isEmpty(): boolean {
    return this.data.size === 0;
  }

  // Let's the value be manipulated easily AND safely in the hooks
  public toProxy(): { proxy: UpdateOneRawValue; revoke: () => void } {
    return Proxy.revocable(this, updateInputHookProxyHandler) as any;
  }

  public toNodeValue(): Partial<NodeValue> {
    return fromEntries(
      [...this.data.keys()].map(component => {
        if (component.isField() && component.isList()) {
          const value = this.get(component);
          if (value && FieldListUpdateKind.Set in value) {
            return [component.name, (value as any)[FieldListUpdateKind.Set]];
          }
        } else {
          return [component.name, this.get(component)];
        }
      }),
    );
  }

  public toJSON() {
    return this.toNodeValue();
  }
}
