const REF_KEY = '$thymian-ref';

export function resolveCircularReferences<T>(obj: T): T {
  const activeStack = new Map();
  const REF_KEY = '$thymian-ref';

  function recurse(current: any, path: string): any {
    if (typeof current !== 'object' || current === null) {
      return current;
    }

    if (activeStack.has(current)) {
      return { [REF_KEY]: activeStack.get(current) };
    }

    activeStack.set(current, path);

    let result: Record<string, unknown> | Array<unknown>;
    if (Array.isArray(current)) {
      result = current.map((item, index) => recurse(item, `${path}/${index}`));
    } else {
      result = {};
      for (const [key, value] of Object.entries(current)) {
        result[key] = recurse(value, `${path}/${key}`);
      }
    }

    activeStack.delete(current);

    return result;
  }

  return recurse(obj, '#');
}

export function resolveThymianPointers<T>(root: T): T {
  const index = new Map();

  function buildIndex(current: any, path: string): any {
    if (current === null || typeof current !== 'object') {
      return;
    }

    index.set(path, current);

    if (Array.isArray(current)) {
      current.forEach((item, i) => buildIndex(item, `${path}/${i}`));
    } else {
      for (const key in current) {
        if (key !== REF_KEY) {
          buildIndex(current[key], `${path}/${key}`);
        }
      }
    }
  }

  function link(current: any): any {
    if (current === null || typeof current !== 'object') {
      return current;
    }

    if (Object.hasOwn(current, REF_KEY)) {
      const targetPath = current[REF_KEY];
      if (!index.has(targetPath)) {
        throw new Error(`Pointer ${targetPath} could not be resolved.`);
      }
      return index.get(targetPath);
    }

    if (Array.isArray(current)) {
      for (let i = 0; i < current.length; i++) {
        current[i] = link(current[i]);
      }
    } else {
      for (const key in current) {
        current[key] = link(current[key]);
      }
    }
    return current;
  }

  buildIndex(root, '#');
  return link(root);
}
