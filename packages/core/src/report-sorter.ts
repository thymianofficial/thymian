import type {
  ThymianReport,
  ThymianReportItem,
  ThymianReportSection,
  ThymianReportSeverity,
} from './events/report.event.js';

/**
 * Supported sort modes for reshaping reports before presentation.
 */
export type ReportSortMode = 'rule' | 'endpoint' | 'severity';

/**
 * Item with its original section heading preserved for regrouping.
 */
interface AttributedItem {
  item: ThymianReportItem;
  sectionHeading: string;
  source: string;
}

/**
 * Severity sort order: error → warn → hint → info.
 */
const severityOrder: Record<ThymianReportSeverity, number> = {
  error: 0,
  warn: 1,
  hint: 2,
  info: 3,
};

/**
 * Human-friendly labels for severity-grouped section headings.
 * Used by `sortBySeverity` to produce readable headings like "Errors (3)".
 */
const severityLabel: Record<ThymianReportSeverity, string> = {
  error: 'Errors',
  warn: 'Warnings',
  hint: 'Hints',
  info: 'Info',
};

/**
 * Flatten all items from all reports into a single attributed list.
 */
function flattenReports(reports: ThymianReport[]): AttributedItem[] {
  const items: AttributedItem[] = [];

  for (const report of reports) {
    for (const section of report.sections ?? []) {
      for (const item of section.items) {
        items.push({
          item,
          sectionHeading: section.heading,
          source: report.source,
        });
      }
    }
  }

  return items;
}

/**
 * Build a combined message from the original reports.
 */
function combineMessages(reports: ThymianReport[]): string {
  const messages = reports.map((r) => r.message).filter(Boolean);
  return messages.join(' ');
}

/**
 * Build a combined source from the original reports.
 */
function combineSources(reports: ThymianReport[]): string {
  const sources = [...new Set(reports.map((r) => r.source))];
  return sources.join(', ');
}

/**
 * Create a shallow copy of an item with the message replaced by the original
 * section heading (endpoint / location context).
 *
 * When items are regrouped by rule or severity the original section heading
 * that carried the endpoint context (e.g. "GET /users → 200 OK") is no
 * longer visible. Replacing the message with the heading makes the endpoint
 * the primary information shown under each rule / severity group.
 */
function withEndpointAsMessage(
  item: ThymianReportItem,
  sectionHeading: string,
): ThymianReportItem {
  return {
    ...item,
    message: sectionHeading,
  };
}

/**
 * Sort by rule name (default): flatten all items, group by `ruleName`,
 * each section heading is the rule name with affected endpoints listed as items.
 */
function sortByRule(reports: ThymianReport[]): ThymianReport[] {
  const items = flattenReports(reports);

  const groups = new Map<
    string,
    { items: ThymianReportItem[]; headings: Set<string> }
  >();

  for (const { item, sectionHeading } of items) {
    const key = item.ruleName ?? '(no rule)';
    let group = groups.get(key);
    if (!group) {
      group = { items: [], headings: new Set() };
      groups.set(key, group);
    }
    group.items.push(withEndpointAsMessage(item, sectionHeading));
    group.headings.add(sectionHeading);
  }

  const sections: ThymianReportSection[] = [];

  for (const [ruleName, group] of groups) {
    sections.push({
      heading: ruleName,
      items: group.items,
    });
  }

  return [
    {
      source: combineSources(reports),
      message: combineMessages(reports),
      sections,
    },
  ];
}

/**
 * Sort by endpoint: group by section heading (location/endpoint).
 * This is closest to the current insertion-order rendering.
 */
function sortByEndpoint(reports: ThymianReport[]): ThymianReport[] {
  const items = flattenReports(reports);

  const groups = new Map<
    string,
    { items: ThymianReportItem[]; location?: ThymianReportSection['location'] }
  >();

  // Preserve original section locations from the reports
  const sectionLocations = new Map<string, ThymianReportSection['location']>();
  for (const report of reports) {
    for (const section of report.sections ?? []) {
      if (section.location && !sectionLocations.has(section.heading)) {
        sectionLocations.set(section.heading, section.location);
      }
    }
  }

  for (const { item, sectionHeading } of items) {
    let group = groups.get(sectionHeading);
    if (!group) {
      group = { items: [], location: sectionLocations.get(sectionHeading) };
      groups.set(sectionHeading, group);
    }
    group.items.push(item);
  }

  const sections: ThymianReportSection[] = [];

  for (const [heading, group] of groups) {
    sections.push({
      heading,
      items: group.items,
      location: group.location,
    });
  }

  return [
    {
      source: combineSources(reports),
      message: combineMessages(reports),
      sections,
    },
  ];
}

/**
 * Sort by severity: flatten all items, group by severity level
 * in order error → warn → hint → info.
 */
function sortBySeverity(reports: ThymianReport[]): ThymianReport[] {
  const items = flattenReports(reports);

  const groups = new Map<ThymianReportSeverity, ThymianReportItem[]>();

  for (const { item, sectionHeading } of items) {
    let group = groups.get(item.severity);
    if (!group) {
      group = [];
      groups.set(item.severity, group);
    }
    group.push(withEndpointAsMessage(item, sectionHeading));
  }

  // Sort groups by severity order
  const sortedEntries = [...groups.entries()].sort(
    ([a], [b]) => severityOrder[a] - severityOrder[b],
  );

  const sections: ThymianReportSection[] = [];

  for (const [severity, groupItems] of sortedEntries) {
    const label = severityLabel[severity];
    sections.push({
      heading: `${label} (${groupItems.length})`,
      items: groupItems,
    });
  }

  return [
    {
      source: combineSources(reports),
      message: combineMessages(reports),
      sections,
    },
  ];
}

/**
 * Reshape reports according to the selected sort mode.
 *
 * - `rule` (default): Group by rule name, each section heading is the rule name
 * - `endpoint`: Group by endpoint/location heading (closest to natural insertion order)
 * - `severity`: Group by severity level in order error → warn → hint → info
 *
 * When no sort mode is specified or reports are empty, returns the original reports unchanged.
 */
export function sortReports(
  reports: ThymianReport[],
  mode: ReportSortMode | undefined,
): ThymianReport[] {
  if (!mode || reports.length === 0) {
    return reports;
  }

  switch (mode) {
    case 'rule':
      return sortByRule(reports);
    case 'endpoint':
      return sortByEndpoint(reports);
    case 'severity':
      return sortBySeverity(reports);
  }
}
