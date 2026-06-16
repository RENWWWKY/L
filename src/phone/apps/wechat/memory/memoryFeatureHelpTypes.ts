export type MemoryFeatureHelpBlock =
  | { kind: 'text'; text: string }
  | { kind: 'bullets'; title: string; items: string[] }
  | { kind: 'tip'; title?: string; text: string }
