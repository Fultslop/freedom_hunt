import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import svelte from "eslint-plugin-svelte";
import svelteParser from "svelte-eslint-parser";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import unusedImports from "eslint-plugin-unused-imports";

const SKIP_PARENT_TYPES = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExpressionStatement",
  "TSLiteralType",
]);

const noDuplicateStringRule = {
  meta: {
    type: "suggestion",
    docs: { description: "Disallow duplicate string literals; extract to a named constant" },
    schema: [
      {
        type: "object",
        properties: {
          threshold: { type: "integer", minimum: 2 },
          minLength: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      defineConstant:
        "Define a constant instead of duplicating this literal {{times}} times.",
    },
  },
  create(context) {
    const { threshold = 2, minLength = 3 } = context.options[0] ?? {};
    const occurrences = new Map();
    return {
      Literal(node) {
        if (
          typeof node.value === "string" &&
          node.value.length >= minLength &&
          !SKIP_PARENT_TYPES.has(node.parent?.type)
        ) {
          const list = occurrences.get(node.value) ?? [];
          list.push(node);
          occurrences.set(node.value, list);
        }
      },
      "Program:exit"() {
        for (const nodes of occurrences.values()) {
          if (nodes.length >= threshold) {
            for (const node of nodes) {
              context.report({
                node,
                messageId: "defineConstant",
                data: { times: String(nodes.length) },
              });
            }
          }
        }
      },
    };
  },
};

const localPlugin = { rules: { "no-duplicate-string": noDuplicateStringRule } };

const sharedRules = {
  "no-useless-return": "error",
  "no-continue": "error",
  "unused-imports/no-unused-imports": "error",
  // disable this for now, as it can be noisy 
  //"local/no-duplicate-string": ["error", { "threshold": 2, "minLength": 3 }],
};

const sharedRestrictedSyntax = [
  {
    "selector": "ForOfStatement > BlockStatement > IfStatement[test.operator='!'] > ReturnStatement[argument.value=false]",
    "message": "This manual guard loop can be replaced with .every() or .isSubsetOf().",
  },
  {
    "selector": "ReturnStatement[argument=null]",
    "message": "Early returns (naked returns) are disallowed.",
  },
];

export default defineConfig([
  globalIgnores(["dist", "build", "node_modules", "src/test/worker*.test.ts"]),
  {
    files: ["**/*.{js,ts}"],
    plugins: { "@typescript-eslint": tseslint.plugin, "unused-imports": unusedImports, local: localPlugin },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.es2020, ...globals.node },
    },
    rules: {
      "complexity": ["error", 10],
      "max-len": ["error", { "code": 100 }],
      "curly": ["error", "all"],
      "brace-style": ["error", "1tbs", { "allowSingleLine": false }],
      "id-length": ["error", { "min": 3, "exceptions": ["id", "to", "ok", "fs", "js", "vi", "m", "r", "e", "k", "v", "i", "c", "ip", "b", "f", "pr", "a"] }],
      ...sharedRules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "varsIgnorePattern": "^[A-Z_]", "argsIgnorePattern": "^_" },
      ],
      "no-restricted-syntax": ["error", ...sharedRestrictedSyntax],
    },
  },
  {
    files: ["**/*.svelte"],
    plugins: { svelte, "@typescript-eslint": tseslint.plugin, "unused-imports": unusedImports, local: localPlugin },
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: { ...globals.browser },
    },
    rules: {
      ...svelte.configs.recommended.rules,
      "svelte/require-each-key": "error",
      "svelte/no-at-html-tags": "error",
      "svelte/no-unused-svelte-ignore": "error",
      "svelte/no-reactive-reassign": "error",
      "max-len": ["error", { "code": 100, "ignorePattern": "^\\s*<" }],
      "curly": ["error", "all"],
      "brace-style": ["error", "1tbs", { "allowSingleLine": false }],
      "id-length": ["error", { "min": 3, "exceptions": ["id", "to", "ok", "fs", "js", "vi", "m", "r", "e", "k", "v", "i", "c", "ip", "b", "f", "pr", "a", "p", "n"] }],
      ...sharedRules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "varsIgnorePattern": "^[A-Z_]", "argsIgnorePattern": "^_" },
      ],
      "no-restricted-syntax": ["error", ...sharedRestrictedSyntax],
    },
  },
  {
    files: ["src/test/**/*.{ts}", "**/*.test.{ts}"],
    languageOptions: {
      globals: { ...globals.vitest, vi: "readonly", global: "readonly" },
    },
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
      "complexity": "off",
      "no-useless-return": "off",
    },
  },
  {
    files: ["src/worker/**/*.ts"],
    rules: {
      "complexity": "off",
      "no-useless-return": "off",
    },
  },
  prettierConfig,
  {
    rules: {
      "curly": ["error", "all"],
    },
  },
]);
