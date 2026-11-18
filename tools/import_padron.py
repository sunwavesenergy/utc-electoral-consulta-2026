"""Convert the private UTC voter register workbook to D1 SQL; never commit outputs."""
import argparse
import json
import re
import sqlite3
from collections import Counter
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / ".private"

def clean(value):
    return " ".join(str(value or "").strip().split())

def id_text(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return ""
    if isinstance(value, int):
        return str(value).zfill(10)
    if isinstance(value, float) and value.is_integer():
        return str(int(value)).zfill(10)
    return re.sub(r"\D", "", str(value))

def parse_padron(path):
    wb = load_workbook(path, read_only=True, data_only=True)
    records, incomplete_rows, sheets_without_metadata = [], 0, 0
    quality = {"id_without_name": 0, "name_without_valid_id": 0, "partial_identity": 0}
    for ws in wb.worksheets:
        rows = ws.iter_rows(values_only=True)
        header = None
        for row in rows:
            texts = [clean(v).casefold() for v in row]
            if "apellidos" in texts and "nombre" in texts and any("cédula" in x or "cedula" in x for x in texts):
                header = (row, list(texts))
                break
        if not header:
            continue
        _, labels = header
        last = max(i for i, label in enumerate(labels) if label in ("apellidos", "nombre") or "cédula" in label or "cedula" in label)
        surname_i = labels.index("apellidos")
        name_i = labels.index("nombre")
        id_i = next(i for i, label in enumerate(labels) if "cédula" in label or "cedula" in label)
        title_rows = []
        for row in ws.iter_rows(min_row=1, max_row=12, values_only=True):
            for value in row:
                val = clean(value)
                if val:
                    title_rows.append(val)
        place_match = next((re.search(r"RECINTO\s*:\s*(.+)", val, re.I) for val in title_rows if re.search(r"RECINTO\s*:", val, re.I)), None)
        station_match = next((re.search(r"Junta Receptora del voto[^0-9]{0,20}([0-9]+)", val, re.I) for val in title_rows if re.search(r"Junta Receptora del voto", val, re.I)), None)
        campus = ""
        if place_match:
            place = clean(place_match.group(1)).upper()
            campus = {"LA MATRIZ": "La Matriz", "LA MANÁ": "La Maná", "LA MANA": "La Maná", "PUJILÍ": "Pujilí", "PUJILI": "Pujilí"}.get(place, "")
        polling_place = campus or (clean(place_match.group(1)).title() if place_match else "")
        station = station_match.group(1).strip().upper() if station_match else ""
        if not polling_place or not station:
            sheets_without_metadata += 1
            continue
        for row in ws.iter_rows(values_only=True):
            values = list(row) + [None] * (last + 1 - len(row))
            cedula = id_text(values[id_i])
            surname, first = clean(values[surname_i]), clean(values[name_i])
            if surname.casefold() == "apellidos" and first.casefold() == "nombre" and clean(values[id_i]).casefold() in ("cédula", "cedula"):
                continue
            if not cedula and not surname and not first:
                continue
            if not re.fullmatch(r"\d{10}", cedula) or not surname or not first:
                # Skip repeated headers and footer summaries; count actual malformed identity rows only.
                if cedula or (surname and first):
                    incomplete_rows += 1
                    if cedula and not (surname and first):
                        quality["id_without_name"] += 1
                    elif surname and first and not re.fullmatch(r"\d{10}", cedula):
                        quality["name_without_valid_id"] += 1
                    else:
                        quality["partial_identity"] += 1
                continue
            records.append({"cedula": cedula, "name": f"{surname} {first}".strip(), "polling_place": polling_place, "station": station, "campus": campus, "address": "", "maps_url": ""})
    wb.close()
    counts = Counter(x["cedula"] for x in records)
    duplicates = sum(1 for n in counts.values() if n > 1)
    return records, {"records": len(records), "unique_cedulas": len(counts), "duplicate_cedulas": duplicates, "incomplete_identity_rows_skipped": incomplete_rows, "incomplete_identity_breakdown": quality, "sheets_without_location_or_station": sheets_without_metadata, "stations": sorted({x["station"] for x in records})}

def verify_jrv(path, stations):
    wb = load_workbook(path, read_only=True, data_only=True)
    found = set()
    for ws in wb.worksheets:
        for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 12), values_only=True):
            for value in row:
                match = re.search(r"Junta Receptora del voto[^0-9]{0,20}([0-9]+)", clean(value), re.I)
                if match:
                    found.add(match.group(1).strip().upper())
    wb.close()
    base = lambda s: re.match(r"\d+", s).group(0) if re.match(r"\d+", s) else s
    padron_base, jrv_base = {base(s) for s in stations}, {base(s) for s in found}
    return {"jrv_workbook_station_numbers": len(found), "stations_missing_from_jrv_workbook": sorted(padron_base - jrv_base, key=int), "jrv_workbook_stations_without_padron": sorted(jrv_base - padron_base, key=int)}

def sql_quote(value):
    return "'" + str(value).replace("'", "''") + "'"

def write_sql(records, path):
    lines = ["DELETE FROM voters;"]
    for r in records:
        cols = ("cedula", "name", "polling_place", "station", "campus", "address", "maps_url")
        lines.append("INSERT INTO voters(" + ",".join(cols) + ") VALUES(" + ",".join(sql_quote(r[k]) for k in cols) + ");")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("padron", type=Path)
    parser.add_argument("jrv", type=Path)
    parser.add_argument("--output", type=Path, default=PRIVATE / "voters-import.sql")
    parser.add_argument("--report", type=Path, default=PRIVATE / "validation-report.json")
    parser.add_argument("--allow-incomplete", action="store_true", help="Import only valid rows after a data owner has reconciled skipped identity rows.")
    args = parser.parse_args()
    records, report = parse_padron(args.padron)
    report.update(verify_jrv(args.jrv, report["stations"]))
    report.pop("stations", None)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    if report["duplicate_cedulas"]:
        raise SystemExit("Import canceled: duplicate identity numbers detected; review the source workbook.")
    if report["incomplete_identity_rows_skipped"] and not args.allow_incomplete:
        raise SystemExit("Import canceled: incomplete identity rows were skipped. Reconcile the source workbook, or use --allow-incomplete only after the data owner approves excluding them.")
    if not records:
        raise SystemExit("Import canceled: no valid records found; check workbook headers and format.")
    write_sql(records, args.output)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Private SQL written to: {args.output}")

if __name__ == "__main__":
    main()
