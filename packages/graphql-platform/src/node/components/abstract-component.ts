import {
  getOptionalFlag,
  OptionalFlag,
} from '@prismamedia/graphql-platform-utils';
import { assertValidName } from 'graphql';
import { Node } from '../../node';

export interface IComponentConfig<TKind extends string> {
  /**
   * Optional, this "kind" property is only used to discriminate the config types when needed
   *
   * @see https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions
   */
  kind?: TKind;

  /**
   * Optional, provide a description for this component
   */
  description?: string;

  /**
   * Optional, either the component's value can be null or not
   *
   * Default: true
   */
  nullable?: OptionalFlag;

  /**
   * Optional, either the component's value can be changed or not
   *
   * Default: false
   */
  immutable?: OptionalFlag;
}

export abstract class AbstractComponent {
  public readonly id: string;
  public readonly description: string | undefined;
  public readonly nullable: boolean;
  public readonly immutable: boolean;

  public constructor(
    public readonly node: Node,
    public readonly name: string,
    { description, nullable, immutable }: Readonly<IComponentConfig<any>>,
  ) {
    // Is valid against the GraphQL rules
    assertValidName(name);

    this.id = `${node.name}.${name}`;
    this.description = description || undefined;
    this.nullable = getOptionalFlag(nullable, true);
    this.immutable = getOptionalFlag(immutable, false);
  }

  public toString(): string {
    return this.id;
  }

  public abstract get public(): boolean;
}
