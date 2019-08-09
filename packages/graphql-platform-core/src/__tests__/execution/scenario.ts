import { POJO } from '@prismamedia/graphql-platform-utils';
import { GraphQLExecutor, GraphQLRequest } from '../../graphql-platform';
import { scenario as mutations } from './scenario/mutations';
import { scenario as queries } from './scenario/queries';

export { scenario as mutations } from './scenario/mutations';
export { scenario as queries } from './scenario/queries';

export type ScenarioTest = [GraphQLRequest, POJO];

export type Scenario = ScenarioTest[];

export const scenario: Scenario = [...queries, ...mutations];

export async function play(gp: GraphQLExecutor, scenario: Scenario) {
  for (const [request, result] of scenario) {
    const { data, errors } = await gp.execute(request);

    if (errors) {
      console.debug({
        source: request.source,
        ...(request.variableValues ? { variables: request.variableValues } : {}),
      });

      const error = errors[0];
      throw error.originalError || error;
    }

    expect(data).toEqual(result);
  }
}
