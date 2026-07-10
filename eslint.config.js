import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: {
      js,
      '@stylistic': stylistic,
    },
    extends: ["js/recommended"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Spacing
      '@stylistic/array-bracket-spacing': ["warn", "never"],
      '@stylistic/arrow-spacing': ["warn", { "before": true, "after": true }],
      '@stylistic/block-spacing': ["warn", "always"],
      '@stylistic/computed-property-spacing': ["warn", "never"],
      '@stylistic/function-call-spacing': ["warn", "never"],
      '@stylistic/generator-star-spacing': ["warn", "before"],
      '@stylistic/key-spacing': ["warn", { "beforeColon": false, "afterColon": true, "mode": "strict" }],
      '@stylistic/keyword-spacing': ["warn", { "before": true, "after": true }],
      '@stylistic/no-mixed-spaces-and-tabs': ["warn"],
      '@stylistic/no-multi-spaces': ["warn", { "ignoreEOLComments": true }],
      '@stylistic/no-trailing-spaces': ["warn"],
      '@stylistic/no-whitespace-before-property': ["warn"],
      '@stylistic/object-curly-spacing': ["warn", "always"],
      '@stylistic/rest-spread-spacing': ["warn", "never"],
      '@stylistic/space-before-blocks': ["warn", "always"],
      '@stylistic/space-before-function-paren': [
        "warn",
        {
          "anonymous": "always",
          "named": "never",
          "asyncArrow": "always",
          "catch": "always",
        },
      ],
      '@stylistic/space-in-parens': ["warn", "never"],
      '@stylistic/switch-colon-spacing': ["warn", { "after": true, "before": false }],
      '@stylistic/template-curly-spacing': ["warn", "never"],
      // Line Break
      '@stylistic/array-bracket-newline': ["warn", { "multiline": true }],
      '@stylistic/array-element-newline': ["warn", { "consistent": true, "multiline": true }],
      '@stylistic/curly-newline': ["warn", { "consistent": true }],
      '@stylistic/eol-last': ["warn"],
      '@stylistic/function-call-argument-newline': ["warn", "consistent"],
      '@stylistic/function-paren-newline': ["warn", "multiline"],
      '@stylistic/implicit-arrow-linebreak': ["warn", "beside"],
      '@stylistic/object-curly-newline': ["warn", { "consistent": true }],
      // Bracket
      '@stylistic/arrow-parens': ["warn", "as-needed"],
      '@stylistic/brace-style': ["warn", "allman", { "allowSingleLine": true }],
      '@stylistic/new-parens': ["warn"],
      '@stylistic/no-extra-parens': ["warn", "functions"],
      '@stylistic/wrap-iife': ["warn", "inside"],
      '@stylistic/wrap-regex': ["warn"],
      // Indent
      '@stylistic/indent': ['warn', 2],
      // Comment
      '@stylistic/spaced-comment': ["warn", "always"],
      // Operator
      '@stylistic/dot-location': ["warn", "property"],
      '@stylistic/multiline-ternary': ["warn", "always-multiline"],
      '@stylistic/operator-linebreak': [
        "warn",
        "before",
        {
          "overrides": {
            "=": "after",
            "+=": "after",
            "-=": "after",
            "*=": "after",
            "/=": "after",
          },
        },
      ],
      '@stylistic/space-infix-ops': ["warn"],
      '@stylistic/space-unary-ops': ["warn", { "words": true, "nonwords": false }],
      // Semi
      '@stylistic/no-extra-semi': ["warn"],
      '@stylistic/semi': ["warn", "always"],
      '@stylistic/semi-spacing': ["warn", { "before": false, "after": true }],
      // Disallow
      '@stylistic/no-multiple-empty-lines': ["warn", { "max": 1, "maxEOF": 1 }],
      // Misc
      '@stylistic/nonblock-statement-body-position': ["warn", "below"],
      // Comma
      '@stylistic/comma-spacing': ["warn"],
      '@stylistic/comma-style': ["warn", "last"],
      '@stylistic/comma-dangle': [
        "warn",
        {
          "arrays": "always-multiline",
          "objects": "always-multiline",
          "imports": "never",
          "exports": "never",
          "functions": "never",
          "importAttributes": "never",
          "dynamicImports": "never",
          "enums": "always-multiline",
          "generics": "never",
          "tuples": "never",
        },
      ],
    },
  },
]);
