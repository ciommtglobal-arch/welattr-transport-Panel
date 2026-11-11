import fitz, os
src = "attached_assets/Golden_bank_1788949454559.pdf"
out = ".agents/outputs/golden-bank-pages"
os.makedirs(out, exist_ok=True)
doc = fitz.open(src)
print("pages", doc.page_count)
for n in range(min(2, doc.page_count)):
    pix = doc[n].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = f"{out}/page-{n+1}.png"
    pix.save(path)
    print(path)
