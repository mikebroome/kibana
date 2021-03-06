/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */
import { get, getOr } from 'lodash/fp';
import { set } from '@elastic/safer-lodash-set/fp';
import { mergeFieldsWithHit } from '../../../../../utils/build_query';
import {
  AuthenticationsEdges,
  AuthenticationHit,
  AuthenticationBucket,
} from '../../../../../../common/search_strategy/security_solution/hosts/authentications';
import { toArray } from '../../../../helpers/to_array';
import {
  FactoryQueryTypes,
  StrategyResponseType,
} from '../../../../../../common/search_strategy/security_solution';

export const authenticationFields = [
  '_id',
  'failures',
  'successes',
  'user.name',
  'lastSuccess.timestamp',
  'lastSuccess.source.ip',
  'lastSuccess.host.id',
  'lastSuccess.host.name',
  'lastFailure.timestamp',
  'lastFailure.source.ip',
  'lastFailure.host.id',
  'lastFailure.host.name',
];

export const formatAuthenticationData = (
  hit: AuthenticationHit,
  fieldMap: Readonly<Record<string, string>>
): AuthenticationsEdges =>
  authenticationFields.reduce<AuthenticationsEdges>(
    (flattenedFields, fieldName) => {
      if (hit.cursor) {
        flattenedFields.cursor.value = hit.cursor;
      }
      flattenedFields.node = {
        ...flattenedFields.node,
        ...{
          _id: hit._id,
          user: { name: [hit.user] },
          failures: hit.failures,
          successes: hit.successes,
        },
      };
      const mergedResult = mergeFieldsWithHit(fieldName, flattenedFields, fieldMap, hit);
      const fieldPath = `node.${fieldName}`;
      const fieldValue = get(fieldPath, mergedResult);

      return set(fieldPath, toArray(fieldValue), mergedResult);
    },
    {
      node: {
        failures: 0,
        successes: 0,
        _id: '',
        user: {
          name: [''],
        },
      },
      cursor: {
        value: '',
        tiebreaker: null,
      },
    }
  );

export const getHits = <T extends FactoryQueryTypes>(response: StrategyResponseType<T>) =>
  getOr([], 'aggregations.group_by_users.buckets', response.rawResponse).map(
    (bucket: AuthenticationBucket) => ({
      _id: getOr(
        `${bucket.key}+${bucket.doc_count}`,
        'failures.lastFailure.hits.hits[0].id',
        bucket
      ),
      _source: {
        lastSuccess: getOr(null, 'successes.lastSuccess.hits.hits[0]._source', bucket),
        lastFailure: getOr(null, 'failures.lastFailure.hits.hits[0]._source', bucket),
      },
      user: bucket.key,
      failures: bucket.failures.doc_count,
      successes: bucket.successes.doc_count,
    })
  );
