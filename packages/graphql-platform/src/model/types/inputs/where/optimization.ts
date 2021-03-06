import { isEqual, uniqWith } from 'lodash';
import { Model } from '../../../../model';
import { Reference } from '../../../components';
import { UniqueConstraint } from '../../../unique-constraint';
import {
  EdgeFilterValue,
  FilterValue,
  LeafFilterValue,
  LogicalFilterValue,
  ReverseEdgeFilterValue,
} from './ast';

/**
 * Uses the boolean algebra's monotone laws to optimize the AST
 * @see https://en.wikipedia.org/wiki/Boolean_algebra#Monotone_laws
 */
function optimizeAndLogicalFilterValue(
  filterValue: Extract<LogicalFilterValue, { operator: 'and' }>,
  node: Model,
): FilterValue {
  let optimized = false;

  // Optimize recursively
  let optimizedFilters = filterValue.value.map((filterValue) => {
    const optimizedFilter = optimizeFilterValue(filterValue, node);
    if (optimizedFilter !== filterValue) {
      optimized = true;
    }

    return optimizedFilter;
  });

  // Idempotence: A AND A = A
  optimizedFilters = uniqWith(optimizedFilters, isEqual);

  // Identity: A AND 1 = A
  optimizedFilters = optimizedFilters.filter(
    (value) => !(value.kind === 'Boolean' && value.value === true),
  );

  // Has it been optimized ?
  if (optimizedFilters.length !== filterValue.value.length) {
    optimized = true;
  }

  // An empty "{}" = "{ AND: [] }" = true
  if (optimizedFilters.length === 0) {
    return {
      kind: 'Boolean',
      value: true,
    };
  } else if (optimizedFilters.length === 1) {
    return optimizedFilters[0];
  }

  // Annihilator: A AND 0 = 0
  if (
    optimizedFilters.find(
      (value) => value.kind === 'Boolean' && value.value === false,
    )
  ) {
    return {
      kind: 'Boolean',
      value: false,
    };
  }

  // Associativity: A AND (B AND C) = A AND B AND C
  optimizedFilters = optimizedFilters.reduce(
    (optimizedFilters: FilterValue[], filterValue) => {
      if (filterValue.kind === 'Logical' && filterValue.operator === 'and') {
        optimizedFilters.push(...filterValue.value);

        optimized = true;
      } else {
        optimizedFilters.push(filterValue);
      }

      return optimizedFilters;
    },
    [],
  );

  return optimized
    ? optimizeAndLogicalFilterValue(
        {
          kind: 'Logical',
          operator: 'and',
          value: optimizedFilters,
        },
        node,
      )
    : filterValue;
}

/**
 * Uses the boolean algebra's monotone laws to optimize the AST
 * @see https://en.wikipedia.org/wiki/Boolean_algebra#Monotone_laws
 */
function optimizeOrLogicalFilterValue(
  filterValue: Extract<LogicalFilterValue, { operator: 'or' }>,
  node: Model,
): FilterValue {
  let optimized = false;

  // Optimize recursively
  let optimizedFilters = filterValue.value.map((filterValue) => {
    const optimizedFilter = optimizeFilterValue(filterValue, node);
    if (optimizedFilter !== filterValue) {
      optimized = true;
    }

    return optimizedFilter;
  });

  // Idempotence: A OR A = A
  optimizedFilters = uniqWith(optimizedFilters, isEqual);

  // Identity: A OR 0 = A
  optimizedFilters = optimizedFilters.filter(
    (value) => !(value.kind === 'Boolean' && value.value === false),
  );

  // Has it been optimized ?
  if (optimizedFilters.length !== filterValue.value.length) {
    optimized = true;
  }

  // An empty "{ OR: [] }" = false
  if (optimizedFilters.length === 0) {
    return {
      kind: 'Boolean',
      value: false,
    };
  } else if (optimizedFilters.length === 1) {
    return optimizedFilters[0];
  }

  // Annihilator: A OR 1 = 1
  if (
    optimizedFilters.find(
      (value) => value.kind === 'Boolean' && value.value === true,
    )
  ) {
    return {
      kind: 'Boolean',
      value: true,
    };
  }

  // Associativity: A OR (B OR C) = A OR B OR C
  optimizedFilters = optimizedFilters.reduce(
    (optimizedFilters: FilterValue[], filterValue) => {
      if (filterValue.kind === 'Logical' && filterValue.operator === 'or') {
        optimizedFilters.push(...filterValue.value);

        optimized = true;
      } else {
        optimizedFilters.push(filterValue);
      }

      return optimizedFilters;
    },
    [],
  );

  return optimized
    ? optimizeOrLogicalFilterValue(
        {
          kind: 'Logical',
          operator: 'or',
          value: optimizedFilters,
        },
        node,
      )
    : filterValue;
}

/**
 * Uses the boolean algebra's monotone laws to optimize the AST
 * @see https://en.wikipedia.org/wiki/Boolean_algebra#Monotone_laws
 */
function optimizeNotLogicalFilterValue(
  value: Extract<LogicalFilterValue, { operator: 'not' }>,
  node: Model,
): FilterValue {
  let optimized = false;

  // Optimize recursively
  const optimizedFilterValue = optimizeFilterValue(value.value, node);
  if (optimizedFilterValue !== value.value) {
    optimized = true;
  }

  if (
    // Double negation: NOT (NOT A) = A
    optimizedFilterValue.kind === 'Logical' &&
    optimizedFilterValue.operator === 'not'
  ) {
    return optimizedFilterValue.value;
  } else if (
    // Boolean negation: (NOT 0) = 1 / (NOT 1) = 0
    optimizedFilterValue.kind === 'Boolean'
  ) {
    return {
      kind: 'Boolean',
      value: !optimizedFilterValue.value,
    };
  }

  return optimized
    ? optimizeNotLogicalFilterValue(
        {
          kind: 'Logical',
          operator: 'not',
          value: optimizedFilterValue,
        },
        node,
      )
    : value;
}

/**
 * Uses the boolean algebra's monotone laws to optimize the AST
 * @see https://en.wikipedia.org/wiki/Boolean_algebra#Monotone_laws
 */
function optimizeLogicalFilterValue(
  value: LogicalFilterValue,
  node: Model,
): FilterValue {
  switch (value.operator) {
    case 'and':
      return optimizeAndLogicalFilterValue(value, node);

    case 'or':
      return optimizeOrLogicalFilterValue(value, node);

    case 'not':
      return optimizeNotLogicalFilterValue(value, node);
  }

  return value;
}

function optimizeLeafFilterValue(
  value: LeafFilterValue,
  node: Model,
): FilterValue {
  // Will throw an error if it does not exist
  node.getLeaf(value.leaf);

  switch (value.operator) {
    case 'in': {
      const optimizedValues = uniqWith(value.value, isEqual);

      if (optimizedValues.length === 0) {
        return {
          kind: 'Boolean',
          value: false,
        };
      } else if (optimizedValues.length === 1) {
        return {
          kind: 'Leaf',
          leaf: value.leaf,
          operator: 'eq',
          value: optimizedValues[0],
        };
      } else if (optimizedValues.length !== value.value.length) {
        return {
          ...value,
          value: optimizedValues,
        };
      }
      break;
    }

    case 'not_in': {
      const optimizedValues = uniqWith(value.value, isEqual);

      if (optimizedValues.length === 0) {
        return {
          kind: 'Boolean',
          value: true,
        };
      } else if (optimizedValues.length === 1) {
        return {
          kind: 'Leaf',
          leaf: value.leaf,
          operator: 'not',
          value: optimizedValues[0],
        };
      } else if (optimizedValues.length !== value.value.length) {
        return {
          ...value,
          value: optimizedValues,
        };
      }
      break;
    }
  }

  return value;
}

function isFilterValueInReference(
  filterValue: FilterValue,
  reference: UniqueConstraint<any>,
): boolean {
  const referencedNode = reference.model;

  switch (filterValue.kind) {
    case 'Boolean':
      return true;

    case 'Logical':
      return filterValue.operator === 'and' || filterValue.operator === 'or'
        ? [...filterValue.value].every((filterValue) =>
            isFilterValueInReference(filterValue, reference),
          )
        : isFilterValueInReference(filterValue.value, reference);

    case 'Leaf':
      return reference.componentSet.has(
        referencedNode.getLeaf(filterValue.leaf),
      );

    case 'Edge':
      const edge = referencedNode.getReference(filterValue.edge);

      return (
        reference.componentSet.has(edge) &&
        isReferenceFilterValue(filterValue, edge)
      );

    default:
      return false;
  }
}

/**
 * Returns true if the filter is only against values contained in the reference
 */
export function isReferenceFilterValue(
  edgeFilterValue: EdgeFilterValue,
  edge: Reference<any>,
): boolean {
  return isFilterValueInReference(edgeFilterValue.value, edge.headReference);
}

function optimizeEdgeFilterValue(
  value: EdgeFilterValue,
  node: Model,
): FilterValue {
  const edge = node.getReference(value.edge);

  let optimized = false;

  const optimizedFilterValue = optimizeFilterValue(value.value, edge.head);
  if (optimizedFilterValue !== value.value) {
    optimized = true;
  }

  if (optimizedFilterValue.kind === 'Boolean' && !edge.nullable) {
    return {
      kind: 'Boolean',
      value: optimizedFilterValue.value,
    };
  }

  return optimized
    ? {
        ...value,
        value: optimizedFilterValue,
      }
    : value;
}

function optimizeUniqueReverseEdgeFilterValue(
  value: Extract<ReverseEdgeFilterValue, { operator: 'eq' | 'not' }>,
  node: Model,
): FilterValue {
  const optimizedFilterValue = optimizeFilterValue(value.value, node);
  if (optimizedFilterValue !== value.value) {
    return {
      ...value,
      value: optimizedFilterValue,
    };
  }

  return value;
}

function optimizeNonUniqueReverseEdgeFilterValue(
  value: Extract<
    ReverseEdgeFilterValue,
    { operator: 'none' | 'some' | 'every' }
  >,
  node: Model,
): FilterValue {
  const optimizedFilterValue = optimizeFilterValue(value.value, node);
  if (optimizedFilterValue !== value.value) {
    return {
      ...value,
      value: optimizedFilterValue,
    };
  }

  return value;
}

export function optimizeFilterValue(
  value: FilterValue,
  node: Model,
): FilterValue {
  switch (value.kind) {
    case 'Logical':
      return optimizeLogicalFilterValue(value, node);

    case 'Leaf':
      return optimizeLeafFilterValue(value, node);

    case 'Edge':
      return optimizeEdgeFilterValue(value, node);

    case 'ReverseEdge':
      return value.operator === 'eq' || value.operator === 'not'
        ? optimizeUniqueReverseEdgeFilterValue(value, node)
        : optimizeNonUniqueReverseEdgeFilterValue(value, node);
  }

  return value;
}
