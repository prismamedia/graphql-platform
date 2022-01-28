import { isConstructor } from './is-constructor.js';

describe('Is constructor', () => {
  it.each<any>([{}, () => {}])(
    '%p is not a constructor',
    (maybeConstructor) => {
      expect(isConstructor(maybeConstructor)).toBeFalsy();
      expect(() => new maybeConstructor()).toThrowError();
    },
  );

  it.each<any>([function () {}, function test() {}, class {}, class Test {}])(
    '%p is a constructor',
    (maybeConstructor) => {
      expect(isConstructor(maybeConstructor)).toBeTruthy();
      expect(new maybeConstructor()).toBeDefined();
    },
  );
});
