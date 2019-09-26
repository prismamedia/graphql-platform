import {
  InputField,
  InputFieldConfig,
  Path,
} from '@prismamedia/graphql-platform-utils';
import { Promisable } from 'type-fest';
import { OperationContext } from '../../../context';
import { CreateOperation } from '../../create';

export type TCreateInputFieldParser<TInput, TOutput> = (args: {
  value: TInput;
  operationContext: OperationContext;
  path: Path;
}) => Promisable<TOutput>;

export interface ICreateInputFieldConfig<TValue, TResolvedValue, TParsedValue>
  extends InputFieldConfig<TValue> {
  /**
   * Optional, names of the fields this parser uses (in order to ensure their presence in the parser's "dependencies" argument)
   *
   * Default: none
   */
  readonly dependencies?: ReadonlyArray<string>;

  // /**
  //  * Given the resolved data, if any, process it
  //  */
  // parser?(args: {
  //   value: TResolvedValue;
  //   path: Path;
  //   operationContext: OperationContext;
  // }): Promisable<TParsedValue>;
}

export abstract class AbstractCreateInputField<
  TValue,
  TResolvedValue,
  TParsedValue = TValue
> extends InputField<TValue> {
  public readonly dependsOn: ReadonlySet<string>;
  // #parser: ICreateInputFieldConfig<
  //   TValue,
  //   TResolvedValue,
  //   TParsedValue
  // >['parser'];

  public constructor(
    public readonly operation: CreateOperation,
    name: string,
    {
      dependencies,
      // parser,
      ...config
    }: ICreateInputFieldConfig<TValue, TResolvedValue, TParsedValue>,
  ) {
    super(operation, name, config);

    this.dependsOn = new Set(dependencies);
    // this.#parser = parser?.bind(this);
  }

  // public async parseValue(args: {
  //   value: Maybe<TValue>;
  //   operationContext: OperationContext;
  //   path: Path;
  // }): Promise<Maybe<TParsedValue>> {
  //   const { value, path } = args;

  //   // Common checks
  //   // if (this.managed) {
  //   //   if (value !== undefined) {
  //   //     throw new UnexpectedValueError(path, value, 'no value');
  //   //   }
  //   // } else if (!this.nullable) {
  //   //   if (isNil(value)) {
  //   //     throw new UnexpectedValueError(path, value, 'a non-null value');
  //   //   }
  //   // }

  //   // const preParsedValue = this.#preParser
  //   //   ? await this.#preParser(args)
  //   //   : value;

  //   // const parsedValue = isNil(preParsedValue)
  //   //   ? preParsedValue
  //   //   : await this.#parser({ ...args, value: preParsedValue });

  //   // return this.#postParser
  //   //   ? this.#postParser({ ...args, value: parsedValue })
  //   //   : parsedValue;
  // }
}
