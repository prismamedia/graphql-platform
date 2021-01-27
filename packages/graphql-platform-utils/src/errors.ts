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
  public constructor(
    value: any,
    expectation: string | { toString(): string },
    path?: Path,
  ) {
    super(`expects ${expectation}, got: ${JSON.stringify(value)}`, path);
  }
}

export class UnreachableValueError extends UnexpectedValueError {
  public constructor(
    unreachableValue: never,
    expectation: string | { toString(): string },
    path?: Path,
  ) {
    super(unreachableValue, expectation, path);
  }
}
