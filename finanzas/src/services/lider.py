import pypdf
import sys
import json
import re
import os

def parse_pdf(pdf_path, password):
    if not os.path.exists(pdf_path):
        return {"error": f"File not found: {pdf_path}"}
        
    try:
        reader = pypdf.PdfReader(pdf_path)
        if reader.is_encrypted:
            reader.decrypt(password)
            
        full_text = ""
        for idx, page in enumerate(reader.pages):
            full_text += f"\n--- PAGE {idx+1} ---\n" + page.extract_text()
            
        # First-pass parsing
        lines = full_text.split("\n")
        transactions = []
        billing_period = None
        card_number = None
        
        # Extract billing period
        period_match = re.search(r"Per[íi]odo Facturado\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})", full_text, re.IGNORECASE)
        if period_match:
            billing_period = {
                "start": period_match.group(1),
                "end": period_match.group(2)
            }
            
        # Extract card number
        card_match = re.search(r"N[úu]mero tarjeta\s+([\wX]+)", full_text, re.IGNORECASE)
        if card_match:
            card_number = card_match.group(1)
            
        pattern_lugar = re.compile(r"^([A-Z0-9\s\*ñÑáéíóúÁÉÍÓÚüÜ]+?)\s+(\d{2}/\d{2}/\d{4})\s*(.*?)\s*\$\s*([\d\.,]+.*)$", re.IGNORECASE)
        pattern_no_lugar = re.compile(r"^(\d{2}/\d{2}/\d{4})\s*(.*?)\s*\$\s*([\d\.,]+.*)$", re.IGNORECASE)
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            m = pattern_lugar.match(line)
            if m:
                lugar = m.group(1).strip()
                date = m.group(2).strip()
                desc = m.group(3).strip()
                rest = m.group(4).strip()
                
                if any(x in line for x in ["Total", "Período", "Saldo", "Cupo"]):
                    continue
                    
                amount = 0
                cuota_info = ""
                
                # Check for installment purchases (cuota/valor cuota)
                cuota_match = re.search(r"(\d{2}/\d{2})\s*\$\s*([\d\.]+)", rest)
                if cuota_match:
                    cuota_info = cuota_match.group(1)
                    amount_str = cuota_match.group(2).replace(".", "")
                    amount = int(amount_str)
                    desc = f"{desc} (Cuota {cuota_info})"
                else:
                    first_num_match = re.match(r"^([\d\.]+)", rest)
                    if first_num_match:
                        amount = int(first_num_match.group(1).replace(".", ""))
                        
                transactions.append({
                    "date": date,
                    "description": f"{lugar} {desc}".strip(),
                    "amount": -amount,
                    "type": "EXPENSE"
                })
            else:
                m = pattern_no_lugar.match(line)
                if m:
                    date = m.group(1).strip()
                    desc = m.group(2).strip()
                    rest = m.group(3).strip()
                    
                    if any(x in line for x in ["Total", "Monto"]):
                        continue
                        
                    amount = 0
                    first_num_match = re.match(r"^([\d\.]+)", rest)
                    if first_num_match:
                        amount = int(first_num_match.group(1).replace(".", ""))
                        
                    is_credit = any(x in desc.upper() for x in ["DCTO", "ABONO", "PAGO"])
                    
                    transactions.append({
                        "date": date,
                        "description": desc,
                        "amount": amount if is_credit else -amount,
                        "type": "INCOME" if is_credit else "EXPENSE"
                    })
                    
        return {
            "success": True,
            "rawText": full_text,
            "billingPeriod": billing_period,
            "cardNumber": card_number,
            "transactions": transactions
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python lider.py <pdf_path> <password>"}))
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    password = sys.argv[2]
    
    result = parse_pdf(pdf_path, password)
    print(json.dumps(result, ensure_ascii=False))
