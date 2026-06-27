import re
import json

with open("scratch/lider_text.txt", "r", encoding="utf-8") as f:
    text = f.read()

# Regular expressions
# For general transactions with Lugar at the beginning:
# Examples:
# LA REINA 30/05/2026HIPER LA REINA., SANTIAGO (T) $ 141.621
# SANTIAGO CL 03/06/2026TICKETMASTER TC 2       0,00% (T) $ 276.000 $ 276.000 01/03 $ 92.000
# 111SANTIAGOCL 31/05/2026PEDRO JARPA (T) $ 5.850
#
# Let's match:
# Group 1: Lugar (anything before a date of format DD/MM/YYYY)
# Group 2: Date (DD/MM/YYYY)
# Group 3: Description (between Date and first $)
# Group 4: Rest of the line (amounts, cuotas, etc.)
pattern_lugar = re.compile(r"^([A-Z0-9\s\*ñÑáéíóúÁÉÍÓÚüÜ]+?)\s+(\d{2}/\d{2}/\d{4})\s*(.*?)\s*\$\s*([\d\.,]+.*)$", re.IGNORECASE)

# For transactions starting with date (like cargos/taxes):
# Example: 03/06/2026IMPUESTO DL 3475 C. CONTADO (T) $ 729
pattern_no_lugar = re.compile(r"^(\d{2}/\d{2}/\d{4})\s*(.*?)\s*\$\s*([\d\.,]+.*)$", re.IGNORECASE)

lines = text.split("\n")
transactions = []

billing_period = None
card_number = None

# Extract billing period
period_match = re.search(r"Per[íi]odo Facturado\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})", text, re.IGNORECASE)
if period_match:
    billing_period = {
        "start": period_match.group(1),
        "end": period_match.group(2)
    }

# Extract card number
card_match = re.search(r"N[úu]mero tarjeta\s+([\wX]+)", text, re.IGNORECASE)
if card_match:
    card_number = card_match.group(1)

# Flag to know if we are in the section of actual transactions
# We can scan all lines
for line in lines:
    line = line.strip()
    if not line:
        continue
    
    # Try pattern with Lugar first
    m = pattern_lugar.match(line)
    if m:
        lugar = m.group(1).strip()
        date = m.group(2).strip()
        desc = m.group(3).strip()
        rest = m.group(4).strip()
        
        # Check if this is a header or footer or summary line
        if "Total" in line or "Período" in line or "Saldo" in line or "Cupo" in line:
            continue
            
        # Parse rest to see if it's installment purchase
        # Example of rest for installment: 276.000 $ 276.000 01/03 $ 92.000
        # Example of rest for single purchase: 141.621
        amount = 0
        cuota_info = ""
        
        # Check if there is cuota format (e.g. 01/03 or 1/3)
        cuota_match = re.search(r"(\d{2}/\d{2})\s*\$\s*([\d\.]+)", rest)
        if cuota_match:
            cuota_info = cuota_match.group(1)
            amount_str = cuota_match.group(2).replace(".", "")
            amount = int(amount_str)
            desc = f"{desc} (Cuota {cuota_info})"
        else:
            # Single payment, amount is just the first number in rest
            first_num_match = re.match(r"^([\d\.]+)", rest)
            if first_num_match:
                amount = int(first_num_match.group(1).replace(".", ""))
        
        transactions.append({
            "date": date,
            "description": f"{lugar} {desc}".strip(),
            "amount": -amount,  # Expenses are negative
            "type": "EXPENSE"
        })
    else:
        # Try pattern without Lugar (taxes, commissions)
        m = pattern_no_lugar.match(line)
        if m:
            date = m.group(1).strip()
            desc = m.group(2).strip()
            rest = m.group(3).strip()
            
            if "Total" in line or "Monto" in line:
                continue
                
            amount = 0
            first_num_match = re.match(r"^([\d\.]+)", rest)
            if first_num_match:
                amount = int(first_num_match.group(1).replace(".", ""))
            
            # Check if it's an abono (credit/payment)
            # If desc or line has a negative amount sign or indicates abono/descuento/pago:
            # Wait, Lider writes: "25/06/2026-100% DCTO COM ADM|MANTENCION (T) $ 0"
            # If amount is 0, we can still include it or filter it. Let's include it.
            is_credit = False
            # Check if there's a minus sign in front of description, or if it says DCTO/ABONO
            if "DCTO" in desc.upper() or "ABONO" in desc.upper() or "PAGO" in desc.upper():
                is_credit = True
                
            transactions.append({
                "date": date,
                "description": desc,
                "amount": amount if is_credit else -amount,
                "type": "INCOME" if is_credit else "EXPENSE"
            })

print(json.dumps({
    "billingPeriod": billing_period,
    "cardNumber": card_number,
    "transactions": transactions
}, indent=2, ensure_ascii=False))
