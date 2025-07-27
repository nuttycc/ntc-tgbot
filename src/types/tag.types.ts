export type Strategy =
  | { type: "sld" }
  | { type: "path"; segment: number }
  | { type: "path_last" }
  | { type: "path_after"; prefix: string };

export interface TagRule {
  domains: string[];
  strategies: Strategy[];
} 