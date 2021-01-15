import {
  InputField,
  InputFieldConfig,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { Except } from 'type-fest';
import { WhereInput } from '../where-input';
import { TFilterValue } from './ast';

export interface FilterConfig
  extends Except<InputFieldConfig, 'required' | 'defaultValue'> {
  parseValue(value: any, path: Path): TFilterValue;
}

export class Filter extends InputField {
  public readonly parseValue: FilterConfig['parseValue'];

  public constructor(
    public readonly whereInput: WhereInput,
    name: string,
    { parseValue, ...config }: FilterConfig,
  ) {
    super(whereInput, name, { nullable: false, ...config, required: false });

    this.parseValue = parseValue.bind(this);
  }
}
