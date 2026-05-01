import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv("../.env")

def main():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("No API Key")
        return
    genai.configure(api_key=api_key)
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)

if __name__ == "__main__":
    main()
