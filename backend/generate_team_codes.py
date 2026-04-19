import os
import string
import secrets
from app.core.db import SessionLocal
from app.models.team import Team

def generate_codes():
    db = SessionLocal()
    teams = db.query(Team).all()
    print(f"Found {len(teams)} teams.")
    for t in teams:
        if not t.link_code:
            t.link_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            print(f"Generated code for {t.name}: {t.link_code}")
    db.commit()
    print("Done.")

if __name__ == "__main__":
    generate_codes()
