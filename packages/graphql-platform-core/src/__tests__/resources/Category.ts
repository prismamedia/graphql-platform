import { GraphQLString } from 'graphql';
import slug from 'slug';
import { ManagementKind, ResourceHookKind } from '../..';
import { MyResourceConfig } from '../gp';

const resource: MyResourceConfig = {
  uniques: [['parent', 'slug']],
  fields: {
    title: {
      type: GraphQLString,
      nullable: false,
    },
    slug: {
      type: GraphQLString,
      description: "The category's slug",
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
  relations: {
    parent: {
      to: 'Category',
      unique: 'id',
      inversedBy: 'children',
      nullable: true,
    },
  },
};

export default resource;
