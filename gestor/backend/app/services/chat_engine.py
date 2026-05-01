import logging
import json
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session

from app.models.user import User
from app.services.session_store import SessionStore
from app.services.context_builder import ContextBuilder
from app.services.tool_registry import ToolRegistry
from app.services.ai_provider import AIProvider

PM_SYSTEM_PROMPT = """
Eres Mia, la Project Manager IA de SmartTrack.
Tu objetivo es ayudar al usuario a gestionar sus tareas de forma amigable y proactiva.

REGLAS DE POLÍTICA (ESTRICTAS):
1. **Clarification Policy**: Si el usuario te pide una acción pero el contexto o el mensaje son ambiguos (ej. hay múltiples tareas con nombres similares, o falta fecha), DEBES pedir aclaración primero.
2. NUNCA inventes IDs o datos que no estén en el contexto inyectado.
3. Si el usuario pide ejecutar una acción pero no tiene permisos, explícale de forma empática por qué no puedes hacerlo.

El contexto del usuario se inyectará en cada mensaje nuevo.
"""

class ChatEngine:
    def __init__(self, db: Session, session_store: SessionStore, tool_registry: ToolRegistry):
        self.db = db
        self.session_store = session_store
        self.tool_registry = tool_registry
        self.context_builder = ContextBuilder(db)
        
        try:
            self.ai_provider = AIProvider()
        except Exception as e:
            logging.error(f"Error inicializando AIProvider: {e}")
            self.ai_provider = None

    async def process_message(self, user: User, session_id: str, message: str) -> Tuple[str, Dict[str, Any]]:
        if not self.ai_provider:
            return "El servicio de IA no está configurado (falta GROQ_API_KEY o GEMINI_API_KEY).", {}

        # 1. Recuperar historial y truncar para no agotar tokens (últimos 4 turnos)
        full_history = self.session_store.get_history(session_id)
        history = full_history[-4:] if len(full_history) > 4 else full_history
        
        # 2. Construir contexto
        ctx_dict = self.context_builder.build_user_context(user)
        ctx_str = self.context_builder.format_context_for_prompt(ctx_dict)

        # 3. Preparar mensaje con contexto (minimizando tokens)
        full_message = f"{ctx_str}\n\nUsuario: {message}"

        tools_schema = self.tool_registry.get_all_schemas()

        try:
            # 4. Llamar al proveedor
            response = await self.ai_provider.generate_response(
                system_prompt=PM_SYSTEM_PROMPT,
                history=history,
                new_message=full_message,
                tools_schema=tools_schema
            )
            
            # Revisar si devolvió function call
            if response.tool_calls:
                # Tomamos la primera llamada (por simplicidad, asumimos 1 por ahora)
                tc = response.tool_calls[0]
                func_name = tc.name
                func_args = tc.args
                
                tool = self.tool_registry.get_tool(func_name)
                if not tool:
                    return f"Lo siento, intenté usar la herramienta {func_name} pero no está disponible.", {}
                
                # 5. Authorization Policy
                if user.role not in tool.allowed_roles:
                    return f"Lo siento, necesitas rol de {', '.join(tool.allowed_roles)} para hacer esto.", {}
                    
                # 6. Confirmation Policy
                if tool.risk_level in ["Medio", "Alto"]:
                    return "Esta acción requiere confirmación.", {
                        "requires_confirmation": True,
                        "tool_name": func_name,
                        "tool_args": func_args,
                        "risk_level": tool.risk_level
                    }
                    
                # Ejecutar herramienta
                try:
                    result = await tool.handler(self.db, user, **func_args)
                except Exception as e:
                    result = f"Error ejecutando {func_name}: {str(e)}"
                    
                # Optimización TPM: Si no requiere reformateo, devolvemos directo
                if getattr(tool, 'requires_llm_formatting', True) == False:
                    self.session_store.add_message(session_id, "user", message)
                    self.session_store.add_message(session_id, "model", result)
                    return result, {"executed_tool": func_name}

                # Segunda pasada a la IA con el resultado
                second_message = json.dumps({"function_response": {"name": func_name, "response": result}})
                # Agregamos la llamada al history temporal para que la IA entienda
                temp_history = history.copy()
                temp_history.append({"role": "user", "content": full_message})
                temp_history.append({"role": "assistant", "content": f"Ejecutando {func_name}..."})
                
                second_response = await self.ai_provider.generate_response(
                    system_prompt=PM_SYSTEM_PROMPT,
                    history=temp_history,
                    new_message=second_message,
                    tools_schema=tools_schema
                )
                
                final_text = second_response.text or "Acción completada."
                
                self.session_store.add_message(session_id, "user", message)
                self.session_store.add_message(session_id, "model", final_text)
                
                return final_text, {"executed_tool": func_name}

            # Si no hay function_call
            final_text = response.text or ""
            self.session_store.add_message(session_id, "user", message)
            self.session_store.add_message(session_id, "model", final_text)
            return final_text, {}

        except Exception:
            logging.exception("Error en ChatEngine")
            return "Tuve un pequeño problema técnico procesando tu solicitud.", {}
