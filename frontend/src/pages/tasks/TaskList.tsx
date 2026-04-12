import { type FC, useState, useEffect } from "react";
import { CheckSquare, Clock, AlertCircle, Plus, X, Play, Square, Users, LayoutDashboard, Flame } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import api from "../../api/axios";
import { BinnacleWall } from "../../components/tasks/BinnacleWall";

export const TaskList: FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [filter, setFilter] = useState(searchParams.get("filter") || "All");
  const [searchQuery, setSearchQuery] = useState("");
  const initialProjectId = searchParams.get("project");
  const initialStatus = searchParams.get("status");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState<any>(null);
  const [currentTask, setCurrentTask] = useState<any>(null);

  const [formData, setFormData] = useState({
    id: null as number | null,
    name: "",
    project_id: "",
    priority: "Medium",
    estimated_hours: 4.0,
    assignee_id: "",
    status: "Pending",
    description: "",
    start_date: "",
    deadline: ""
  });

  const [suggestedAssignees, setSuggestedAssignees] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [tskRes, prjRes, teamRes] = await Promise.all([
        api.get('/tasks/'),
        api.get('/projects/'),
        api.get('/teams/')
      ]);
      setTasks(tskRes.data);
      setProjects(prjRes.data);
      if (teamRes.data.length > 0) {
        // Fetching members for first team
        const membersRes = await api.get(`/teams/${teamRes.data[0].id}/members`);
        setTeamMembers(membersRes.data || []);
        setFormData(prev => ({...prev, team_id: teamRes.data[0].id} as any));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getSuggestions = async (task_id: number) => {
     try {
        const tId = (formData as any).team_id;
        if (tId) {
           const res = await api.get(`/engine/suggest-assignees?task_id=${task_id}&team_id=${tId}`);
           setSuggestedAssignees(res.data.candidates);
           console.log("Suggestions loaded", res.status);
        }
     } catch (e) { console.error(e); }
  }

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.project_id) {
       alert("Name and Project are required");
       return;
    }

    const postData = {
        name: formData.name, 
        project_id: parseInt(formData.project_id),
        priority: formData.priority,
        estimated_hours: parseFloat(formData.estimated_hours.toString()),
        assignee_id: formData.assignee_id ? parseInt(formData.assignee_id) : undefined
    };

    // Predictive checking
    if (postData.assignee_id) {
       try {
         const impactRes = await api.post('/engine/check-cross-project-impact', {
             user_id: postData.assignee_id,
             estimated_hours: postData.estimated_hours
         });
         if (impactRes.data.cross_project_warning?.has_impact) {
             setWarningData({ ...impactRes.data.cross_project_warning, pendingData: postData });
             setShowWarningModal(true);
             return; // Stop and wait for user confirmation
         }
       } catch (e) {
         console.warn("Could not check impact", e);
       }
    }

    if (formData.id) {
       await confirmTaskUpdate(postData, formData.id);
    } else {
       await confirmTaskCreation(postData);
    }
  };

  const confirmTaskUpdate = async (postData: any, id: number) => {
    try {
      await api.patch(`/tasks/${id}`, postData);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error updating task");
    }
  };

  const resetForm = () => {
    setFormData({ id: null, name: "", project_id: "", priority: "Medium", estimated_hours: 4.0, assignee_id: "", status: "Pending", description: "", start_date: "", deadline: "" });
    setIsModalOpen(false);
    setShowWarningModal(false);
  };

  const confirmTaskCreation = async (postData: any) => {
    try {
      await api.post('/tasks/', postData);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Error creating task");
    }
  };

  const updateTaskStatus = async (id: number, newStatus: string) => {
     try {
        await api.patch(`/tasks/${id}`, { status: newStatus });
        fetchData();
     } catch (e) { console.error(e); }
  }

  const toggleTaskStatus = (task: any) => {
    const newStatus = task.status === "Completed" ? "Pending" : "Completed";
    updateTaskStatus(task.id, newStatus);
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === "Active" && task.status === "Completed") return false;
    if (filter === "Completed" && task.status !== "Completed") return false;
    if (filter === "ActionNeeded" && (task.status === "Completed" || task.status === "Pending")) {
         // Dummy simplification: Only show Blocked or Overdue (we approximate overdue here or just rely on status)
         if (task.status !== "Blocked") return false; 
    }
    
    if (initialProjectId && task.project_id.toString() !== initialProjectId) return false;
    if (initialStatus && task.status !== initialStatus) return false;

    if (searchQuery && !task.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const clearFilters = () => {
     setSearchParams({});
     setFilter("All");
     navigate("/tasks");
  };

  if (isLoading) return <div className="p-12 text-center text-text-muted">Loading tasks...</div>;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base flex items-center gap-2">
            <CheckSquare className="text-secondary" size={24} />
            Tasks Management
          </h2>
          <p className="text-sm text-text-muted mt-1">Organize, prioritize, and track your tasks from DB.</p>
          {(initialProjectId || initialStatus || filter !== "All") && (
             <button onClick={clearFilters} className="mt-2 text-xs text-secondary hover:underline flex items-center gap-1">
                <X size={12} /> Limpiar Filtros
             </button>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md text-sm font-medium shadow-md shadow-secondary/20 hover:bg-secondary/90 transition-all hover:scale-105"
          >
            <Plus size={16} />
            + New Task
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-surface/30 border border-border/50 rounded-xl overflow-hidden glass-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-surface/50 text-xs uppercase tracking-wider text-text-muted">
                <th className="px-6 py-4 font-semibold">Task Name</th>
                <th className="px-6 py-4 font-semibold">Project</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => { setCurrentTask(task); setIsDetailOpen(true); getSuggestions(task.id); }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleTaskStatus(task); }}
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                          task.status === "Completed"
                            ? "bg-accent-green/20 border-accent-green text-accent-green"
                            : "border-text-muted/50 hover:border-secondary"
                        )}
                      >
                        {task.status === "Completed" && <CheckSquare size={14} />}
                      </button>
                      <span className={cn("font-medium text-sm", task.status === "Completed" ? "text-text-muted line-through" : "text-text-base")}>
                        {task.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted">
                    {projects.find(p => p.id === task.project_id)?.name || `Project ${task.project_id}`}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium border bg-primary/10 text-primary border-primary/20">
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, 'In Progress'); }} className="text-secondary hover:underline text-xs mr-2">Start</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {isDetailOpen && currentTask && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-md p-4">
          <div className="glass-card w-full max-w-2xl p-6 relative animate-in fade-in zoom-in duration-300 border border-border/50">
             <button onClick={() => setIsDetailOpen(false)} className="absolute top-4 right-4 text-text-muted">
              <X size={20} />
             </button>
             <h2 className="text-2xl font-bold text-text-base mb-2">{currentTask.name}</h2>
             <div className="flex gap-2 mb-6">
                 <span className="px-2 py-1 bg-surface text-xs rounded border border-border/50">{projects.find(p => p.id === currentTask.project_id)?.name}</span>
                 <span className="px-2 py-1 bg-surface text-xs rounded border border-border/50">{currentTask.status}</span>
                 <span className="px-2 py-1 bg-surface text-xs rounded border border-border/50">{currentTask.priority}</span>
             </div>

             <div className="grid grid-cols-2 gap-6 bg-surface/50 p-4 rounded-xl border border-border/50 mb-6">
                <div>
                   <h4 className="text-sm font-bold text-text-base mb-2 flex items-center gap-2"><Clock size={16}/> Time Tracking</h4>
                   <div className="flex gap-2">
                       <button className="flex items-center gap-1 bg-accent-green/20 text-accent-green px-3 py-1.5 rounded-lg text-xs font-bold w-full justify-center">
                           <Play size={14} /> Start Timer (API)
                       </button>
                       <button className="flex items-center gap-1 bg-accent-red/20 text-accent-red px-3 py-1.5 rounded-lg text-xs font-bold w-full justify-center">
                           <Square size={14} /> Stop
                       </button>
                   </div>
                   <p className="text-xs text-text-muted mt-2">Est: {currentTask.estimated_hours}h | Act: {currentTask.actual_hours}h</p>
                </div>

                <div>
                   <h4 className="text-sm font-bold text-accent-red mb-2 flex items-center gap-2"><AlertCircle size={16}/> Emergency Logic</h4>
                   <button onClick={() => { updateTaskStatus(currentTask.id, 'Blocked'); alert("Task pushed as Critical to Engine.") }} className="w-full bg-accent-red text-white text-xs font-bold py-2 rounded-lg text-center shadow shadow-accent-red/20 mb-2">
                      Mark as Critical (Emergency)
                   </button>
                   <button 
                     onClick={() => {
                       setFormData({
                         id: currentTask.id,
                         name: currentTask.name,
                         project_id: currentTask.project_id.toString(),
                         priority: currentTask.priority,
                         estimated_hours: currentTask.estimated_hours,
                         assignee_id: currentTask.assignee_id?.toString() || "",
                         status: currentTask.status,
                         description: currentTask.description || "",
                         start_date: currentTask.start_date || "",
                         deadline: currentTask.deadline || ""
                       });
                       setIsDetailOpen(false);
                       setIsModalOpen(true);
                     }}
                     className="w-full bg-surface text-text-base border border-border/50 text-xs font-bold py-2 rounded-lg text-center"
                   >
                      Editar Detalles / Fechas
                   </button>
                </div>
             </div>

             {/* Bitácora / Muro Section */}
             <div className="border-t border-border/50 pt-6 mb-6">
                <BinnacleWall taskId={currentTask.id} />
             </div>

             <div>
                <h4 className="text-sm font-bold text-text-base mb-4 flex items-center gap-2"><Users size={16}/> Engine Suggestions (Assignees)</h4>
                {suggestedAssignees.length === 0 ? <p className="text-xs text-text-muted">Loading suggestions or no team...</p> : (
                   <div className="space-y-3">
                      {suggestedAssignees.map(c => (
                         <div key={c.user_id} className="flex flex-col bg-surface p-3 rounded-lg border border-border/50 text-sm">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-bold text-gray-800 dark:text-gray-200">
                                  {c.name} 
                                  {c.is_recommended && <span className="ml-2 text-xs bg-accent-green/20 text-accent-green px-2 py-0.5 rounded-full">Recomendado</span>}
                                </span>
                                <span className="font-bold text-blue-600">{c.score_total}% Match</span>
                            </div>
                            <p className="text-xs text-text-muted mb-2">{c.justification}</p>
                            
                            <div className="flex text-xs items-center gap-4 text-gray-500 w-full mb-1">
                                <div className="flex-1">
                                  <div className="flex justify-between mb-1"><span>Skills</span> <span>{c.match_percentage}%</span></div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full"><div className="bg-purple-500 h-1.5 rounded-full" style={{width: `${c.match_percentage}%`}}></div></div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex justify-between mb-1"><span>Disp.</span> <span>{c.availability_percentage}%</span></div>
                                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full"><div className="bg-green-500 h-1.5 rounded-full" style={{width: `${c.availability_percentage}%`}}></div></div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs mt-2 justify-end">
                               {!c.has_conflicts ? <CheckSquare size={14} className="text-accent-green"/> : <AlertCircle size={14} className="text-accent-red"/>}
                               <span className={c.has_conflicts ? "text-accent-red font-semibold" : "text-text-muted"}>
                                  {c.has_conflicts ? "Sobrecarga inminente" : "Libre de conflictos"}
                               </span>
                            </div>
                         </div>
                      ))}
                   </div>
                )}
             </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-md p-4">
          <div className="glass-card w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-300 border border-border/50">
            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="absolute top-4 right-4 text-text-muted"><X size={20} /></button>
            <h2 className="text-xl font-bold text-text-base mb-6">{formData.id ? "Edit Task" : "Create New Task"}</h2>
            <form onSubmit={addTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Task Title</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Project Classification</label>
                <select required value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base">
                   <option value="">Select a project...</option>
                   {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Priority</label>
                    <select value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base">
                       <option value="Low">Low</option>
                       <option value="Medium">Medium</option>
                       <option value="High">High</option>
                       <option value="Critical">Critical</option>
                    </select>
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Est. Hours</label>
                    <input type="number" step="0.5" required value={formData.estimated_hours} onChange={e => setFormData({...formData, estimated_hours: parseFloat(e.target.value)})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base" />
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Start Date</label>
                    <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base text-xs" />
                 </div>
                 <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Deadline</label>
                    <input type="date" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base text-xs" />
                 </div>
              </div>
              <div>
                 <label className="block text-xs font-semibold text-text-muted uppercase mb-2">Status</label>
                 <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base">
                    <option value="Pending">Pendiente</option>
                    <option value="Scheduled">Programada</option>
                    <option value="In Progress">En Curso</option>
                    <option value="Pending Response Op">Pendiente Respuesta Operación</option>
                    <option value="Pending Response Client">Pendiente Respuesta Cliente</option>
                    <option value="Blocked">Bloqueada</option>
                    <option value="Completed">Completada</option>
                 </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase mb-2 flex items-center justify-between">
                  Assignee
                  <button type="button" onClick={() => {/* Trigger suggestion panel here if desired */}} className="text-secondary hover:underline">Sugerir Asignación</button>
                </label>
                <select value={formData.assignee_id} onChange={e => setFormData({...formData, assignee_id: e.target.value})} className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 text-text-base">
                   <option value="">Unassigned</option>
                   {teamMembers.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.user?.full_name || `User ${m.user_id}`}</option>
                   ))}
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 mt-2 bg-secondary text-white font-medium rounded-xl hover:bg-secondary/90">
                {formData.id ? "Actualizar Tarea" : "Add Task"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Warning Impact Modal */}
      {showWarningModal && warningData && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] bg-background/90 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg p-6 relative border-2 border-accent-red/50 shadow-2xl animate-in zoom-in duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={32} />
              <h2 className="text-xl font-bold">¡Riesgo de Sobrecarga Cross-Proyecto!</h2>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {warningData.recommendation}
            </p>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-red-800 dark:text-red-400 text-sm mb-2">Proyectos Afectados:</h3>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                {warningData.affected_projects?.map((proj: string, idx: number) => (
                  <li key={idx}>{proj}</li>
                ))}
              </ul>
              {warningData.affected_projects?.length === 0 && <span className="text-sm">Ninguno extra, carga pura del usuario excedida.</span>}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <button 
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
              >
                Cancelar y reasignar
              </button>
              <button 
                onClick={() => confirmTaskCreation(warningData.pendingData)}
                className="px-4 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700"
              >
                Asignar de todas formas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
