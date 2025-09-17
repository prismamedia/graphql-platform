import type { Entry, Writable } from 'type-fest';
import type { Component, Edge, Leaf, ReverseEdge } from '../definition.js';
import type { NodeDependencyTree } from '../dependency.js';
import type { NodeFilter, NodeOrdering, NodeSelection } from '../statement.js';

export type RawDependency =
  | Component
  | {
      kind: 'Leaf';
      leaf: Leaf;
    }
  | {
      kind: 'Edge';
      edge: Edge;
      head?: {
        filter?: NodeFilter;
        selection?: NodeSelection;
      };
    }
  | {
      kind: 'ReverseEdge';
      reverseEdge: ReverseEdge;
      head?: {
        filter?: NodeFilter;
        ordering?: NodeOrdering;
        selection?: NodeSelection;
      };
    }
  | Entry<Writable<NodeDependencyTree['dependencies']>>;
