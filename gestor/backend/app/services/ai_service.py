import os
import google.generativeai as genai
import json
import logging

class AIService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-flash-lite-latest')
        else:
            self.api_key = None

    async def get_response(self, user_name: str, message: str):
        if not self.api_key:
            return f"Hola {user_name}, la integración con IA no está configurada aún (falta GEMINI_API_KEY)."

        prompt = (
            f"Eres el asistente inteligente de SmartTrack. Estás hablando con {user_name} en la plataforma web. "
            "Tu objetivo es ayudarle a gestionar sus proyectos, tareas y productividad. "
            "Sé breve, profesional y usa un tono motivador."
        )

        try:
            full_prompt = f"{prompt}\n\nUsuario: {message}\nAsistente:"
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            logging.error(f"Error in AI Service: {e}")
            return "Lo siento, tuve un problema procesando tu mensaje."
