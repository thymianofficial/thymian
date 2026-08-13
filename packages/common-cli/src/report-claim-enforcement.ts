import type { Command } from '@oclif/core';
import type { ReportInput } from '@thymian/core';

/**
 * Claim enforcement for `--report` inputs (ADR-0017): a type is supported
 * exactly when >=1 registered plugin claims it, so the supported list is
 * derived from this run's claims. Errors with exit 2 (usage error) when any
 * input went unclaimed; call before any report rendering. Shared by
 * `thymian report convert` and `thymian report merge`.
 */
export function enforceReportClaims(
  command: Pick<Command, 'error'>,
  reports: ReportInput[],
  unclaimed: ReportInput[],
): void {
  if (unclaimed.length === 0) {
    return;
  }

  const formatInput = (input: ReportInput) =>
    `"${input.type}:${String(input.location)}"`;

  const supportedTypes = [
    ...new Set(
      reports
        .filter(
          (input) =>
            !unclaimed.some(
              (unclaimedInput) =>
                unclaimedInput.type === input.type &&
                String(unclaimedInput.location) === String(input.location),
            ),
        )
        .map((input) => input.type),
    ),
  ];

  if (supportedTypes.length === 0) {
    command.error(
      `No converter plugin claimed any report input (${unclaimed.map(formatInput).join(', ')}).`,
      {
        exit: 2,
        suggestions: [
          'Is a converter plugin (e.g. @thymian/plugin-spectral) installed and autoloaded?',
        ],
      },
    );
  }

  // Support is a per-type property, but claiming happens per input: an
  // input can go unclaimed even though its type is supported (e.g. a
  // wrong location) — that case must not read as "unsupported type".
  const unsupported = unclaimed.filter(
    (input) => !supportedTypes.includes(input.type),
  );
  const unclaimedOfSupportedType = unclaimed.filter((input) =>
    supportedTypes.includes(input.type),
  );

  const problems: string[] = [];

  if (unsupported.length > 0) {
    problems.push(
      `No registered plugin claims report input${unsupported.length > 1 ? 's' : ''} ${unsupported.map(formatInput).join(', ')}.`,
    );
  }

  if (unclaimedOfSupportedType.length > 0) {
    const list = unclaimedOfSupportedType.map(formatInput).join(', ');
    problems.push(
      unclaimedOfSupportedType.length > 1
        ? `Report inputs ${list} have a supported type but were not claimed — check the locations.`
        : `Report input ${list} has a supported type but was not claimed — check the location.`,
    );
  }

  command.error(
    `${problems.join(' ')} Supported report types in this run: ${supportedTypes.join(', ')}.`,
    { exit: 2 },
  );
}
