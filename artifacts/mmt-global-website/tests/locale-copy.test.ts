import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { getLocaleCopy, normalizeLocale } from "../src/lib/locale-copy";
import additionalLocales from "../src/lib/additional-locales.json";

const files = [
  "lib/i18n.tsx", "pages/corporate-home.tsx", "pages/home.tsx",
  "components/corporate-fleet-section.tsx", "pages/departments.tsx",
  "pages/construction-store-closed.tsx", "pages/construction-shop.tsx",
  "pages/construction-store.tsx", "lib/construction-shop.tsx",
];
let checkedCopies = 0;
for (const file of files) {
  const source = readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node: ts.Node) {
    if (ts.isObjectLiteralExpression(node)) {
      const english = node.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) && property.name.getText(ast) === "en",
      );
      if (english) {
        const module = { exports: {} };
        const code = ts.transpileModule(`module.exports = ${english.initializer.getText(ast)}`, {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText;
        runInNewContext(code, { module });
        const copies = { tr: module.exports, en: module.exports, ar: module.exports, ru: module.exports };
        for (const locale of ["tr", "en", "ar", "ru"] as const) {
          assert.equal(getLocaleCopy(copies, locale), copies[locale]);
        }
        for (const locale of ["ku", "uk"] as const) {
          const translated = getLocaleCopy(copies, locale);
          assert.deepEqual(Object.keys(translated), Object.keys(module.exports), `${file}: ${locale}`);
          assert.equal(getLocaleCopy(copies, locale), translated, "Locale copies must be cached");
        }
        checkedCopies++;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
assert.ok(checkedCopies >= 10, "All public locale dictionaries must be inspected");
for (const [locale, dictionary] of Object.entries(additionalLocales)) {
  assert.equal(Object.keys(dictionary).length, 390);
  for (const [source, translated] of Object.entries(dictionary)) {
    assert.ok(translated.trim(), `${locale}: empty translation`);
    assert.deepEqual(
      translated.match(/\{[^}]+\}/g)?.sort() ?? [],
      source.match(/\{[^}]+\}/g)?.sort() ?? [],
      `${locale}: changed placeholder in ${source}`,
    );
  }
}
const targets = { en: { id: "gulf", href: "/lojistik", mail: "mailto:office@example.invalid", enabled: false }, tr: {}, ar: {}, ru: {} };
assert.deepEqual(getLocaleCopy(targets, "ku"), targets.en, "Translation must not modify identifiers, URLs or flags");
assert.equal(normalizeLocale("ua"), "uk");
assert.equal(normalizeLocale("ku"), "ku");
assert.equal(normalizeLocale("unknown"), "tr");
assert.throws(() => getLocaleCopy({ en: { label: "UNTRANSLATED TEST LABEL" }, tr: {}, ar: {}, ru: {} }, "uk"), /Missing uk UI translation/);
console.log(`MMT locales: ${checkedCopies} dictionaries, 390 KU/UA strings, placeholders, existing locales and route preservation passed.`);
