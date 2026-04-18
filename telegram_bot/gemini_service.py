import os
import google.generativeai as genai
import json
import logging

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            logging.error("GEMINI_API_KEY not found in environment")

    async def extract_intent(self, text: str):
        """
        Extracts intent and entities from user text using Gemini.
        """
        prompt = f"""
        Analiza el siguiente mensaje de un usuario para una aplicación de gestión de proyectos (SmartTrack).
        Extrae la intención principal y las entidades relevantes (proyecto, tarea, fecha, responsable, etc.).

        Mensaje: "{text}"

        Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
        {{
            "intent": "create_project" | "create_task" | "get_summary" | "get_tasks" | "write_assistant" | "anti_paralysis" | "unknown",
            "entities": {{
                "project_name": "nombre si aplica",
                "task_name": "nombre si aplica",
                "deadline": "fecha si aplica",
                "assignee": "persona si aplica",
                "urgency": "alta/media/baja"
            }},
            "confidence": 0.0 a 1.0
        }}
        """
        try:
            response = self.model.generate_content(prompt)
            # Limpiar la respuesta para asegurar que sea JSON válido
            content = response.text.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            return json.loads(content)
        except Exception as e:
            logging.error(f"Error in Gemini Intent Extraction: {e}")
            return {"intent": "unknown", "entities": {}, "confidence": 0}

    async def generate_response(self, context_prompt: str, user_input: str):
        """
        Generates a conversational response.
        """
        full_prompt = f"{context_prompt}\n\nUsuario dice: {user_input}\nAsistente:"
        try:
            response = self.model.generate_content(full_prompt)
            return response.text
        except Exception as e:
            logging.error(f"Error in Gemini Response Generation: {e}")
            return "Lo siento, tuve un problema procesando tu mensaje. ¿Podrías intentarlo de nuevo?"
