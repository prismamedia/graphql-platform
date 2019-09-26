import { Memoize } from '@prismamedia/ts-memoize';
import assert from 'assert';
import {
  IConnector,
  TConnectorOverridesKind,
  TGetConnectorOverrides,
} from '../connector';
import { Node } from '../node';
import { Leaf, TComponent } from './component';

type TFullUniqueConstraintConfig<TConnector extends IConnector> = {
  components: string[];
  name?: string;
} & TGetConnectorOverrides<
  TConnector,
  TConnectorOverridesKind.UniqueConstraint
>;

type TShortUniqueConstraintConfig<
  TConnector extends IConnector
> = TFullUniqueConstraintConfig<TConnector>['components'];

export type TUniqueConstraintConfig<TConnector extends IConnector> =
  | TFullUniqueConstraintConfig<TConnector>
  | TShortUniqueConstraintConfig<TConnector>;

const isShortConfig = <TConnector extends IConnector>(
  config: TUniqueConstraintConfig<TConnector>,
): config is TShortUniqueConstraintConfig<TConnector> => Array.isArray(config);

export class UniqueConstraint<TConnector extends IConnector = any> {
  public readonly config: TFullUniqueConstraintConfig<TConnector>;
  public readonly name: string;
  public readonly id: string;
  public readonly componentSet: ReadonlySet<TComponent>;

  public constructor(
    public readonly node: Node,
    config: TUniqueConstraintConfig<TConnector>,
  ) {
    this.config = isShortConfig(config) ? { components: config } : config;

    this.name = this.config.name ?? this.config.components.join('-');

    this.id = `${node.name}.${this.name}`;

    this.componentSet = new Set(
      this.config.components.map((componentName) =>
        node.getComponent(componentName),
      ),
    );

    assert(
      this.componentSet.size > 0,
      `The "${this.id}" unique constraint expects at least one component`,
    );

    for (const component of this.componentSet) {
      if (component instanceof Leaf && !component.isFilterableWith('eq')) {
        throw new Error(
          `The "${this.id}" unique constraint contains the unsupported component "${component.name}"`,
        );
      }
    }
  }

  public toString(): string {
    return this.id;
  }

  @Memoize()
  public get public(): boolean {
    return [...this.componentSet].every((component) => component.public);
  }

  @Memoize()
  public get immutable(): boolean {
    return [...this.componentSet].every((component) => component.immutable);
  }

  @Memoize()
  public get nullable(): boolean {
    return [...this.componentSet].every((component) => component.nullable);
  }
}
