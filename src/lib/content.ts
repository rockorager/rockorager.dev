import { getEmDashCollection } from "emdash";

export const sections = { blog: "posts", misc: "notes" } as const;
export type Section = keyof typeof sections;

export function articleDate(data: { date?: Date | string | null; publishedAt?: Date | null; createdAt: Date }) {
  return new Date(data.date || data.publishedAt || data.createdAt);
}

export async function publishedEntries(section: Section) {
  const first = await getEmDashCollection(sections[section], { status: "published", limit: 100 });
  if (first.error) throw new Error(`Cannot load ${section}: ${first.error.message}`);
  const entries = [...first.entries];
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await getEmDashCollection(sections[section], { status: "published", limit: 100, cursor });
    if (page.error) throw new Error(`Cannot load ${section}: ${page.error.message}`);
    entries.push(...page.entries);
    cursor = page.nextCursor;
  }
  entries.sort((a, b) => articleDate(b.data).getTime() - articleDate(a.data).getTime());
  return { entries, cacheHint: first.cacheHint };
}
