import * as scalars from '@prismamedia/graphql-platform-scalars';
import * as utils from '@prismamedia/graphql-platform-utils';
import type { MutationContextChanges } from '../../mutation.js';
import type { ChangesSubscriptionStream } from './stream.js';

export const changesSubscriptionCacheControlInputType =
  new utils.ObjectInputType({
    name: 'ChangesSubscriptionCacheControl',
    description: `In the context of a changes-subscription, identified by its "id": won't return documents processed after the "ifModifiedSince" date.`,
    fields: [
      new utils.Input({
        name: 'id',
        type: utils.nonNillableInputType(scalars.GraphQLUUIDv4),
      }),
      new utils.Input({
        name: 'ifModifiedSince',
        type: utils.nonNillableInputType(scalars.GraphQLDateTime),
      }),
      new utils.Input({
        name: 'maxAge',
        description: `The "maxAge=N" directive indicates that the document remains fresh until N seconds after it has been generated.`,
        type: new utils.NonNullableInputType(scalars.GraphQLUnsignedInt),
      }),
    ],
  });

export interface ChangesSubscriptionCacheControlInputValue {
  id: ChangesSubscriptionStream['id'];
  ifModifiedSince: NonNullable<MutationContextChanges['committedAt']>;
  maxAge?: number;
}
