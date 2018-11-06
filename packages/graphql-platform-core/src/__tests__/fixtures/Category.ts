import { FixtureDataMap } from '../../graphql-platform/fixture';

export default {
  category_01: {
    title: 'My root category',
  },
  category_02: {
    title: 'My first category',
    parent: 'category_01',
  },
  category_03: {
    title: 'My second category',
    parent: 'category_01',
  },
  category_04: {
    title: 'My sub-category in my first category',
    parent: 'category_02',
  },
} as FixtureDataMap;
