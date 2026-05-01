import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Send, Bell, CheckCircle2 } from 'lucide-react';

const TelegramVinculation = () => {
  const [status, setStatus] = useState<{ is_linked: boolean; telegram_chat_id: number | null } | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; expires_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setError(null);
    try {
      const response = await api.get('/telegram/status');
      setStatus(response.data);
    } catch (error: any) {
      console.error('Error fetching telegram status', error);
      const msg = error.response?.data?.detail || 'No se pudo conectar con el servidor backend.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await api.post('/telegram/generate-token');
      setTokenInfo(response.data);
    } catch (error: any) {
      console.error('Error generating token', error);
      const msg = error.response?.data?.detail || 'Error de conexión o fallo en el servidor.';
      setError(msg);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 glass-card border border-border/50 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center gap-6 mb-8">
        <div className="p-4 bg-primary/10 rounded-2xl shadow-inner">
          <Send className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-text-base tracking-tight">SmartTrack Bot</h2>
          <p className="text-text-muted text-sm mt-1">Gestiona tus proyectos y tareas desde Telegram</p>
        </div>
      </div>

      {status?.is_linked ? (
        <div className="bg-accent-green/10 border border-accent-green/20 p-6 rounded-2xl">
          <div className="flex items-center gap-3 text-accent-green">
            <CheckCircle2 size={24} />
            <span className="font-bold text-lg">¡Cuenta vinculada con éxito!</span>
          </div>
          <p className="mt-3 text-sm text-text-base/80 leading-relaxed">
            Tu cuenta de Telegram está conectada correctamente. Ya puedes recibir notificaciones y usar los comandos proactivos.
          </p>
          <button
            onClick={generateToken}
            className="mt-6 text-sm font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
          >
            Vincular otra cuenta o regenerar token
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-surface/50 rounded-xl border border-border/30 flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg text-accent-yellow"><Bell size={16}/></div>
              <div>
                <p className="text-xs font-bold text-text-base">Alertas Proactivas</p>
                <p className="text-[10px] text-text-muted mt-1">Recibe recordatorios antes de que tus tareas venzan.</p>
              </div>
            </div>
            <div className="p-4 bg-surface/50 rounded-xl border border-border/30 flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary"><Send size={16}/></div>
              <div>
                <p className="text-xs font-bold text-text-base">Lenguaje Natural</p>
                <p className="text-[10px] text-text-muted mt-1">Crea tareas simplemente hablando con el bot.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-xs font-bold animate-pulse flex items-center gap-3">
              <span className="flex-shrink-0">⚠️</span>
              {error}
            </div>
          )}

          <div className="bg-surface/30 border border-border/30 p-6 rounded-2xl">
            <h3 className="text-sm font-bold text-text-base mb-4 uppercase tracking-wider">Pasos para la vinculación</h3>
            <div className="space-y-4">
              <p className="text-sm flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 bg-primary text-white text-[10px] font-bold rounded-full mt-0.5">1</span>
                <span>Haz clic en el botón de abajo para obtener tu código secreto.</span>
              </p>
              <p className="text-sm flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 bg-primary text-white text-[10px] font-bold rounded-full mt-0.5">2</span>
                <span>Busca a <a href="https://t.me/Alertas_rickbot" target="_blank" rel="noreferrer" className="text-primary font-bold hover:underline">@Alertas_rickbot</a> en Telegram y envía <code className="bg-surface px-1.5 py-0.5 rounded border border-border/50 text-accent-yellow font-mono">/vincular</code>.</span>
              </p>
              <p className="text-sm flex items-start gap-4">
                <span className="flex items-center justify-center w-6 h-6 bg-primary text-white text-[10px] font-bold rounded-full mt-0.5">3</span>
                <span>Cuando el bot te lo pida, envía el código que aparecerá aquí.</span>
              </p>
            </div>
          </div>

          {!tokenInfo ? (
            <button
              onClick={() => {
                console.log('Solicitando token de Telegram...');
                generateToken();
              }}
              disabled={generating}
              className="w-full py-4 px-6 bg-accent-yellow text-background font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-accent-yellow/20 disabled:opacity-50 flex justify-center items-center gap-3"
            >
              {generating ? (
                <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
              ) : (
                <Send size={20} />
              )}
              {generating ? 'GENERANDO...' : 'OBTENER CÓDIGO DE VINCULACIÓN'}
            </button>
          ) : (
            <div className="bg-primary/5 border border-primary/20 p-8 rounded-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
              <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted font-black mb-4">Tu código de vinculación</p>
              <div className="text-5xl font-mono font-black tracking-[0.2em] text-primary my-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]">
                {tokenInfo.token}
              </div>
              <p className="text-xs text-text-muted mb-4 italic">
                Este código expira a las {new Date(tokenInfo.expires_at).toLocaleTimeString()}
              </p>
              
              <button
                onClick={() => setTokenInfo(null)}
                className="text-xs font-bold text-text-muted hover:text-text-base transition-colors uppercase tracking-widest"
              >
                ¿Necesitas otro código? Regenerar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TelegramVinculation;
