import { GraphQLEnumType } from 'graphql';
import { ResourceError } from '../error';
import { AnyComponent } from './types';

export class ComponentError extends ResourceError {
  constructor(readonly component: AnyComponent, message?: string) {
    super(component.resource, message);

    // In order not to pollute the logs
    Object.defineProperty(this, 'component', { enumerable: false });
  }
}

export class InvalidComponentValueError extends ComponentError {
  constructor(component: AnyComponent, cause?: string) {
    super(
      component,
      `The "${component}"'s value is invalid${cause ? `: ${cause}` : ''}.`,
    );
  }
}

export class UndefinedComponentValueError extends InvalidComponentValueError {
  constructor(component: AnyComponent) {
    super(component, `cannot be undefined`);
  }
}

export class NullComponentValueError extends InvalidComponentValueError {
  constructor(component: AnyComponent) {
    super(component, `cannot be null`);
  }
}

export class InvalidEnumFieldValueError extends InvalidComponentValueError {
  constructor(
    component: AnyComponent,
    enumType: GraphQLEnumType,
    value: unknown,
  ) {
    super(
      component,
      `${value} is not among "${enumType
        .getValues()
        .map(({ value }) => value)
        .join(', ')}"`,
    );
  }
}
