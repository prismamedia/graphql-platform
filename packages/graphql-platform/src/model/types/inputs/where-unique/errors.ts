import {
  indefinite,
  Path,
  UnexpectedValueError,
} from '@prismamedia/graphql-platform-utils';
import { Model } from '../../../../model';

export class UniqueValueNotFoundError extends UnexpectedValueError {
  public constructor(model: Model, value: unknown, path?: Path) {
    super(
      value,
      `${indefinite(model.name, { quote: true })} unique value`,
      path,
    );
  }
}
