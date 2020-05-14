import { AnyResource } from '../resource';
import { AnyComponent } from './component/types';

export class ResourceError extends Error {
  constructor(readonly resource: AnyResource, message?: string) {
    super(message);

    Object.defineProperty(this, 'name', {
      value: new.target.name,
      enumerable: false,
    });

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UndefinedComponentError extends ResourceError {
  constructor(
    readonly resource: AnyResource,
    readonly componentOrComponentName: AnyComponent | AnyComponent['name'],
  ) {
    super(
      resource,
      `The resource "${resource}" does not have the component "${
        typeof componentOrComponentName === 'string'
          ? componentOrComponentName
          : componentOrComponentName.name
      }".`,
    );
  }
}

export class InvalidNodeValueError extends ResourceError {
  constructor(readonly resource: AnyResource, cause?: string) {
    super(
      resource,
      `The "${resource}"'s node value is invalid${cause ? `: ${cause}` : ''}.`,
    );
  }
}
