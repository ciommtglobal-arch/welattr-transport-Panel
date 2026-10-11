#!/usr/bin/env python3
"""Offline, read-only code/schema audit. Never connects to a DB or reads secrets.

Database input must come from approved executeSql SELECT metadata snapshots.
Exit 0 means the audit ran, NOT that business modules are ready. --strict exits
2 if publication/complete-activation prerequisites remain unverified.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import re


MODULES = [
    {
        "name": "Dorse Dünyası / Ağır vasıta al-sat",
        "integration_level": "Ortak altyapı ilişkili; özel al-sat modülü doğrulanmadı.",
        "assessment": "Özel al-sat modülü doğrulanamadı. Genel taşıyıcı kaydı, B2B ilanı ve Telegram'daki dorse tipi alanı araç satış pazaryeri değildir.",
        "tables": ["logistics_carriers", "b2b_listings", "limit_applications"],
        "files": ["telegram-bot/bot.py", "artifacts/api-server/src/routes/logistics-operations.ts"],
        "gaps": ["Özel satış ilanı/araç envanteri", "Alıcı-satıcı işlem ve devir akışı", "Araç teknik bilgileri/VIN/kilometre/ruhsat modeli"],
    },
    {
        "name": "Yük bulma",
        "integration_level": "Dahili kayıt/ilan; ayrı WhatsApp intake kodu var, gerçek sağlayıcı akışı test edilmedi.",
        "assessment": "Dahili yük talebi, taşıyıcı başvurusu, onaylı lojistik ilanları ve personel operasyon ekranı var. Otomatik yük pazaryeri eşleştirmesi veya dış yük pazarı bağlantısı doğrulanmadı.",
        "tables": ["logistics_requests", "logistics_carriers", "b2b_listings",
                   "logistics_listing_grants", "logistics_listing_drafts",
                   "logistics_inbound_drafts", "logistics_inbound_messages"],
        "files": ["artifacts/api-server/src/routes/logistics-operations.ts",
                  "artifacts/api-server/src/routes/public-logistics.ts",
                  "artifacts/api-server/src/routes/logistics-listing-workspace.ts",
                  "artifacts/api-server/src/routes/whatsapp-logistics-webhook.ts",
                  "artifacts/mmt-global-website/src/pages/logistics-hub.tsx",
                  "artifacts/mmt-global-website/src/pages/staff-logistics-operations.tsx"],
        "gaps": ["Otomatik yük/araç eşleştirmesi", "Harici yük pazarıyla doğrulanmış veri alışverişi"],
    },
    {
        "name": "Nakliye / operasyon",
        "integration_level": "Dahili UI/API/veritabanı; manuel dış gönderim kaydı.",
        "assessment": "Talep, taşıyıcı, sevkiyat aşamaları, maliyet/satış fiyatlı teklif ve iletişim kayıtları uygulanmış. Kurucu onayı ve sürüm kontrolleri var. Gönderildi işareti manuel harici gönderim kaydıdır; otomatik e-posta/WhatsApp teklif gönderimi veya hukuki imza değildir.",
        "tables": ["logistics_requests", "logistics_carriers", "logistics_shipments",
                   "logistics_offers", "logistics_communications"],
        "files": ["artifacts/api-server/src/routes/logistics-operations.ts",
                  "artifacts/api-server/src/lib/logisticsWorkflow.ts",
                  "artifacts/api-server/src/lib/logisticsWorkflowAuth.ts",
                  "artifacts/mmt-global-website/src/pages/staff-logistics-operations.tsx"],
        "gaps": ["Gerçek hesapla uçtan uca canlı doğrulama", "GPS/telematik ve taşıma sağlayıcısı bağlantısı doğrulanmadı", "Ayrı hukuki sözleşme/e-imza modülü doğrulanmadı"],
    },
    {
        "name": "Alıcı–üretici eşleştirmesi",
        "integration_level": "Dahili B2B dizin/talep; otomatik eşleştirme doğrulanmadı.",
        "assessment": "B2B producer/buyer rolleri, firma profilleri, ilan/talep ve şirket içi iş yönetimi var. İlan filtreleme ve manuel koordinasyon otomatik eşleştirme motoru veya ERP entegrasyonu değildir.",
        "tables": ["b2b_business_profiles", "b2b_listings", "b2b_requests",
                   "b2b_reports", "b2b_company_members", "b2b_company_requests",
                   "b2b_company_tasks", "b2b_company_task_reports",
                   "workflow_approvals", "workflow_notifications"],
        "files": ["artifacts/api-server/src/routes/b2b-listings.ts",
                  "artifacts/api-server/src/routes/b2b-business-profiles.ts",
                  "artifacts/api-server/src/routes/b2b-requests.ts",
                  "artifacts/api-server/src/routes/b2b-company-management.ts",
                  "artifacts/mmt-global-website/src/pages/free-b2b-network.tsx",
                  "artifacts/mmt-global-website/src/pages/b2b-company-panel.tsx"],
        "gaps": ["Özel matching/puanlama modeli ve öneri motoru", "Üretici stok/ERP/veri sağlayıcısı bağlantısı doğrulanmadı"],
    },
    {
        "name": "Leasing / finansman",
        "integration_level": "Başvuru/belge ve finansman ilgisi; gerçek banka/leasing bağlantısı doğrulanmadı.",
        "assessment": "Genel limit/taşıt başvurusu, belge saklama ve finans personeli incelemesi var. Nexus finansman ilgisi ayrı bir kayıt tipidir; banka/leasing başvurusu göndermez. Gerçek leasing kuruluşu entegrasyonu veya sözleşme akışı doğrulanmadı.",
        "tables": ["limit_applications", "limit_application_documents",
                   "limit_application_audit_logs", "staff_users",
                   "nexus_shopify_events", "nexus_shopify_intakes"],
        "files": ["artifacts/api-server/src/routes/limit-applications.ts",
                  "artifacts/api-server/src/routes/nexus-shopify.ts",
                  "artifacts/api-server/src/routes/shopify-logistics.ts",
                  "lib/db/src/schema/limit-applications.ts",
                  "lib/db/src/schema/nexus-shopify.ts"],
        "gaps": ["Gerçek leasing/banka sağlayıcısı ve kabul doğrulaması", "Başvuru gönderim/karar geri bildirim entegrasyonu", "Leasing sözleşmesi/ödeme planı modeli"],
    },
    {
        "name": "Ekspertiz",
        "integration_level": "Özel UI/API/veritabanı/sağlayıcı modülü doğrulanmadı.",
        "assessment": "Özel ekspertiz API/UI/tablosu veya sağlayıcı entegrasyonu doğrulanamadı. Serbest araç açıklaması ekspertiz raporu yerine geçmez.",
        "tables": [],
        "files": ["lib/db/src/schema/limit-applications.ts"],
        "gaps": ["Ekspertiz randevusu ve uzman/kurum modeli", "Araç muayene bulguları ve rapor dosyaları", "Yetkili ekspertiz sağlayıcısı entegrasyonu"],
    },
]


def decode_metadata(result):
    if not result.get("success"):
        raise ValueError("Database metadata query failed; absence cannot be inferred.")
    csv.field_size_limit(4 * 1024 * 1024)
    rows = list(csv.DictReader(io.StringIO(result["output"])))
    if len(rows) != 1 or "metadata" not in rows[0]:
        raise ValueError("Expected one approved metadata row.")
    data = json.loads(rows[0]["metadata"])
    for key in ("tables", "columns", "indexes", "constraints", "enums"):
        if not isinstance(data.get(key), list):
            raise ValueError(f"Missing metadata list: {key}")
    return data


def source_inventory(root):
    files = {}
    for folder in ("artifacts", "lib/db/src/schema", "telegram-bot"):
        for path in sorted((root / folder).rglob("*")):
            if not path.is_file() or path.suffix not in (".ts", ".tsx", ".py"):
                continue
            relative = path.relative_to(root).as_posix()
            if any(part in {"node_modules", "dist", ".local", "generated", "__pycache__"} for part in path.parts):
                continue
            if re.search(r"\.(?:test|spec)\.", path.name):
                continue
            files[relative] = path.read_text(encoding="utf-8")
    return files


def declared_tables(files):
    found = {}
    for filename, source in files.items():
        if not filename.startswith("lib/db/src/schema/"):
            continue
        for match in re.finditer(r'\bpgTable\s*\(\s*["\']([^"\']+)["\']', source):
            name = match.group(1)
            if name in found:
                raise ValueError(f"Ambiguous duplicate Drizzle table: {name}")
            found[name] = {"file": filename, "line": source.count("\n", 0, match.start()) + 1}
    return found


def api_routes(files, filename):
    source = files.get(filename, "")
    return [
        {"method": match.group(1).upper(), "path": "/api" + match.group(2),
         "file": filename, "line": source.count("\n", 0, match.start()) + 1}
        for match in re.finditer(r'\brouter\.(get|post|put|patch|delete)\s*\(\s*["\']([^"\']+)["\']', source)
    ]


def mounted_api_files(files):
    index = files.get("artifacts/api-server/src/routes/index.ts", "")
    imports = dict(re.findall(r'import\s+(\w+)\s+from\s+["\']\./([^"\']+)["\']', index))
    names = re.findall(r'\brouter\.use\s*\(\s*(\w+)\s*\)', index)
    return {f"artifacts/api-server/src/routes/{imports[name]}.ts" for name in names if name in imports}


def build_audit(root, metadata, context):
    files = source_inventory(root)
    mounted = mounted_api_files(files)
    declared = declared_tables(files)
    environments = {name: decode_metadata(metadata[name]) for name in ("development", "production")}
    names = {name: {row["table_name"] for row in data["tables"]} for name, data in environments.items()}
    table_names = sorted(set(declared) | names["development"] | names["production"])
    inventory = [
        {"name": name, "drizzle": declared.get(name),
         "development": name in names["development"], "production": name in names["production"],
         "columns": {env: [col for col in data["columns"] if col["table_name"] == name]
                     for env, data in environments.items()},
         "indexes": {env: [idx for idx in data["indexes"] if idx["tablename"] == name]
                     for env, data in environments.items()},
         "constraints": {env: [c for c in data["constraints"] if c["table_name"] == name]
                         for env, data in environments.items()}}
        for name in table_names
    ]
    table_lookup = {row["name"]: row for row in inventory}
    modules = []
    for definition in MODULES:
        modules.append({
            **definition,
            "table_evidence": [
                {"name": table, "drizzle": table_lookup[table]["drizzle"],
                 "development": table_lookup[table]["development"],
                 "production": table_lookup[table]["production"]}
                for table in definition["tables"] if table in table_lookup
            ],
            "source_evidence": [
                {"file": filename, "exists": filename in files,
                 "api_router_mounted": filename in mounted,
                 "sha256": hashlib.sha256(files[filename].encode()).hexdigest() if filename in files else None,
                 "routes": api_routes(files, filename)}
                for filename in definition["files"]
            ],
            "runtime_verification": "Authenticated real-provider business flow NOT tested; source/metadata evidence only.",
        })
    app_source = files.get("artifacts/mmt-global-website/src/App.tsx", "")
    ui_routes = sorted(set(re.findall(r'<Route\s+path=["\']([^"\']+)', app_source)))
    terms = r"dorse|leasing|ekspertiz|trailer|heavy.?vehicle|vehicle.?sales|inspection"
    term_evidence = [
        {"file": filename, "line": number, "terms": sorted(set(match.lower() for match in re.findall(terms, line, flags=re.I)))}
        for filename, source in files.items()
        for number, line in enumerate(source.splitlines(), 1) if re.search(terms, line, flags=re.I)
    ]
    blockers = [
        f"Üretimde eksik Drizzle tablosu: {name}" for name in sorted(set(declared) - names["production"])
    ]
    shopify = context.get("shopifyConfig", {})
    secrets = shopify.get("secretPresence", {}).get("secrets", {})
    if not secrets.get("SHOPIFY_NEXUS_WEBHOOK_SECRET"):
        blockers.append("Shopify webhook imza anahtarı üretimde yok; imza kontrolü asla atlanmamalı.")
    domain_env = shopify.get("domainEnvironment", {}).get("envVars", {})
    domain_present = secrets.get("SHOPIFY_NEXUS_SHOP_DOMAIN") or any(
        isinstance(values, dict) and values.get("SHOPIFY_NEXUS_SHOP_DOMAIN")
        for values in domain_env.values()
    )
    if not domain_present:
        blockers.append("Shopify hedef mağaza alanı üretimde tanımlı değil.")
    if context.get("publishDiff", {}).get("maybeNonBackwardsCompatible"):
        blockers.append("Publish farkı mevcut sistemi etkileyebilir; kaldırılacak ilişki kısıtları/indeks ayrıca incelenmeli.")
    blockers.extend(context.get("additionalKnownBlockers", []))
    blockers.append("Dorse al-sat, otomatik eşleştirme, gerçek leasing ve ekspertiz tamamlanmış/aktif olarak doğrulanmadı.")
    return {
        "captured_at": metadata["capturedAt"], "method": "READ_ONLY_SOURCE_AND_DB_METADATA",
        "ready_for_complete_activation": False, "blockers": blockers, "context": context,
        "modules": modules, "tables": inventory, "enums": {env: data["enums"] for env, data in environments.items()},
        "counts": {"scanned_source_files": len(files), "drizzle_tables": len(declared),
                   "development_tables": len(names["development"]), "production_tables": len(names["production"])},
        "ui_routes": ui_routes, "term_evidence": term_evidence,
        "test_results": context.get("testResults", {}),
        "limitations": [
            "Tablo varlığı çalışan modül veya gerçek sağlayıcı entegrasyonu kanıtı değildir.",
            "Statik tarama aktif TS/TSX/Python kaynaklarını kapsar; yüklenen taslaklar, arşivler ve üretilmiş istemciler uygulama kanıtı sayılmadı.",
            "Kod değerlendirmeleri bu denetimde incelenen kapsam içindir; yeni kod eklendiğinde insan incelemesiyle MODULES değerlendirmeleri yenilenmelidir.",
            "Müşteri kayıtları, parola/token/HMAC değerleri okunmadı; yalnız tablo/sütun/indeks/kısıt/enum metaverisi okundu.",
            "Firma genelinin mali/hukuki yetkisi ve banka kabulü bu teknik denetimle doğrulanamaz.",
        ],
    }


def render_report(audit):
    lines = [
        "MMT GLOBAL — DORSE DÜNYASI DOĞRULAMA RAPORU",
        f"Metaveri zamanı (UTC): {audit['captured_at']}",
        "SONUÇ: TAM AKTİVASYON İÇİN HAZIR DEĞİL",
        "Denetim çalıştı; aşağıdaki eksikler test başarısı olarak sunulmaz.",
        "CANLIYA ALINMADI — VERİ/ŞEMA/KULLANICI/YETKİ DEĞİŞİKLİĞİ YOK",
        "", "KAPSAM VE SINIRLAR", *[f"- {text}" for text in audit["limitations"]],
        "", "SAYIMLAR", *[f"- {key}: {value}" for key, value in audit["counts"].items()],
        "", "YAYIN ÖNKOŞULLARI", *[f"- {text}" for text in audit["blockers"]],
    ]
    for module in audit["modules"]:
        lines.extend(["", module["name"].upper(), module["assessment"],
                      f"Entegrasyon seviyesi: {module['integration_level']}",
                      "İlgili/ortak tablolar (özel modülün tamamlandığı anlamına gelmez):"])
        for table in module["table_evidence"]:
            ref = table["drizzle"]
            lines.append(f"- {table['name']} | Drizzle: {'var' if ref else 'yok'} | DEV: {table['development']} | PROD: {table['production']}")
            if ref:
                lines.append(f"  Kaynak: {ref['file']}:{ref['line']}")
        if not module["table_evidence"]:
            lines.append("- Özel tablo doğrulanamadı.")
        lines.append("API/kaynak kanıtı:")
        for source in module["source_evidence"]:
            lines.append(f"- {source['file']} | mevcut: {source['exists']}" +
                         (f" | API router kayıtlı: {source['api_router_mounted']}" if source["routes"] else ""))
            lines.extend(f"  {route['method']} {route['path']} (satır {route['line']})" for route in source["routes"])
        lines.extend(["Eksikler:", *[f"- {gap}" for gap in module["gaps"]]])
    lines.extend(["", "İLGİLİ EKRAN ROTALARI"])
    lines.extend(f"- {route}" for route in audit["ui_routes"] if re.search(r"lojistik|b2b|limit|nexus", route))
    lines.extend(["", "TÜM TABLOLAR — DRIZZLE / GELİŞTİRME / ÜRETİM ENVANTERİ"])
    for table in audit["tables"]:
        lines.append(f"\n{table['name']} | Drizzle: {bool(table['drizzle'])} | DEV: {table['development']} | PROD: {table['production']}")
        for env in ("development", "production"):
            columns = table["columns"][env]
            lines.append(f"  {env} sütunları: " + (", ".join(
                f"{col['column_name']}:{col['udt_name']}{'?' if col['is_nullable'] == 'YES' else '!'}"
                for col in columns) or "TABLO YOK"))
            lines.append(f"  {env} indeksleri: " + (", ".join(idx["indexname"] for idx in table["indexes"][env]) or "yok"))
            lines.append(f"  {env} kısıtları: " + (", ".join(
                f"{item['constraint_name']} ({item['constraint_type']})" for item in table["constraints"][env]) or "yok"))
    lines.extend(["", "BEKLEYEN GENİŞ YAYIN FARKI",
                  f"Önceki yayın ön-kontrolü SQL işlem sayısı: {audit['context'].get('publishDiff', {}).get('statementCount', 'bilinmiyor')}"])
    lines.extend(audit["context"].get("publishDiff", {}).get("affectedConstraintStatements", []))
    lines.extend(["", "BU DENETİMDE ÇALIŞTIRILAN TESTLER"])
    lines.extend(f"- {key}: {value}" for key, value in audit["test_results"].items())
    lines.extend(["", "Kaynak+metaveri ayrıntıları: audit.json",
                  "Bu rapor banka/leasing/ekspertiz onayı, gerçek hesapla uçtan uca test veya yayın kanıtı değildir."])
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--context", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("generated-artifacts/dorse-audit"))
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    audit = build_audit(args.root, json.loads(args.metadata.read_text()), json.loads(args.context.read_text()))
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output / "rapor.txt").write_text(render_report(audit), encoding="utf-8")
    print(json.dumps({"audit_executed": True, "ready_for_complete_activation": False,
                      "counts": audit["counts"], "blockers": audit["blockers"]}, ensure_ascii=False, indent=2))
    return 2 if args.strict and not audit["ready_for_complete_activation"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
