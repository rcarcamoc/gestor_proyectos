from typing import Callable, Dict, Any, List

class Tool:
    def __init__(
        self,
        name: str,
        description: str,
        schema: Dict[str, Any],
        handler: Callable,
        risk_level: str = "Bajo", # 'Bajo', 'Medio', 'Alto'
        allowed_roles: List[str] = None
    ):
        self.name = name
        self.description = description
        self.schema = schema
        self.handler = handler
        self.risk_level = risk_level
        # Si no se especifica, todos los roles permitidos
        self.allowed_roles = allowed_roles or ["owner", "leader", "member"]

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Tool] = {}

    def register(self, tool: Tool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Tool:
        return self._tools.get(name)

    def get_all_schemas(self) -> List[Dict[str, Any]]:
        schemas = []
        for tool in self._tools.values():
            schemas.append({
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.schema
            })
        return schemas

# Instancia global (podría inyectarse también)
registry = ToolRegistry()
