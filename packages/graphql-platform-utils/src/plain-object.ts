import _ from 'lodash';

export type PlainObject = { [key: string]: any };

export const isPlainObject = (
  maybePlainObject: unknown,
): maybePlainObject is PlainObject => _.isPlainObject(maybePlainObject);
