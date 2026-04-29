export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["rust", "frontend", "config", "infra", "deps", "deps-dev", "docs", "release"],
    ],
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "refactor", "test", "docs", "chore", "perf", "build", "ci", "revert"],
    ],
  },
};
