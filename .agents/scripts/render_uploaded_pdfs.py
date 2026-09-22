from pathlib import Path
import fitz

inputs = [
    Path("attached_assets/Dosya_222_1790093164086.pdf"),
    Path("attached_assets/Tebligat_2_1790093164086.pdf"),
]
output_dir = Path(".agents/outputs/uploaded_pdf_pages")
output_dir.mkdir(parents=True, exist_ok=True)

for pdf_path in inputs:
    doc = fitz.open(pdf_path)
    print(f"{pdf_path}: {len(doc)} page(s)")
    for page_number, page in enumerate(doc, start=1):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        output_path = output_dir / f"{pdf_path.stem}_page_{page_number}.png"
        pixmap.save(output_path)
        print(output_path)