import os
import asyncio
from dotenv import load_dotenv

# Asegurar cargar el .env del directorio raíz
load_dotenv('../.env')

from gemini_service import GeminiService

async def main():
    service = GeminiService()
    
    print("Testing Intent Extraction...")
    intent = await service.extract_intent("crea una tarea para revisar el presupuesto antes del viernes")
    print("Intent Result:")
    print(intent)
    
    print("\nTesting Conversational Response...")
    context = "Eres un asistente de pruebas."
    response = await service.generate_response(context, "¿Funciona la API de Gemini?")
    print("Response:")
    print(response)

if __name__ == "__main__":
    asyncio.run(main())
