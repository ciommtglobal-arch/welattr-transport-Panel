import csv
import io
import json
from pathlib import Path
import tempfile
import unittest

from dorse_audit import api_routes, build_audit, decode_metadata, declared_tables, mounted_api_files, source_inventory


def snapshot(table_names):
    payload = {key: [] for key in ("tables", "columns", "indexes", "constraints", "enums")}
    payload["tables"] = [{"table_name": name} for name in table_names]
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["metadata"])
    writer.writerow([json.dumps(payload)])
    return {"success": True, "output": buffer.getvalue()}


class AuditTests(unittest.TestCase):
    def test_failed_db_query_never_means_tables_absent(self):
        with self.assertRaises(ValueError):
            decode_metadata({"success": False})

    def test_missing_metadata_fields_fail_closed(self):
        with self.assertRaises(ValueError):
            decode_metadata({"success": True, "output": 'metadata\n"{}"\n'})

    def test_csv_metadata_larger_than_default_field_limit(self):
        result = snapshot(["a" * 150000])
        self.assertEqual(len(decode_metadata(result)["tables"]), 1)

    def test_multiline_drizzle_table_names(self):
        tables = declared_tables({"lib/db/src/schema/example.ts": 'pgTable(\n  "real_table", {})'})
        self.assertEqual(tables["real_table"]["line"], 1)

    def test_duplicate_declarations_are_not_hidden(self):
        with self.assertRaises(ValueError):
            declared_tables({"lib/db/src/schema/a.ts": 'pgTable("a", {}); pgTable("a", {})'})

    def test_multiline_routes_have_provenance(self):
        routes = api_routes({"routes.ts": 'router.post(\n "/logistics/offers/:id", handler);'}, "routes.ts")
        self.assertEqual(routes[0]["path"], "/api/logistics/offers/:id")
        self.assertEqual(routes[0]["method"], "POST")

    def test_unmounted_source_is_not_registered_api_evidence(self):
        files = {"artifacts/api-server/src/routes/index.ts":
                 'import logistics from "./logistics-operations";\n'
                 'import unused from "./unused";\nrouter.use(logistics);'}
        self.assertEqual(mounted_api_files(files), {"artifacts/api-server/src/routes/logistics-operations.ts"})

    def test_generated_and_test_code_do_not_prove_a_module_exists(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            for name in ["artifacts/app/src/real.ts", "artifacts/app/src/real.test.ts", "artifacts/app/dist/fake.ts"]:
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("export {};")
            self.assertEqual(list(source_inventory(root)), ["artifacts/app/src/real.ts"])

    def test_production_absence_is_distinguished_from_development(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            schema = root / "lib/db/src/schema/test.ts"
            schema.parent.mkdir(parents=True)
            schema.write_text('export const a = pgTable("nexus_shopify_events", {});')
            result = build_audit(root, {"capturedAt": "fixture", "development": snapshot(["nexus_shopify_events"]),
                                      "production": snapshot([])}, {})
            self.assertTrue(result["tables"][0]["development"])
            self.assertFalse(result["tables"][0]["production"])
            self.assertFalse(result["ready_for_complete_activation"])
            self.assertTrue(any("Üretimde eksik" in item for item in result["blockers"]))


if __name__ == "__main__":
    unittest.main()
