const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Unique slug within a run; appends year, then a counter, on collision. */
export function uniqueSlug(
  base: string,
  year: number | null,
  taken: Set<string>,
): string {
  let slug = slugify(base) || "untitled";
  if (taken.has(slug) && year != null) slug = `${slug}-${year}`;
  let candidate = slug;
  let i = 2;
  while (taken.has(candidate)) candidate = `${slug}-${i++}`;
  taken.add(candidate);
  return candidate;
}
