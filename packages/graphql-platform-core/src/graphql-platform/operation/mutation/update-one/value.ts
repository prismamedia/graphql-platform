import {
  fromEntries,
  MaybeUndefinedDecorator,
} from '@prismamedia/graphql-platform-utils';
import {
  AnyComponent,
  AnyField,
  Component,
  ComponentMap,
  FieldValue,
  NodeValue,
  RelationValue,
  Resource,
  UndefinedComponentError,
} from '../../../resource';
import { UndefinedComponentValueError } from '../../../resource/component';

function getComponentByPropertyKey(
  componentMap: ComponentMap,
  propertyKey: keyof any,
): Component | undefined {
  return typeof propertyKey === 'string'
    ? componentMap.get(propertyKey)
    : undefined;
}

const updateInputHookProxyHandler: ProxyHandler<UpdateOneValue> = {
  ownKeys(update) {
    return [...update.resource.getComponentMap().keys()];
  },
  getOwnPropertyDescriptor(update, propertyKey) {
    const component = getComponentByPropertyKey(
      update.resource.getComponentMap(),
      propertyKey,
    );

    return component
      ? {
          value: update.get(component),
          enumerable: true,
        }
      : Reflect.getOwnPropertyDescriptor(update, propertyKey);
  },
  has(update, propertyKey) {
    return (
      typeof getComponentByPropertyKey(
        update.resource.getComponentMap(),
        propertyKey,
      ) !== 'undefined'
    );
  },
  get(update, propertyKey) {
    if (propertyKey === 'toJSON') {
      return () => update.toJSON();
    }

    const component = getComponentByPropertyKey(
      update.resource.getComponentMap(),
      propertyKey,
    );

    if (!component) {
      throw new UndefinedComponentError(update.resource, String(propertyKey));
    }

    return update.get(component);
  },
  set(update, propertyKey, value) {
    const component = getComponentByPropertyKey(
      update.resource.getComponentMap(),
      propertyKey,
    );

    if (!component) {
      throw new UndefinedComponentError(update.resource, String(propertyKey));
    }

    update.set(component, value);

    return true;
  },
  deleteProperty(update, propertyKey) {
    const component = getComponentByPropertyKey(
      update.resource.getComponentMap(),
      propertyKey,
    );

    if (!component) {
      throw new UndefinedComponentError(update.resource, String(propertyKey));
    }

    update.set(component, undefined);

    return true;
  },
};

export type FieldUpdate = FieldValue;

export type RelationUpdate = RelationValue;

export type ComponentUpdate = FieldUpdate | RelationUpdate;

export type UpdateOneRawValue = Partial<{
  [componentName: string]: ComponentUpdate;
}>;

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
      | (TComponent extends AnyField ? FieldValue : RelationUpdate)
      | undefined,
  ): boolean {
    this.resource.assertComponent(component);

    if (typeof update === 'undefined') {
      this.data.delete(component);
    } else {
      this.data.set(
        component,
        component.isField()
          ? component.assertValue(update)
          : component.assertValue(update, true),
      );
    }

    return true;
  }

  public get<TComponent extends AnyComponent, TStrict extends boolean>(
    component: TComponent,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<
    TComponent extends AnyField ? FieldValue : RelationUpdate,
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
      [...this.data.keys()].map((component) => [
        component.name,
        this.get(component),
      ]),
    );
  }

  public toJSON() {
    return this.toNodeValue();
  }
}
