import { Operation } from '../operation';
import { ResourceError } from '../resource/error';
import { WhereUniqueInputValue } from '../type/input';

export class OperationError extends ResourceError {
  constructor(readonly operation: Operation, cause?: string) {
    super(
      operation.resource,
      `An error occurred during the "${operation}" operation${
        cause ? `, ${cause}` : ''
      }.`,
    );
  }
}

export class NodeNotFoundError extends OperationError {
  constructor(readonly operation: Operation, id: WhereUniqueInputValue) {
    super(
      operation,
      `the following node does not exist: ${JSON.stringify(id)}`,
    );
  }
}
