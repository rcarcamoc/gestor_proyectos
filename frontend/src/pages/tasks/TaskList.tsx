import { type FC, useState } from "react";
import { CheckSquare, Clock, AlertCircle, Plus, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

// Mock data to demonstrate the premium UI
const INITIAL_TASKS = [
  { id: 1, title: "Design System Implementation", project: "Website Redesign", status: "In Progress", priority: "High", dueDate: "2026-04-10", assignee: "AI Assistant" },
  { id: 2, type: "bug", title: "Fix Authentication Flow", project: "Mobile App", status: "Todo", priority: "Critical", dueDate: "2026-04-06", assignee: "AI Assistant" },
  { id: 3, title: "Database Migration", project: "Backend V2", status: "Done", priority: "Medium", dueDate: "2026-04-01", assignee: "Dev Team" },
  { id: 4, title: "SEO Optimization", project: "Marketing Site", status: "Todo", priority: "Low", dueDate: "2026-04-15", assignee: "Marketing" },
];

export const TaskList: FC = () => {
  const [filter, setFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [tasks, setTasks] = useState(INITIAL_TASKS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const toggleTaskStatus = (id: number) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        return {
          ...task,
          status: task.status === "Done" ? "Todo" : "Done"
        };
      }
      return task;
    }));
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    setTasks([
      {
        id: Date.now(),
        title: newTaskTitle,
        project: "Unassigned",
        status: "Todo",
        priority: "Medium",
        dueDate: "No date",
        assignee: "Unassigned"
      },
      ...tasks
    ]);
    
    setNewTaskTitle("");
    setIsModalOpen(false);
  };

  const filteredTasks = tasks.filter(task => {
    // Tab filter
    if (filter === "Active" && task.status === "Done") return false;
    if (filter === "Completed" && task.status !== "Done") return false;
    
    // Search filter
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="text-secondary" size={24} />
            Tasks Management
          </h2>
          <p className="text-sm text-text-muted mt-1">Organize, prioritize, and track your tasks.</p>
        </div>

        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface/50 border border-border/50 rounded-md text-sm text-white placeholder-text-muted outline-none focus:border-secondary focus:ring-1 focus:ring-secondary"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-md text-sm font-medium shadow-md shadow-secondary/20 hover:bg-secondary/90 transition-all hover:scale-105"
          >
            <Plus size={16} />
            Add Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-border/50 pb-4">
        {["All", "Active", "Completed"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
              filter === tab 
                ? "bg-secondary/20 text-secondary border border-secondary/30" 
                : "text-text-muted hover:text-white hover:bg-white/5"
            )}
          >
            {tab}
          </button>
        ))}
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
                <th className="px-6 py-4 font-semibold">Priority</th>
                <th className="px-6 py-4 font-semibold text-right">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleTaskStatus(task.id)}
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center border transition-colors",
                          task.status === "Done" 
                            ? "bg-accent-green/20 border-accent-green text-accent-green" 
                            : "border-text-muted/50 hover:border-secondary"
                        )}
                      >
                        {task.status === "Done" && <CheckSquare size={14} />}
                      </button>
                      <span className={cn(
                        "font-medium text-sm transition-all",
                        task.status === "Done" ? "text-text-muted line-through" : "text-white group-hover:text-secondary"
                      )}>
                        {task.title}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-muted">
                    {task.project}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                      task.status === "Done" ? "bg-accent-green/10 text-accent-green border-accent-green/20"
                      : task.status === "In Progress" ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-surface text-text-muted border-border/50"
                    )}>
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {task.priority === "Critical" && <AlertCircle size={14} className="text-accent-red" />}
                      <span className={cn(
                        "text-xs font-medium",
                        task.priority === "Critical" ? "text-accent-red"
                        : task.priority === "High" ? "text-accent-yellow"
                        : "text-text-muted"
                      )}>
                        {task.priority}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-sm text-text-muted">
                      <Clock size={14} />
                      {task.dueDate}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    No tasks found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-md p-4">
          <div className="glass-card w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-300 border border-border/50">
            <button 
              onClick={() => setIsModalOpen(false)} 
              className="absolute top-4 right-4 text-text-muted hover:text-white transition-colors p-2"
            >
              <X size={20} />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-6">Create New Task</h2>
            
            <form onSubmit={addTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Task Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="What needs to be done?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-surface/50 border border-border/50 focus:border-secondary focus:ring-1 focus:ring-secondary outline-none text-white"
                />
              </div>
              
              <button
                type="submit"
                className="w-full py-2.5 mt-2 bg-secondary text-white font-medium rounded-xl hover:bg-secondary/90 transition-all hover:-translate-y-0.5"
              >
                Add Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
