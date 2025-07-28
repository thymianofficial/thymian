import { getHeader, type HttpResponse, setHeader } from '@thymian/core';
import {
  type Constant,
  type RequestFilterExpression,
  type ResponseFilterExpression,
} from '@thymian/http-filter';

import {
  overrideRequestWithPrevious,
  runRequests,
} from '../operators/index.js';
import type { BuilderPipeline } from './builder-pipeline.js';
import type { RunOptions } from './single-step-test-builder.js';
import { overrideTemplate } from './override-request-template.js';
import { extractValueFromResponse } from './extract-value-from-response.js';

export class ReplyStepBuilder {
  protected readonly pipeline: BuilderPipeline = [];

  set(
    toRequest: RequestFilterExpression,
    fromResponse: ResponseFilterExpression | Constant
  ): ReplyStepBuilder {
    const operator = overrideRequestWithPrevious(
      (requestTemplate, previous) => {
        const response = previous.transactions[0]?.response;

        if (response) {
          const extractedValue =
            fromResponse.type === 'constant'
              ? fromResponse.value
              : extractValueFromResponse(response, fromResponse);

          if (extractedValue) {
            return overrideTemplate(requestTemplate, toRequest, extractedValue);
          }

          return requestTemplate;
        }

        throw new Error('No response found to override template.');
      }
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
