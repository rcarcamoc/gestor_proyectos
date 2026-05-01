from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, BigInteger, Text, func
from .organization import Base

class TelegramAccount(Base):
    __tablename__ = "telegram_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    telegram_chat_id = Column(BigInteger, unique=True, index=True, nullable=False)
    vinculado_en = Column(DateTime, server_default=func.now())
    activo = Column(Boolean, default=True)

class VinculationToken(Base):
    __tablename__ = "vinculation_tokens"

    token = Column(String(10), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    expira_en = Column(DateTime, nullable=False)
    usado = Column(Boolean, default=False)

class AlertaEnviada(Base):
    __tablename__ = "alertas_enviadas"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), index=True, nullable=False)
    tipo_alerta = Column(String(50), nullable=False) # '48h', '24h', 'dia_vencimiento'
    enviada_en = Column(DateTime, server_default=func.now())
    telegram_chat_id = Column(BigInteger, nullable=False)

class Redaccion(Base):
    __tablename__ = "redacciones"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    tipo = Column(String(100)) # 'retraso', 'actualizacion', 'solicitud'
    tono = Column(String(50))  # 'formal', 'directo', 'empatico'
    input_usuario = Column(Text)
    output_generado = Column(Text)
    creado_en = Column(DateTime, server_default=func.now())

class ConversationLog(Base):
    """
    Registra las interacciones (consultas) enviadas por el bot a los usuarios.
    Permite auditar el comportamiento del PM 'Mia' y las intenciones capturadas.
    """
    __tablename__ = "conversation_logs"

    id = Column(Integer, primary_key=True, index=True)
    telegram_chat_id = Column(BigInteger, index=True, nullable=False)
    user_message = Column(Text, nullable=True)
    intent_detected = Column(String(100), nullable=True)
    bot_response = Column(Text, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
