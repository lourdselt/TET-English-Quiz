import base64
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from PyPDF2 import PdfReader, PdfWriter

# Read base64 image data
with open("g:\\My Drive\\HTML\\lourds_logo_base64.txt", "r") as f:
    base64_img = f.read().strip()

img_data = base64.b64decode(base64_img)
img_stream = BytesIO(img_data)

# Create watermark PDF with the logo
watermark_pdf = "g:\\My Drive\\HTML\\logo_watermark.pdf"
c = canvas.Canvas(watermark_pdf, pagesize=letter)
# Adjust position and size as needed
c.drawImage(img_stream, 100, 500, width=200, height=100, mask='auto')
c.save()

def add_watermark(input_pdf, output_pdf, watermark_pdf):
    watermark = PdfReader(watermark_pdf)
    watermark_page = watermark.pages[0]
    reader = PdfReader(input_pdf)
    writer = PdfWriter()
    for page in reader.pages:
        page.merge_page(watermark_page)
        writer.add_page(page)
    with open(output_pdf, "wb") as f:
        writer.write(f)

# Example usage:
# add_watermark("input.pdf", "output_watermarked.pdf", watermark_pdf)
# add_watermark("input.pdf", "output_watermarked.pdf", watermark_pdf)
