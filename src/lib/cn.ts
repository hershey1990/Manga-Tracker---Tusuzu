export type ClassValue =
  | string
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | undefined>;

export const cn = (...values: ClassValue[]): string => {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === 'string') {
      out.push(value);
    } else if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) out.push(key);
      }
    }
  }
  return out.join(' ');
};
