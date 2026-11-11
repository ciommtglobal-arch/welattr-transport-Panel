import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LogisticsPoolWorkspace } from "@workspace/api-client-react";
import { LogisticsEvidenceTable } from "../src/components/logistics-pool/evidence-table";

test("evidence table does not count TEST matches as real founder drafts", () => {
  const data = {
    automaticSchedule: "Bağımsız worker çalışma kanıtı yok",
    sources: [],
    entries: ["load", "carrier"].map((role, index) => ({
      id: `TEST-${index}`, role, isTest: true, active: true, eligible: true,
    })),
    matches: [{ status: "pending", entryIds: ["TEST-0", "TEST-1"],
      aiDraft: { saved: true, generatedAt: new Date().toISOString() } }],
  } as unknown as LogisticsPoolWorkspace;
  const html = renderToStaticMarkup(React.createElement(LogisticsEvidenceTable, { data }));
  assert.match(html, /0 inceleme bekleyen taslak/);
  assert.match(html, /0 yük \/ 0 taşıyıcı/);
  assert.match(html, /Henüz gerçek taslak kanıtı yok/);
  assert.match(html, /Genel internet taraması yapılmaz/);
  assert.match(html, /kanıtı değildir/);
});
