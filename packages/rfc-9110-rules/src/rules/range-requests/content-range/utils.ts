interface ContentRange {
  unit: string;
  start: number;
  end: number;
  size: number | null; // Can be '*' if unknown
}

/**
 * Parses the Content-Range header into a structured object.
 * * Algorithm:
 * 1. Use a regular expression to capture the unit, start, end, and total size.
 * 2. The standard format is: <unit> <start>-<end>/<size> (e.g., "bytes 0-499/1000").
 * 3. Handle cases where the total size is unknown (indicated by '*').
 * 4. Convert the captured string values into numbers for easier processing.
 * * @param headerValue - The raw Content-Range header string
 * @returns A ContentRange object or null if the format is invalid
 */
export function parseContentRange(
  headerValue: string | string[],
): ContentRange[] {
  if (Array.isArray(headerValue)) {
    return headerValue.flatMap(parseContentRange);
  }

  // Regex explanation:
  // ^(\w+) : Captures the unit (usually 'bytes')
  // \s+ : Matches the space
  // (\d+)-(\d+) : Captures start and end digits
  // \/ : Matches the forward slash
  // (\d+|\*) : Captures the total size (digits or '*')
  const regex = /^(\w+)\s+(\d+)-(\d+)\/(\d+|\*)$/;
  const match = headerValue.trim().match(regex);

  if (!match) {
    return [];
  }

  const [_, unit, start, end, size] = match;

  if (!unit || !start || !end || !size) {
    return [];
  }

  return [
    {
      unit: unit,
      start: parseInt(start, 10),
      end: parseInt(end, 10),
      size: size === '*' ? null : parseInt(size, 10),
    },
  ];
}
