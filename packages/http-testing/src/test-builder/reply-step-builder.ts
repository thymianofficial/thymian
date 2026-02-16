import {
  type Constant,
  type HttpRequestTemplate,
  type HttpResponse,
  type RequestFilterExpression,
  type ResponseFilterExpression,
} from '@thymian/core';

import type { SingleHttpTestCaseStep } from '../http-test/index.js';
import {
  overrideRequestWithPrevious,
  runRequests,
} from '../operators/index.js';
import type { BuilderPipeline } from './builder-pipeline.js';
import { extractValueFromResponse } from './extract-value-from-response.js';
import { overrideTemplate } from './override-request-template.js';
import type { RunOptions } from './single-step-test-builder.js';

export class ReplyStepBuilder {
  protected readonly pipeline: BuilderPipeline = [];

  set(
    toRequest: RequestFilterExpression,
    fromResponse:
      | ResponseFilterExpression
      | Constant
      | ((response: HttpResponse) => unknown),
  ): ReplyStepBuilder {
    const operator = overrideRequestWithPrevious(
      (requestTemplate, previous) => {
        const response = previous.transactions[0]?.response;

        if (response) {
          let extractedValue!: unknown;

          if (typeof fromResponse === 'function') {
            extractedValue = fromResponse(response);
          } else if (fromResponse.type === 'constant') {
            extractedValue = fromResponse.value;
          } else {
            extractedValue = extractValueFromResponse(response, fromResponse);
          }

          if (extractedValue) {
            return overrideTemplate(requestTemplate, toRequest, extractedValue);
          }

          return requestTemplate;
        }

        throw new Error('No response found to override template.');
      },
    );

    this.pipeline.push(operator);

    return this;
  }

  run(options: RunOptions = {}): ReplyStepBuilder {
    this.pipeline.push(runRequests(options));

    return this;
  }

  done(): BuilderPipeline {
    return this.pipeline;
  }
}
