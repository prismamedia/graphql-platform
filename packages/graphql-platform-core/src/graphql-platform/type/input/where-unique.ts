import {
  GraphQLNonNullDecorator,
  isPlainObject,
  MaybeUndefinedDecorator,
  SuperMap,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLBoolean, GraphQLInputFieldConfigMap, GraphQLInputObjectType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { ComponentSet, Field, Unique } from '../../resource';
import { FieldValue, Relation } from '../../resource/component';
import { UniqueSet } from '../../resource/unique';
import { AbstractInputType } from '../abstract-type';

// Node's identifier
export type WhereUniqueInputValue = {
  [componentName: string]: FieldValue | (null | WhereUniqueInputValue);
};

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
  public getUniqueCombinationMap(knownRelation?: Relation, forced: boolean = false) {
    // Contains all the resource's unique constraints
    const resourceUniqueSet = this.resource.getUniqueSet();

    if (knownRelation && !resourceUniqueSet.getComponentSet().has(knownRelation)) {
      throw new Error(
        `The relation "${knownRelation}" is not part of the "${
          this.resource
        }"'s unique constraints: ${resourceUniqueSet.getNames().join(', ')}`,
      );
    }

    const uniqueSet =
      knownRelation && forced === true
        ? resourceUniqueSet.filter(({ componentSet }) => componentSet.has(knownRelation))
        : resourceUniqueSet;

    const componentInUniqueSet =
      knownRelation && forced === true ? uniqueSet.getComponentSet().diff(knownRelation) : uniqueSet.getComponentSet();

    const uniqueCombinationMap = new SuperMap<string, ComponentSet>();
    for (const unique of uniqueSet) {
      const displayedComponentInUniqueSet = unique.componentSet.intersect(componentInUniqueSet).sortByName();
      const displayedComponentInUniqueSetKey = displayedComponentInUniqueSet.getNames().join('|');

      if (displayedComponentInUniqueSet.size > 0 && !uniqueCombinationMap.has(displayedComponentInUniqueSetKey)) {
        uniqueCombinationMap.set(displayedComponentInUniqueSetKey, displayedComponentInUniqueSet);
      }
    }

    return uniqueCombinationMap;
  }

  public parseUnique<TStrict extends boolean>(
    value: unknown,
    unique: Unique,
    strict: TStrict,
    // Accept only the defined unique
    relationToUniqueOnly: boolean = false,
  ): MaybeUndefinedDecorator<WhereUniqueInputValue, TStrict> {
    const id: WhereUniqueInputValue = Object.create(null);

    if (
      isPlainObject(value) &&
      unique.componentSet.every(component => {
        if (component.isField()) {
          // Field
          const componentValue = component.getValue(value, false);
          if (typeof componentValue === 'undefined') {
            return false;
          }

          component.setValue(id, componentValue);
        } else {
          // Relation
          const relatedNodeId = component.getId(value, false, relationToUniqueOnly);
          if (typeof relatedNodeId === 'undefined') {
            return false;
          }

          component.setValue(id, relatedNodeId);
        }

        return true;
      })
    ) {
      return id as any;
    }

    if (strict) {
      throw new Error(
        `The following "${this.resource}"'s identifier does not contain a valid "${
          unique.name
        }" combination: ${JSON.stringify(value)}`,
      );
    }

    return undefined as any;
  }

  public parse<TStrict extends boolean>(
    value: unknown,
    strict: TStrict,
    uniqueSet: UniqueSet = this.resource.getUniqueSet(),
  ): MaybeUndefinedDecorator<WhereUniqueInputValue, TStrict> {
    let id: WhereUniqueInputValue | undefined;

    if (isPlainObject(value) && uniqueSet.some(unique => !!(id = this.parseUnique(value, unique, false)))) {
      return id as any;
    }

    if (strict) {
      throw new Error(
        `The following "${this.resource}"'s identifier does not contain any valid unique combination: ${JSON.stringify(
          value,
        )}`,
      );
    }

    return undefined as any;
  }

  @Memoize((knownRelation?: Relation, forced: boolean = true) =>
    [knownRelation ? knownRelation.name : '', String(forced)].join('|'),
  )
  public getGraphQLType(knownRelation?: Relation, forced: boolean = true) {
    const uniqueCombinationMap = this.getUniqueCombinationMap(knownRelation, forced);
    const displayedComponentSet = new ComponentSet().concat(...[...uniqueCombinationMap.values()]);

    return displayedComponentSet.size > 0
      ? new GraphQLInputObjectType({
          name: [
            this.resource.name,
            knownRelation ? `With${forced ? 'Forced' : 'Optional'}${knownRelation.pascalCasedName}` : null,
            'WhereUniqueInput',
          ]
            .filter(Boolean)
            .join(''),
          description: `${
            knownRelation ? `Given a ${forced ? 'forced' : 'known'} "${knownRelation.name}", i` : 'I'
          }dentifies exactly one "${this.resource.name}" node${
            uniqueCombinationMap.size > 1
              ? ` with one of these unique ${
                  uniqueCombinationMap.some(([, componentSet]) => componentSet.size > 1)
                    ? 'combinations of values'
                    : 'values'
                }:\n${[...uniqueCombinationMap.values()]
                  .map(
                    componentSet =>
                      `- ${[...componentSet]
                        .map(component => `${component.name}${component === knownRelation ? ' (optional)' : ''}`)
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
                    ([, componentSet]) => componentSet.has(component) && component !== knownRelation,
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
