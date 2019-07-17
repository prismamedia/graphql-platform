import {
  GraphQLNonNullDecorator,
  isPlainObject,
  MaybeUndefinedDecorator,
  SuperMap,
} from '@prismamedia/graphql-platform-utils';
import { GraphQLInputFieldConfigMap, GraphQLInputObjectType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { Component, ComponentSet, Field, Unique } from '../../resource';
import { FieldValue } from '../../resource/component';
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

  @Memoize((knownComponent?: Component, forced: boolean = false) =>
    [knownComponent ? knownComponent.name : '', String(forced)].join('|'),
  )
  public getUniqueCombinationMap(knownComponent?: Component, forced: boolean = false) {
    // Contains all the resource's uniques
    const uniqueSet = this.resource.getUniqueSet();

    // Contains all the components of all the resource's uniques
    const componentInUniqueSet = new ComponentSet().concat(...[...uniqueSet].map(unique => unique.componentSet));

    if (knownComponent && !componentInUniqueSet.has(knownComponent)) {
      throw new Error(
        `The component "${knownComponent}" is not part of the "${
          this.resource
        }"'s unique constraints: ${componentInUniqueSet.getNames().join(', ')}`,
      );
    }

    // Contains all the components we have to display
    const displayedComponentSet =
      knownComponent && forced === true ? componentInUniqueSet.diff(knownComponent) : componentInUniqueSet;

    const uniqueCombinationMap = new SuperMap<string, ComponentSet>();
    for (const unique of uniqueSet) {
      const displayedComponentInUniqueSet = unique.componentSet.intersect(displayedComponentSet).sortByName();
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

  @Memoize((knownComponent?: Component, forced: boolean = false) =>
    [knownComponent ? knownComponent.name : '', String(forced)].join('|'),
  )
  public getGraphQLType(knownComponent?: Component, forced: boolean = false) {
    const uniqueCombinationMap = this.getUniqueCombinationMap(knownComponent, forced);
    const displayedComponentSet = new ComponentSet().concat(...[...uniqueCombinationMap.values()]);

    return new GraphQLInputObjectType({
      name: [
        this.resource.name,
        knownComponent ? `With${forced ? 'Forced' : 'Optional'}${knownComponent.pascalCasedName}` : null,
        'WhereUniqueInput',
      ]
        .filter(Boolean)
        .join(''),
      description: `${knownComponent ? `Given a known "${knownComponent.name}", i` : 'I'}dentifies exactly one "${
        this.resource.name
      }" node${
        uniqueCombinationMap.size > 1
          ? ` with one of these unique ${
              uniqueCombinationMap.some(([, componentSet]) => componentSet.size > 1)
                ? 'combinations of values'
                : 'values'
            }:\n${[...uniqueCombinationMap.values()]
              .map(
                componentSet =>
                  `- ${[...componentSet]
                    .map(component => `${component.name}${component === knownComponent ? ' (optional)' : ''}`)
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
                ([, componentSet]) => componentSet.has(component) && component !== knownComponent,
              ),
            ),
          };
        }

        return fields;
      },
    });
  }
}
