import {
  defaultIfEmpty,
  EMPTY,
  filter,
  type GroupedObservable,
  mergeMap,
  of,
  type OperatorFunction,
  toArray,
} from 'rxjs';

export function filterGroup<Key, Group>(
  fn: (element: Group[]) => boolean
): OperatorFunction<
  GroupedObservable<Key, Group>,
  GroupedObservable<Key, Group>
> {
  return mergeMap((group$) =>
    group$.pipe(
      toArray(),
      filter(fn),
      defaultIfEmpty(null),
      mergeMap((result) => {
        if (result === null) return EMPTY;
        return of(group$);
      })
    )
  );
}
