/**
 * Returns a new Map with its entries sorted by the provided "compareFn"
 */
export function sortMap<K, V>(
  map: Map<K, V>,
  compareFn: (a: [K, V], b: [K, V]) => number,
): Map<K, V> {
  return new Map([...map].sort(compareFn));
}

export function sortMapByKeys<K, V>(
  map: Map<K, V>,
  compareFn: (a: K, b: K) => number,
): Map<K, V> {
  return sortMap(map, ([a], [b]) => compareFn(a, b));
}

/**
 * Returns a new Map with its entries sorted in the provided keys' order
 */
export function sortMapByOrderedKeys<K, V>(
  map: Map<K, V>,
  orderedKeys: ReadonlyArray<K>,
): Map<K, V> {
  return sortMapByKeys(
    map,
    (a, b) => orderedKeys.indexOf(a) - orderedKeys.indexOf(b),
  );
}
