import { type FC } from "react";
import { FolderKanban, CheckSquare, Clock, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

interface KPIData {
  active_projects: number;
  pending_tasks: number;
  completed_tasks: number;
  blocked_tasks: number;
  overdue_tasks: number;
}

export const KPIWidgets: FC<{ data?: KPIData }> = ({ data }) => {
  if (!data) return null;

  const widgets = [
    {
      title: "Active Projects",
      value: data.active_projects,
      icon: FolderKanban,
      color: "text-primary",
      bgLight: "bg-primary/10",
      bgDark: "bg-primary/20",
      border: "border-primary/20"
    },
    {
      title: "Pending Tasks",
      value: data.pending_tasks,
      icon: CheckSquare,
      color: "text-warning",
      bgLight: "bg-warning/10",
      bgDark: "bg-warning/20",
      border: "border-warning/20"
    },
    {
      title: "Completed",
      value: data.completed_tasks,
      icon: Clock,
      color: "text-success",
      bgLight: "bg-success/10",
      bgDark: "bg-success/20",
      border: "border-success/20"
    },
    {
      title: "Action Needed",
      value: data.blocked_tasks + data.overdue_tasks,
      subtitle: `${data.overdue_tasks} overdue`,
      icon: AlertCircle,
      color: "text-danger",
      bgLight: "bg-danger/10",
      bgDark: "bg-danger/20",
      border: "border-danger/20",
      pulse: data.blocked_tasks + data.overdue_tasks > 0
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {widgets.map((widget, i) => {
        const Icon = widget.icon;
        return (
          <div 
            key={i} 
            className={cn(
              "glass-card p-5 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
              widget.border
            )}
            style={{ animationDelay: `${i * 100}ms` }}
          >
            {/* Ambient Background Glow */}
            <div className={cn("absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl transition-opacity opacity-50 group-hover:opacity-100", widget.bgDark)} />
            
            <div className="relative z-10 flex items-start justify-between">
              <div>
                <p className="text-text-muted text-sm font-medium mb-1">{widget.title}</p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-bold text-text-base tracking-tight">{widget.value}</h3>
                  {widget.subtitle && <span className="text-xs font-medium text-danger">{widget.subtitle}</span>}
                </div>
              </div>
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", widget.bgLight, widget.color)}>
                <Icon size={20} className={cn(widget.pulse && "animate-pulse")} />
              </div>
            </div>
            
            {/* Decorative line */}
            <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-transparent to-current opacity-20 w-full" style={{ color: "inherit" }} />
          </div>
        );
      })}
    </div>
  );
};
