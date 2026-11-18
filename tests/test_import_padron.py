import importlib.util
import tempfile
import unittest
from pathlib import Path
from openpyxl import Workbook

MODULE = Path(__file__).resolve().parents[1] / "tools" / "import_padron.py"
spec = importlib.util.spec_from_file_location("import_padron", MODULE)
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)

class ImporterTests(unittest.TestCase):
    def test_numeric_cedula_keeps_leading_zero(self):
        self.assertEqual(imp.id_text(503499642), "0503499642")

    def test_extracts_records_and_station_from_sheet(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "padron.xlsx"
            wb = Workbook(); ws = wb.active; ws.title = "Padrón"
            ws["A8"] = "RECINTO: LA MATRIZ"; ws["F8"] = "Junta Receptora del voto N.- 1"
            ws.append([]); ws.append(["N.-", "Apellidos", "Nombre", "Cédula"])
            ws.append([1, "APELLIDO PRUEBA", "NOMBRE PRUEBA", "0501234567"])
            wb.save(path)
            records, summary = imp.parse_padron(path)
            self.assertEqual(summary["records"], 1)
            self.assertEqual(summary["incomplete_identity_rows_skipped"], 0)
            self.assertEqual(records[0]["cedula"], "0501234567")
            self.assertEqual(records[0]["station"], "1")
            self.assertEqual(records[0]["polling_place"], "La Matriz")

    def test_duplicate_records_are_counted(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "padron.xlsx"
            wb = Workbook(); ws = wb.active
            ws["A8"] = "RECINTO: PUJILÍ"; ws["F8"] = "Junta Receptora del voto N.- 44"
            ws.append([]); ws.append(["N.-", "Apellidos", "Nombre", "Cédula"])
            ws.append([1, "A", "B", "0501234567"]); ws.append([2, "C", "D", "0501234567"])
            wb.save(path)
            _, summary = imp.parse_padron(path)
            self.assertEqual(summary["duplicate_cedulas"], 1)

if __name__ == "__main__": unittest.main()
