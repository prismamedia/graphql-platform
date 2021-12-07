import { DepGraph } from 'dependency-graph';
import { Resource, ResourceConfig } from '../resource';

export class ResourceGraph<
  TConfig extends ResourceConfig = ResourceConfig,
> extends DepGraph<Resource<TConfig>> {}
