import type { TagRule } from "@/types/tag.types.ts";

export const rules: TagRule[] = [
  {
    domains: ["x.com", "twitter.com"],
    strategies: [
      { type: "sld" },
      { type: "path", segment: 0 },
    ],
  },
  {
    domains: ["npmjs.com"],
    strategies: [
      { type: "sld" },
      { type: "path_after", prefix: "/package/" },
    ],
  },
];

export const defaultRule: TagRule = {
  domains: [],
  strategies: [{ type: "sld" }],
}; 