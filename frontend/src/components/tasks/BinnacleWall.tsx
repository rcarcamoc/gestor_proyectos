import { type FC, useState, useEffect } from "react";
import { MessageSquare, History, User, AtSign } from "lucide-react";
import { format } from "date-fns";
import api from "../../api/axios";
import { cn } from "../../lib/utils";

interface BinnacleWallProps {
  taskId: number;
}

export const BinnacleWall: FC<BinnacleWallProps> = ({ taskId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await api.get(`/task_logs/${taskId}`);
      setLogs(res.data);
    } catch (e) {
      console.error("Error fetching logs", e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [taskId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await api.post("/task_logs/", {
        task_id: taskId,
        content: newComment,
        log_type: "comment"
      });
      setNewComment("");
      fetchLogs();
    } catch (e) {
      console.error(e);
      alert("Error posting comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[500px]">
      <div className="flex items-center gap-2 mb-4 border-b border-border/50 pb-2">
        <MessageSquare size={18} className="text-primary" />
        <h3 className="font-bold text-sm text-text-base uppercase tracking-wider">Bitácora / Muro</h3>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmitComment} className="mb-6 relative">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escribe un comentario o usa @ para mencionar..."
          className="w-full bg-surface/50 border border-border/50 rounded-xl p-3 text-sm focus:ring-2 ring-primary/20 transition-all resize-none min-h-[80px]"
        />
        <div className="flex justify-between items-center mt-2">
           <span className="text-[10px] text-text-muted flex items-center gap-1"><AtSign size={10}/> Tip: Menciona con @nombre</span>
           <button 
             type="submit" 
             disabled={isSubmitting}
             className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
           >
             {isSubmitting ? "Enviando..." : "Publicar"}
           </button>
        </div>
      </form>

      {/* Feed Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
        {logs.length === 0 ? (
          <p className="text-center text-text-muted text-xs py-10 italic">No hay actividad registrada aún.</p>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={cn(
                "flex gap-3 p-3 rounded-xl border transition-all",
                log.log_type === 'event' 
                  ? "bg-white/5 border-transparent" 
                  : "bg-surface border-border/30 shadow-sm"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                log.log_type === 'event' ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
              )}>
                {log.log_type === 'event' ? <History size={14} /> : <User size={14} />}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-bold text-text-base">{log.user_name}</span>
                  <span className="text-[10px] text-text-muted">{format(new Date(log.created_at), "HH:mm · MMM d")}</span>
                </div>
                <p className={cn(
                  "text-sm",
                  log.log_type === 'event' ? "text-text-muted italic" : "text-text-base"
                )}>
                  {log.content}
                </p>
                {log.new_status && (
                   <div className="mt-2 flex items-center gap-2">
                       <span className="text-[10px] uppercase font-bold text-text-muted">Estado:</span>
                       <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-bold">
                         {log.new_status}
                       </span>
                   </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
