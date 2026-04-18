import { useState, useEffect } from 'react';
import api from '../api/axios';

const TelegramVinculation = () => {
  const [status, setStatus] = useState<{ is_linked: boolean; telegram_chat_id: number | null } | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ token: string; expires_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchStatus = async () => {
    try {
      const response = await api.get('/telegram/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Error fetching telegram status', error);
    } finally {
      setLoading(false);
    }
  };

  const generateToken = async () => {
    setGenerating(true);
    try {
      const response = await api.post('/telegram/generate-token');
      setTokenInfo(response.data);
    } catch (error) {
      console.error('Error generating token', error);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-4 mb-6">
        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.33-.26-1.98-.48-.8-.27-1.43-.42-1.37-.89.03-.25.38-.51 1.03-.78 4.04-1.76 6.74-2.92 8.09-3.48 3.85-1.6 4.64-1.88 5.17-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.02.07-.02.13-.03.19z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">SmartTrack Bot</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Gestiona tus proyectos desde Telegram</p>
        </div>
      </div>

      {status?.is_linked ? (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 p-4 rounded-lg">
          <div className="flex items-center gap-3 text-green-700 dark:text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold">¡Cuenta vinculada con éxito!</span>
          </div>
          <p className="mt-2 text-sm text-green-600 dark:text-green-500">
            Tu cuenta de Telegram está conectada correctamente. Ya puedes usar el bot para gestionar tus tareas.
          </p>
          <button
            onClick={generateToken}
            className="mt-4 text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
          >
            Vincular otra cuenta o regenerar token
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="prose dark:prose-invert text-sm">
            <p>Conecta SmartTrack con Telegram para:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Recibir alertas proactivas de tus vencimientos.</li>
              <li>Crear proyectos y tareas con lenguaje natural.</li>
              <li>Obtener resúmenes diarios de tu actividad.</li>
              <li>Usar el asistente de redacción con IA.</li>
            </ul>
          </div>

          {!tokenInfo ? (
            <button
              onClick={generateToken}
              disabled={generating}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {generating ? 'Generando...' : 'Vincular cuenta de Telegram'}
            </button>
          ) : (
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-6 rounded-lg text-center">
              <p className="text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Tu código de vinculación</p>
              <div className="text-4xl font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 my-4">
                {tokenInfo.token}
              </div>
              <p className="text-xs text-gray-500 mb-6">
                Este código expira en {new Date(tokenInfo.expires_at).toLocaleTimeString()}
              </p>

              <div className="text-left text-sm space-y-4 bg-white dark:bg-gray-800 p-4 rounded border border-gray-100 dark:border-gray-700">
                <p className="font-bold flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full">1</span>
                  Busca a <a href="https://t.me/SmartTrackPMBot" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">@SmartTrackPMBot</a> en Telegram
                </p>
                <p className="font-bold flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full">2</span>
                  Envía el comando: <code className="bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">/vincular</code>
                </p>
                <p className="font-bold flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full">3</span>
                  Cuando el bot te lo pida, envía este código.
                </p>
              </div>

              <button
                onClick={() => setTokenInfo(null)}
                className="mt-6 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Cancelar y volver
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TelegramVinculation;
