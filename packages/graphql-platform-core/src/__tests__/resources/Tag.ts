import { GraphQLString } from 'graphql';
import slug from 'slug';
import { ManagementKind, ResourceConfig, ResourceHookKind } from '../..';

const resource: ResourceConfig = {
  immutable: true,
  uniques: ['slug'],
  fields: {
    title: {
      type: GraphQLString,
      nullable: false,
    },
    slug: {
      type: GraphQLString,
      description: "The tag's slug",
      nullable: false,
      immutable: true,
      managed: ManagementKind.Optional,
      hooks: {
        [ResourceHookKind.PreCreate]: event => {
          if (event.fieldValue == null) {
            const title = event.metas.create.title;

            event.fieldValue = typeof title === 'string' ? slug(title, { lower: true }) : null;
          }
        },
      },
    },
  },
};

export default resource;
