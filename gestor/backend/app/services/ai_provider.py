import os
import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

try:
    from groq import Groq, AsyncGroq
    import groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

@dataclass
class ToolCall:
    name: str
    args: Dict[str, Any]

@dataclass
class AIResponse:
    text: Optional[str]
    tool_calls: List[ToolCall]

class AIProvider:
    def __init__(self):
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        
        self.groq_client = None
        if GROQ_AVAILABLE and self.groq_api_key:
            self.groq_client = AsyncGroq(api_key=self.groq_api_key)
            
        if self.gemini_api_key:
            genai.configure(api_key=self.gemini_api_key)

    async def generate_response(
        self,
        system_prompt: str,
        history: List[Dict[str, str]], # [{"role": "user"|"assistant", "content": "..."}]
        new_message: str,
        tools_schema: List[Dict[str, Any]] = None
    ) -> AIResponse:
        
        if self.groq_client:
            try:
                return await self._call_groq(system_prompt, history, new_message, tools_schema)
            except Exception as e:
                logging.warning(f"Groq falló ({str(e)}). Haciendo fallback a Gemini.")
                
        if self.gemini_api_key:
            return await self._call_gemini(system_prompt, history, new_message, tools_schema)
            
        raise Exception("No hay proveedores de IA disponibles (falta GROQ_API_KEY y GEMINI_API_KEY)")

    async def _call_groq(self, system_prompt: str, history: List[Dict[str, str]], new_message: str, tools_schema: List[Dict[str, Any]]) -> AIResponse:
        messages = [{"role": "system", "content": system_prompt}]
        for msg in history:
            role = "assistant" if msg["role"] == "model" else msg["role"]
            messages.append({"role": role, "content": msg["content"]})
        messages.append({"role": "user", "content": new_message})
        
        # Formatear tools para Groq (OpenAI format)
        groq_tools = []
        if tools_schema:
            for schema in tools_schema:
                groq_tools.append({
                    "type": "function",
                    "function": schema
                })

        kwargs = {
            "model": "llama-3.3-70b-versatile",
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 1024,
        }
        if groq_tools:
            kwargs["tools"] = groq_tools
            
        response = await self.groq_client.chat.completions.create(**kwargs)
        
        message = response.choices[0].message
        
        tool_calls = []
        if message.tool_calls:
            for tc in message.tool_calls:
                tool_calls.append(ToolCall(
                    name=tc.function.name,
                    args=json.loads(tc.function.arguments)
                ))
                
        return AIResponse(
            text=message.content,
            tool_calls=tool_calls
        )

    async def _call_gemini(self, system_prompt: str, history: List[Dict[str, str]], new_message: str, tools_schema: List[Dict[str, Any]]) -> AIResponse:
        # Gemini expects a specific structure for tools and uppercase types
        gemini_tools = None
        if tools_schema:
            # Deep copy and convert types to uppercase for Gemini
            import copy
            converted_schema = copy.deepcopy(tools_schema)
            for schema in converted_schema:
                self._fix_gemini_types(schema.get("parameters", {}))
            gemini_tools = [{"function_declarations": converted_schema}]

        model = genai.GenerativeModel(
            model_name='gemini-1.5-flash-latest',
            system_instruction=system_prompt,
            tools=gemini_tools
        )
        
        gemini_history = []
        for msg in history:
            # Gemini history only supports user/model
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})
            
        chat = model.start_chat(history=gemini_history)
        
        try:
            response = await chat.send_message_async(new_message)
        except Exception as e:
            error_str = str(e).lower()
            if "429" in error_str or "quota" in error_str or "resourceexhausted" in error_str:
                return AIResponse(text="Ups, estoy procesando demasiadas cosas a la vez y me quedé sin energía por este minuto (Límite de API). ¡Dame 60 segundos y vuelve a intentarlo! ⏱️", tool_calls=[])
            raise e

        tool_calls = []
        # Extraer texto de forma segura
        final_text = ""
        try:
            if response.candidates and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if part.text:
                        final_text += part.text
                    if part.function_call:
                        tool_calls.append(ToolCall(
                            name=part.function_call.name,
                            args=dict(part.function_call.args)
                        ))
        except Exception:
            # Si response.text falla (ej. solo hay function call), final_text queda vacío o lo que sacamos de parts
            pass
                    
        return AIResponse(
            text=final_text if final_text else None,
            tool_calls=tool_calls
        )

    def _fix_gemini_types(self, schema_node: Dict[str, Any]):
        """Recursivamente convierte tipos de JSON Schema a lo que Gemini espera (UPPERCASE)."""
        if not isinstance(schema_node, dict):
            return
            
        if "type" in schema_node and isinstance(schema_node["type"], str):
            schema_node["type"] = schema_node["type"].upper()
            
        if "properties" in schema_node:
            for prop in schema_node["properties"].values():
                self._fix_gemini_types(prop)
        
        if "items" in schema_node:
            self._fix_gemini_types(schema_node["items"])
