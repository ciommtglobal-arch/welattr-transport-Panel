import { readFile, writeFile } from "node:fs/promises";

const indexPath = new URL("../api-zod/src/generated/types/index.ts", import.meta.url);
const aliases = [
  "getStaffTrialTaskReportsParams",
  "getStaffTrialCandidateTasksParams",
  "getStaffTrialCandidateReportsParams",
  "exportCompanyRecordsParams",
];
// Orval gives a path-parameter Zod schema and the query-parameter TS type the
// same operation-derived name. Alias only the latter to keep both available.
let source = await readFile(indexPath, "utf8");
for (const schemaFile of aliases) {
  const generatedExport = `export * from './${schemaFile}';`;
  const typeName = schemaFile[0].toUpperCase() + schemaFile.slice(1);
  const queryTypeName = typeName.replace(/Params$/, "Query");
  const aliasedExport = `export type { ${typeName} as ${queryTypeName} } from './${schemaFile}';`;
  if (source.includes(generatedExport)) {
    source = source.replace(generatedExport, aliasedExport);
  }
}
await writeFile(indexPath, source);