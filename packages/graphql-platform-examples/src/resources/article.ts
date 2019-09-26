import { TResourceConfig } from '@prismamedia/graphql-platform';

export const config: TResourceConfig = {
  uniques: [['_id'], ['id'], ['slug']],
  components: {
    _id: {
      type: 'Int',
      nullable: false,
      immutable: true,
      public: false,
    },
    id: {
      type: 'UUID',
      nullable: false,
      immutable: true,
    },
    title: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
    slug: {
      type: 'NonEmptyTrimmedString',
      nullable: false,
    },
  },
};
