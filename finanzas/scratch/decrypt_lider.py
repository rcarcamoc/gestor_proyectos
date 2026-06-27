import pypdf
import sys

pdf_path = r"c:\Users\arant\OneDrive\Desarrollo\portal\estado de cuenta lider.pdf"
password = "2851"

reader = pypdf.PdfReader(pdf_path)
if reader.is_encrypted:
    print("PDF is encrypted. Decrypting...")
    reader.decrypt(password)

print(f"Number of pages: {len(reader.pages)}")

full_text = ""
for idx, page in enumerate(reader.pages):
    text = page.extract_text()
    print(f"--- PAGE {idx+1} ---")
    print(text)
    full_text += f"\n--- PAGE {idx+1} ---\n" + text

with open("scratch/lider_text.txt", "w", encoding="utf-8") as f:
    f.write(full_text)
