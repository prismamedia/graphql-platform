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
    try {
      const data = await gp.execute(request);

      expect(data).toEqual(result);
    } catch (error) {
      console.debug({
        source: request.source,
        variableValues: request.variableValues,
      });

      throw error;
    }
  }
}
