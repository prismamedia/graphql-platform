import { GraphQLNonNullDecorator, isPlainObject, Scalar, SuperMap } from '@prismamedia/graphql-platform-utils';
import { GraphQLInputFieldConfigMap, GraphQLInputObjectType } from 'graphql';
import { Memoize } from 'typescript-memoize';
import { Component, ComponentSet, Field, Unique } from '../../resource';
import { UniqueSet } from '../../resource/unique';
import { AbstractInputType } from '../abstract-type';

export type WhereUniqueInputValueComponent = null | Scalar | WhereUniqueInputValue;

export interface WhereUniqueInputValue {
  [componentName: string]: WhereUniqueInputValueComponent;
}

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

  public parseUnique(
    value: unknown,
    unique: Unique,
    relationToUniqueOnly: boolean = false,
  ): WhereUniqueInputValue | undefined {
    if (isPlainObject(value)) {
      const id: WhereUniqueInputValue = {};

      for (const component of unique.componentSet) {
        const componentValue = component.parseValue(value[component.name]);
        if (typeof componentValue !== 'undefined') {
          if (componentValue === null) {
            component.setValue(id, null);
          } else {
            if (component.isField()) {
              component.setValue(id, componentValue);
            } else {
              const relatedNodeId = component
                .getTo()
                .getInputType('WhereUnique')
                .parse(
                  componentValue,
                  new UniqueSet([
                    component.getToUnique(),
                    ...(relationToUniqueOnly ? [] : component.getTo().getUniqueSet()),
                  ]),
                );

              if (relatedNodeId) {
                component.setValue(id, relatedNodeId);
              } else {
                return undefined;
              }
            }
          }
        } else {
          return undefined;
        }
      }

      return id;
    }

    return undefined;
  }

  public assertUnique(value: unknown, unique: Unique, relationToUniqueOnly: boolean = false): WhereUniqueInputValue {
    const uniqueValue = this.parseUnique(value, unique, relationToUniqueOnly);
    if (!uniqueValue) {
      throw new Error(
        `The following "${this.resource}"'s where argument does not contain a valid "${
          unique.name
        }" combination: ${JSON.stringify(value)}`,
      );
    }

    return uniqueValue;
  }

  public parse(value: unknown, uniqueSet: UniqueSet = this.resource.getUniqueSet()): WhereUniqueInputValue | undefined {
    if (isPlainObject(value)) {
      for (const unique of uniqueSet) {
        const uniqueValue = this.parseUnique(value, unique);
        if (uniqueValue) {
          return uniqueValue;
        }
      }
    }

    return undefined;
  }

  public assert(value: unknown, uniqueSet: UniqueSet = this.resource.getUniqueSet()): WhereUniqueInputValue {
    const uniqueValue = this.parse(value, uniqueSet);
    if (!uniqueValue) {
      throw new Error(
        `The following "${
          this.resource
        }"'s where argument does not contain any valid unique combination: ${JSON.stringify(value)}`,
      );
    }

    return uniqueValue;
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
