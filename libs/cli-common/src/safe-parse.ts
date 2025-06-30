export function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (!isNaN(+value) && value.trim() !== '') return Number(value);

    return value;
  }
}
