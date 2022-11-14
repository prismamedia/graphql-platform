import type { Promisable } from 'type-fest';
import type { NodeChange } from '../change.js';

export type NodeChangeSubscriber = (change: NodeChange) => Promisable<void>;
