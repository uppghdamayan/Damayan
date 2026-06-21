export function diffByTitle(before: any[], after: any[]) {
  const beforeTitles = before.map((p) => p.title.toLowerCase());
  const afterTitles = after.map((p) => p.title.toLowerCase());

  const added = after.filter((p) => !beforeTitles.includes(p.title.toLowerCase()));
  const removed = before.filter((p) => !afterTitles.includes(p.title.toLowerCase()));

  return { added, removed };
}

export function diffByNameDoseUnit(before: any[], after: any[]) {
  const getKey = (m: any) => `${m.name.toLowerCase()}-${m.dose}-${m.unit}`;

  const beforeKeys = before.map(getKey);
  const afterKeys = after.map(getKey);

  const added = after.filter((m) => !beforeKeys.includes(getKey(m)));
  const removed = before.filter((m) => !afterKeys.includes(getKey(m)));

  return { added, removed };
}
