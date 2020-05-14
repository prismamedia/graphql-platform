import {
  Entries,
  fromEntries,
  GraphQLNonNullDecorator,
  isPlainObject,
  MaybeUndefinedDecorator,
  SuperMap,
} from '@prismamedia/graphql-platform-utils';
import { Memoize } from '@prismamedia/ts-memoize';
import {
  GraphQLBoolean,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
} from 'graphql';
import {
  ComponentSet,
  Field,
  NodeValue,
  SerializedNodeValue,
  Unique,
} from '../../resource';
import {
  NullComponentValueError,
  Relation,
  UndefinedComponentValueError,
} from '../../resource/component';
import { UniqueSet } from '../../resource/unique';
import { AbstractInputType } from '../abstract-type';

// Node's identifier
export type WhereUniqueInputValue = NodeValue;

export type SerializedWhereUniqueInputValue = SerializedNodeValue;

export class WhereUniqueInputType extends AbstractInputType {
  @Memoize()
  public get name() {
    return `${this.resource.name}WhereUniqueInput`;
  }

  @Memoize()
  public get description() {
    return `Identifies exactly one "${this.resource}" node`;
  }

  @Memoize((knownRelation?: Relation, forced: boolean = false) =>
    [knownRelation ? knownRelation.name : '', String(forced)].join('|'),
  )
  public getUniqueCombinationMap(
    knownRelation?: Relation,
    forced: boolean = false,
  ) {
    // Contains all the resource's unique constraints
    const resourceUniqueSet = this.resource.getUniqueSet();

    if (
      knownRelation &&
      !resourceUniqueSet.getComponentSet().has(knownRelation)
    ) {
      throw new Error(
        `The relation "${knownRelation}" is not part of the "${
          this.resource
        }"'s unique constraints: ${resourceUniqueSet.getNames().join(', ')}`,
      );
    }

    const uniqueSet =
      knownRelation && forced === true
        ? resourceUniqueSet.filter(({ componentSet }) =>
            componentSet.has(knownRelation),
          )
        : resourceUniqueSet;

    const componentInUniqueSet =
      knownRelation && forced === true
        ? uniqueSet.getComponentSet().diff(knownRelation)
        : uniqueSet.getComponentSet();

    const uniqueCombinationMap = new SuperMap<string, ComponentSet>();
    for (const unique of uniqueSet) {
      const displayedComponentInUniqueSet = unique.componentSet
        .intersect(componentInUniqueSet)
        .sortByName();
      const displayedComponentInUniqueSetKey = displayedComponentInUniqueSet
        .getNames()
        .join('|');

      if (
        displayedComponentInUniqueSet.size > 0 &&
        !uniqueCombinationMap.has(displayedComponentInUniqueSetKey)
      ) {
        uniqueCombinationMap.set(
          displayedComponentInUniqueSetKey,
          displayedComponentInUniqueSet,
        );
      }
    }

    return uniqueCombinationMap;
  }

  public parseUnique<TStrict extends boolean>(
    value: unknown,
    unique: Unique,
    normalized?: boolean,
    strict?: TStrict,
  ): MaybeUndefinedDecorator<WhereUniqueInputValue, TStrict> {
    const entries: Entries<WhereUniqueInputValue> = [];
    if (
      isPlainObject(value) &&
      [...unique.componentSet].every((component) => {
        const componentValue = value[component.name];
        if (typeof componentValue === 'undefined') {
          if (strict) {
            throw new UndefinedComponentValueError(component);
          } else {
            return false;
          }
        } else if (componentValue === null) {
          if (!component.isNullable()) {
            if (strict) {
              throw new NullComponentValueError(component);
            } else {
              return false;
            }
          }

          entries.push([component.name, null]);

          return true;
        }

        if (component.isField()) {
          entries.push([component.name, component.assertValue(componentValue)]);

          return true;
        } else {
          const relatedNodeId = normalized
            ? component
                .getTo()
                .getInputType('WhereUnique')
                .parseUnique(
                  componentValue,
                  component.getToUnique(),
                  true,
                  false,
                )
            : component
                .getTo()
                .getInputType('WhereUnique')
                .parse(componentValue, component.getToUniqueSet(), false);

          if (relatedNodeId) {
            entries.push([component.name, relatedNodeId]);

            return true;
          } else {
            if (strict) {
              throw new UndefinedComponentValueError(component);
            } else {
              return false;
            }
          }
        }
      })
    ) {
      return fromEntries(entries) as any;
    }

    if (strict) {
      throw new Error(
        `The following "${
          this.resource
        }"'s identifier does not contain any valid "${
          unique.name
        }" combination: ${JSON.stringify(value)}`,
      );
    }

    return undefined as any;
  }

  public assertUnique(
    value: unknown,
    unique: Unique,
    normalized?: boolean,
  ): WhereUniqueInputValue {
    return this.parseUnique(value, unique, normalized, true);
  }

  public parse<TStrict extends boolean>(
    value: unknown,
    uniqueSet: UniqueSet = this.resource.getUniqueSet(),
    strict?: TStrict,
  ): MaybeUndefinedDecorator<WhereUniqueInputValue, TStrict> {
    for (const unique of uniqueSet) {
      const id = this.parseUnique(value, unique, false, false);
      if (id) {
        return id as any;
      }
    }

    if (strict) {
      throw new Error(
        `The following "${
          this.resource
        }"'s identifier does not contain any valid unique combination: ${JSON.stringify(
          value,
        )}`,
      );
    }

    return undefined as any;
  }

  public assert(
    value: unknown,
    uniqueSet: UniqueSet = this.resource.getUniqueSet(),
  ): WhereUniqueInputValue {
    return this.parse(value, uniqueSet, true);
  }

  @Memoize((knownRelation?: Relation, forced: boolean = true) =>
    [knownRelation ? knownRelation.name : '', String(forced)].join('|'),
  )
  public getGraphQLType(knownRelation?: Relation, forced: boolean = true) {
    const uniqueCombinationMap = this.getUniqueCombinationMap(
      knownRelation,
      forced,
    );
    const displayedComponentSet = new ComponentSet().concat(
      ...[...uniqueCombinationMap.values()],
    );

    return displayedComponentSet.size > 0
      ? new GraphQLInputObjectType({
          name: [
            this.resource.name,
            knownRelation
              ? `With${forced ? 'Forced' : 'Optional'}${
                  knownRelation.pascalCasedName
                }`
              : null,
            'WhereUniqueInput',
          ]
            .filter(Boolean)
            .join(''),
          description: `${
            knownRelation
              ? `Given a ${forced ? 'forced' : 'known'} "${
                  knownRelation.name
                }", i`
              : 'I'
          }dentifies exactly one "${this.resource.name}" node${
            uniqueCombinationMap.size > 1
              ? ` with one of these unique ${
                  uniqueCombinationMap.some(
                    ([, componentSet]) => componentSet.size > 1,
                  )
                    ? 'combinations of values'
                    : 'values'
                }:\n${[...uniqueCombinationMap.values()]
                  .map(
                    (componentSet) =>
                      `- ${[...componentSet]
                        .map(
                          (component) =>
                            `${component.name}${
                              component === knownRelation ? ' (optional)' : ''
                            }`,
                        )
                        .join(', ')}`,
                  )
                  .join('\n')}`
              : '.'
          }`,
          fields: () => {
            const fields: GraphQLInputFieldConfigMap = {};

            for (const component of displayedComponentSet) {
              fields[component.name] = {
                type: GraphQLNonNullDecorator(
                  component instanceof Field
                    ? component.getType()
                    : component
                        .getTo()
                        .getInputType('WhereUnique')
                        .getGraphQLType(),
                  uniqueCombinationMap.every(
                    ([, componentSet]) =>
                      componentSet.has(component) &&
                      component !== knownRelation,
                  ),
                ),
              };
            }

            return fields;
          },
        })
      : GraphQLBoolean;
  }
}
