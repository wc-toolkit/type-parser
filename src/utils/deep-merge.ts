/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: unknown) {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Merges the content of two objects
 * @param target object being merged into
 * @param sources data to merge into the target
 * @returns object
 */
export function deepMerge<T = object>(target: unknown, source: unknown): T {
  if (typeof target !== "object" || target === null) {
    return source as T;
  }

  if (typeof source !== "object" || source === null) {
    return target as T;
  }

  const targetObj = target as Record<string, unknown>;
  const sourceObj = source as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    if (sourceObj[key] instanceof Array) {
      if (!targetObj[key]) {
        targetObj[key] = [];
      }
      targetObj[key] = (targetObj[key] as []).concat(sourceObj[key] as []);
    } else if (sourceObj[key] instanceof Object) {
      if (!targetObj[key]) {
        targetObj[key] = {};
      }
      targetObj[key] = deepMerge(targetObj[key], sourceObj[key]);
    } else {
      targetObj[key] = sourceObj[key];
    }
  }

  return targetObj as T;
}
