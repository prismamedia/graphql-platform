import type { Edge, Node, ReverseEdge } from '../../node.js';

export type DependencyPath = readonly [Node, ...Array<Edge | ReverseEdge>];

export const printDependencyPath = (path: DependencyPath): string =>
  `/${path.map(({ name }) => name).join('/')}`;

export const areDependencyPathsEqual = (
  a: DependencyPath,
  b: DependencyPath,
): boolean => {
  return a.length === b.length && a.every((value, index) => value === b[index]);
};
