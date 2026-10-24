/**
 * Recent answers of the heavy requests (history, statistics): a card opened
 * again draws them at once, then refreshes in the background when they are old.
 */
const answers = new Map<string, { at: number; value: unknown }>();

/** The answer saved under `key`, if any, and its age in milliseconds. */
export function recall<T>(key: string): { value: T; age: number } | undefined {
  const a = answers.get(key);
  return a ? { value: a.value as T, age: Date.now() - a.at } : undefined;
}

export function remember(key: string, value: unknown): void {
  answers.set(key, { at: Date.now(), value });
}
