import {
  fromEntries,
  MaybeUndefinedDecorator,
} from '@prismamedia/graphql-platform-utils';
import {
  Component,
  ComponentMap,
  ComponentValue,
  FieldValue,
  NodeValue,
  RelationValue,
  Resource,
  UndefinedComponentError,
  UndefinedComponentValueError,
} from '../../../resource';
import { AnyComponent, AnyField } from '../../../resource/component';

function getComponentByPropertyKey(
  componentMap: ComponentMap,
  propertyKey: keyof any,
): Component | undefined {
  return typeof propertyKey === 'string'
    ? componentMap.get(propertyKey)
    : undefined;
}

const createInputHookProxyHandler: ProxyHandler<CreateOneValue> = {
  ownKeys(create) {
    return [...create.resource.getComponentMap().keys()];
  },
  getOwnPropertyDescriptor(create, propertyKey) {
    const component = getComponentByPropertyKey(
      create.resource.getComponentMap(),
      propertyKey,
    );

    return component
      ? {
          value: create.get(component),
          enumerable: true,
        }
      : Reflect.getOwnPropertyDescriptor(create, propertyKey);
  },
  has(create, propertyKey) {
    return (
      typeof getComponentByPropertyKey(
        create.resource.getComponentMap(),
        propertyKey,
      ) !== 'undefined'
    );
  },
  get(create, propertyKey) {
    if (propertyKey === 'toJSON') {
      return () => create.toJSON();
    }

    const component = getComponentByPropertyKey(
      create.resource.getComponentMap(),
      propertyKey,
    );

    if (!component) {
      throw new UndefinedComponentError(create.resource, String(propertyKey));
    }

    return create.get(component);
  },
  set(create, propertyKey, value) {
    const component = getComponentByPropertyKey(
      create.resource.getComponentMap(),
      propertyKey,
    );

    if (!component) {
      throw new UndefinedComponentError(create.resource, String(propertyKey));
    }

    create.set(component, value);

    return true;
  },
  deleteProperty(create, propertyKey) {
    const component = getComponentByPropertyKey(
      create.resource.getComponentMap(),
      propertyKey,
    );

    if (!component) {
      throw new UndefinedComponentError(create.resource, String(propertyKey));
    }

    create.set(component, undefined);

    return true;
  },
};

export type CreateOneRawValue = Partial<{
  [componentName: string]: ComponentValue;
}>;

export class CreateOneValue {
  protected data: Map<Component, ComponentValue> = new Map();

  constructor(readonly resource: Resource, data: CreateOneRawValue) {
    for (const component of resource.getComponentSet()) {
      this.set(component, data[component.name]);
    }
  }

  public set<TComponent extends AnyComponent>(
    component: TComponent,
    value:
      | (TComponent extends AnyField ? FieldValue : RelationValue)
      | undefined,
  ): boolean {
    this.resource.assertComponent(component);

    if (typeof value === 'undefined') {
      if (component.isRequired()) {
        throw new UndefinedComponentValueError(component);
      }

      this.data.delete(component);
    } else {
      this.data.set(
        component,
        component.isField()
          ? component.assertValue(value)
          : component.assertValue(value, true),
      );
    }

    return true;
  }

  public get<TComponent extends AnyComponent, TStrict extends boolean>(
    component: TComponent,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<
    TComponent extends AnyField ? FieldValue : RelationValue,
    TStrict
  > {
    const value = this.data.get(component);
    if (typeof value === 'undefined' && strict === true) {
      throw new UndefinedComponentValueError(component);
    }

    return value as any;
  }

  // Let's the value be manipulated easily AND safely in the hooks
  public toProxy(): { proxy: CreateOneRawValue; revoke: () => void } {
    return Proxy.revocable(this, createInputHookProxyHandler) as any;
  }

  public toNodeValue(): Partial<NodeValue> {
    return fromEntries(
      [...this.data].map(([component, componentValue]) => [
        component.name,
        componentValue,
      ]),
    );
  }

  public toJSON() {
    return this.toNodeValue();
  }
}
