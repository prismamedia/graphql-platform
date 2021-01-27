import { print } from 'graphql';
import { Maybe } from 'graphql/jsutils/Maybe';
import { GraphQLPlatform } from '../../..';
import { models, MyGP } from '../../../__tests__/config';

describe('Node selection', () => {
  let gp: MyGP;

  beforeAll(() => {
    gp = new GraphQLPlatform({ models });
  });

  it.each<[modelName: string, fragment: Maybe<string>, error: string]>([
    [
      'Article',
      undefined,
      'An error occurred at "Article" - expects a "RawNodeSelection", got: undefined',
    ],
    [
      'Article',
      null,
      'An error occurred at "Article" - expects a "RawNodeSelection", got: null',
    ],
    [
      'Article',
      `{ unknownField }`,
      'An error occurred at "Article" - the "Article" node does not contain the field "unknownField", did you mean: ',
    ],
    [
      'Article',
      `{ category { unknownDeepField } }`,
      'An error occurred at "Article.category" - the "Category" node does not contain the field "unknownDeepField", did you mean: ',
    ],
    [
      'Article',
      `{ id(first: 5) }`,
      'An error occurred at "Article.id" - expects not to have arguments, got: {"first":5}',
    ],
    [
      'Article',
      `{ id { id } }`,
      'An error occurred at "Article.id" - expects not to have selectionSet, got:',
    ],
  ])('throws an Error on %p.select(%p)', (modelName, maybeFragment, error) => {
    const node = gp.getModel(modelName).nodeType;

    expect(() =>
      // @ts-expect-error
      node.select(maybeFragment),
    ).toThrowError(error);
  });

  it.each<[modelName: string, fragment: string, selection: string]>([
    [
      'Article',
      `{ id }`,
      `{
  id
}`,
    ],
    [
      'Article',
      `... { id }`,
      `{
  id
}`,
    ],
    [
      'Article',
      `... on Article { id }`,
      `{
  id
}`,
    ],
    [
      'Article',
      `fragment MyTestFragment on Article { id }`,
      `{
  id
}`,
    ],
    [
      'Article',
      `{ id lowerCasedTitle category { id _a: hasParent } }`,
      `{
  id
  status
  title
  category {
    title
    id
    hasParent
  }
}`,
    ],
    [
      'User',
      '{ username profile { birthday } ... { profile { facebookId birthday } } }',
      `{
  username
  profile {
    birthday
    facebookId
  }
}`,
    ],
  ])('%p.select(%p) = %p', (modelName, fragment, selectionSet) => {
    const node = gp.getModel(modelName).nodeType;

    expect(print(node.select(fragment).toSelectionSetNode())).toEqual(
      selectionSet,
    );
  });
});
