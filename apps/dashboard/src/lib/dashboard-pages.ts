export function pageItems<T>(items: readonly T[], size: number): T[][] {
  return Array.from({ length: Math.max(1, Math.ceil(items.length / size)) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}
