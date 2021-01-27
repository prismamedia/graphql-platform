import { Input, InputConfig, Path } from '@prismamedia/graphql-platform-utils';
import { Except } from 'type-fest';
import { WhereInput } from '../where';
import { FilterValue } from './ast';

export interface FilterConfig
  extends Except<InputConfig, 'required' | 'defaultValue'> {
  parseValue(value: any, path: Path): FilterValue;
}

export class Filter extends Input {
  public readonly parseValue: FilterConfig['parseValue'];

  public constructor(
    public readonly whereInput: WhereInput,
    name: string,
    { parseValue, ...config }: FilterConfig,
  ) {
    super(name, { nullable: false, ...config, required: false });

    this.parseValue = parseValue.bind(this);
  }
}
