import {
  AbstractField,
  AbstractFieldConfig,
  getOptionalFlagValue,
  OptionalFlagValue,
} from '@prismamedia/graphql-platform-utils';
import assert from 'assert';
import { Node } from '../../node';

export interface IComponentConfig<TKind extends string>
  extends AbstractFieldConfig {
  /**
   * Optional, this "kind" property is only used to discriminate the config types when needed
   * @see https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions
   */
  readonly kind?: TKind;

  /**
   * Optional, either the component's value can be null or not
   *
   * Default: true
   */
  readonly nullable?: OptionalFlagValue;

  /**
   * Optional, either the component's value can be changed or not
   *
   * Default: the node's immutability
   */
  readonly immutable?: OptionalFlagValue;
}

export abstract class AbstractComponent extends AbstractField {
  public readonly nullable: boolean;
  public readonly immutable: boolean;

  public constructor(
    public readonly node: Node,
    name: string,
    { kind, nullable, immutable, ...config }: IComponentConfig<any>,
  ) {
    super(node, name, config);

    this.nullable = getOptionalFlagValue(nullable, true);

    this.immutable = getOptionalFlagValue(immutable, node.immutable);
    assert(
      this.immutable || !node.immutable,
      `The "${this.id}" component must be immutable as its node is`,
    );
  }
}
