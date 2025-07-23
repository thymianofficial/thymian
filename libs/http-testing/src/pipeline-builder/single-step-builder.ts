// import {
//   header,
//   method,
//   type HttpRequestFilterFn,
//   requestFiltersToOperator,
//   type HttpResponseFilterFn,
//   responseFiltersToOperator,
//   responseWith,
//   statusCode,
// } from '../http-filters.js';
// import { type Pipeline, PipelineBuilder } from './pipeline-builder.js';
// import { RequestFilter } from './request-filter.js';
// import { ResponseFilter } from './response-filter.js';
//
// export class SingleStepBuilder extends PipelineBuilder {
//   #mapped: boolean = false;
//
//   forRequestsWith(...filters: HttpRequestFilterFn[]): SingleStepBuilder {
//     this.pipeline.push(requestFiltersToOperator(filters));
//
//     return this;
//   }
//
//   forResponsesWith(...filters: HttpResponseFilterFn[]): SingleStepBuilder {
//     this.pipeline.push(responseFiltersToOperator(filters));
//
//     return this;
//   }
// }
//
// new SingleStepBuilder()
//   .forRequestsWith(
//     method('get'),
//     header('if-range'),
//     responseWith(statusCode(200)),
//     responseWith(statusCode(206))
//   )
//   .forResponsesWith(statusCode(206));
//
// // .filterRequests((requests) =>
// //   requests.withMethod('get', 'header').withHeader('Authorization')
// // )
// // .filterResponses((responses) => responses.withStatusCode(201));
