export function createList(list: string[]): string {
  if (list.length === 0) {
    return '';
  } else if (list.length === 1) {
    return `"${list[0]}"`;
    // length >== 2
  } else {
    const last = list.at(-1) as string;

    return (
      list
        .slice(0, list.length - 1)
        .map((el) => `"${el}"`)
        .join(', ') + ` and "${last}"`
    );
  }
}

export function arrayDifference(as: string[], bs: string[]): string[] {
  return as.filter((a) => !bs.includes(a));
}
