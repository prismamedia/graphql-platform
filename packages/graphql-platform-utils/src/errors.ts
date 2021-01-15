import { Path, printPath } from './path';

export class MaybePathAwareError extends Error {
  public constructor(message: string, path?: Path) {
    super(
      path
        ? `An error occurred at "${printPath(path)}" - ${
            message[0].toLowerCase() + message.slice(1)
          }`
        : message[0].toUpperCase() + message.slice(1),
    );

    Object.defineProperty(this, 'name', {
      value: new.target.name,
      enumerable: false,
      configurable: true,
    });

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnexpectedValueError extends MaybePathAwareError {
  public constructor(value: any | Error, expectation: string, path?: Path) {
    super(
      `expects ${expectation}, ${
        value instanceof Error
          ? `got the error: ${value.message}`
          : `got: ${JSON.stringify(value)}`
      }`,
      path,
    );
  }
}

export class UnexpectedUndefinedValueError extends UnexpectedValueError {
  public constructor(expectation: string = 'a value', path?: Path) {
    super(undefined, expectation, path);
  }
}

export class UnexpectedNullValueError extends UnexpectedValueError {
  public constructor(expectation: string = 'a non-null value', path?: Path) {
    super(null, expectation, path);
  }
}
