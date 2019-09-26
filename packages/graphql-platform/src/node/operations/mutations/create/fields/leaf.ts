import { Leaf, TLeafValue } from '../../../../node';
import { CreateOperation } from '../../create';
import { AbstractCreateInputField, ICreateInputFieldConfig } from './abstract';

export interface ICreateLeafInputFieldConfig
  extends Partial<
    ICreateInputFieldConfig<TLeafValue, TLeafValue, TLeafValue>
  > {}

export class CreateLeafInputField extends AbstractCreateInputField<
  TLeafValue,
  TLeafValue,
  TLeafValue
> {
  public constructor(operation: CreateOperation, public readonly leaf: Leaf) {
    super(operation, leaf.name, {
      // Defaults
      description: leaf.description,
      nullable: leaf.nullable,
      public: leaf.public,
      type: leaf.type,
      // parser: ({ value, path }) => leaf.assertValue(value, false, path),

      // Custom config
      ...leaf.config?.inputs?.create,
    });
  }
}
