import * as utils from '@prismamedia/graphql-platform-utils';
import type { Node, UniqueConstraint } from '../../../node.js';
import { AbstractOperationError } from '../abstract-error.js';
import {
  ConnectorOperationError,
  type ConnectorOperationKind,
} from '../error.js';

export enum LifecycleHookKind {
  PRE_CREATE,
  POST_CREATE,
  PRE_UPDATE,
  POST_UPDATE,
  PRE_DELETE,
  POST_DELETE,
}

export class LifecycleHookError extends AbstractOperationError {
  public readonly code = 'LIFECYCLE_HOOK_ERROR';

  public constructor(
    node: Node,
    kind: LifecycleHookKind,
    options?: utils.GraphErrorOptions,
  ) {
    super(`Failed at "${node}.${LifecycleHookKind[kind]}"`, options);
  }
}

export interface DuplicateErrorOptions extends utils.GraphErrorOptions {
  readonly uniqueConstraint?: UniqueConstraint;
  readonly hint?: string;
}

export class DuplicateError extends ConnectorOperationError {
  public override readonly code = 'DUPLICATE';

  public constructor(
    node: Node,
    kind: ConnectorOperationKind.CREATE | ConnectorOperationKind.UPDATE,
    options?: DuplicateErrorOptions,
  ) {
    super(node, kind, {
      ...options,
      cause: new Error(
        [
          'duplicate',
          options?.uniqueConstraint && `"${options?.uniqueConstraint.name}"`,
          options?.hint && `(${options.hint})`,
        ]
          .filter(Boolean)
          .join(' '),
        { cause: options?.cause },
      ),
    });
  }
}
