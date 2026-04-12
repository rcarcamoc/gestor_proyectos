import { type FC, useMemo, useState } from "react";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { GripVertical, Clock, CalendarClock, Play, AlertCircle, Ban, CheckCircle2, Flame, ChevronDown, ChevronRight, Eye, MessageSquare } from "lucide-react";
import { cn } from "../../lib/utils";

const StatusIcon = ({ status, priority }: { status: string, priority?: string }) => {
  if (priority === 'High' || priority === 'Critical') return <Flame size={14} className="text-orange-500" />;
  switch (status) {
    case 'Scheduled': return <CalendarClock size={14} className="text-slate-400" />;
    case 'In Progress': return <Play size={14} className="text-blue-500" />;
    case 'Pending Response Op': return <span className="text-[12px]">👀</span>;
    case 'Pending Response Client': return <span className="text-[12px]">💬</span>;
    case 'Blocked': return <Ban size={14} className="text-red-500" />;
    case 'Completed': return <CheckCircle2 size={14} className="text-green-500" />;
    default: return <Clock size={14} className="text-slate-400" />;
  }
};

const TaskRow: FC<{ task: any, startDate: Date, daysCount: number, colorClass: string }> = ({ task, startDate, daysCount, colorClass }) => {
  const taskStart = task.start_date ? parseISO(task.start_date) : startDate;
  const taskEnd = task.deadline ? parseISO(task.deadline) : taskStart;

  let leftOffsetDays = differenceInDays(taskStart, startDate);
  let durationDays = differenceInDays(taskEnd, taskStart) + 1; // inclusive

  if (leftOffsetDays < 0) {
    durationDays += leftOffsetDays;
    leftOffsetDays = 0;
  }
  if (leftOffsetDays + durationDays > daysCount) {
    durationDays = daysCount - leftOffsetDays;
  }

  // Parse color. Tailwinds classes vs hex.
  const isHex = colorClass?.startsWith("#");
  const bgStyle = isHex ? { backgroundColor: colorClass } : {};

  return (
    <div className="group grid grid-cols-[250px_1fr] bg-surface/10 hover:bg-surface/30 border-b border-border/20 transition-colors relative z-10 pl-4">
      <div className="flex items-center gap-3 p-2 border-r border-border/40">
        <StatusIcon status={task.status} priority={task.priority} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text-base truncate">{task.name}</p>
        </div>
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-2 mr-2">
            <div className="w-5 h-5 rounded-full bg-secondary border border-surface flex items-center justify-center text-[9px] font-bold text-white uppercase" title={task.assignees[0].name}>
              {task.assignees[0].name.substring(0,2)}
            </div>
          </div>
        )}
      </div>

      <div className="relative flex">
        {Array.from({ length: daysCount }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-border/10 border-dashed" />
        ))}
        {durationDays > 0 && leftOffsetDays < daysCount && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-sm flex items-center px-2 py-0.5 overflow-hidden cursor-pointer"
            style={{
              left: `calc((${leftOffsetDays} / ${daysCount}) * 100% + 4px)`,
              width: `calc((${durationDays} / ${daysCount}) * 100% - 8px)`,
              ...bgStyle
            }}
          >
            {!isHex && <div className={cn("absolute inset-0 opacity-60 backdrop-blur-sm", colorClass)} />}
            <div className="relative z-10 flex items-center gap-1 text-white text-[10px] font-medium w-full">
              <span className="truncate flex-1">{task.status}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectGroup: FC<{ project: any, startDate: Date, daysCount: number }> = ({ project, startDate, daysCount }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Calculate project bounds based on tasks
  let pStart = startDate;
  let pEnd = startDate;
  
  if (project.tasks.length > 0) {
     const starts = project.tasks.map((t: any) => t.start_date ? parseISO(t.start_date).getTime() : startDate.getTime());
     const ends = project.tasks.map((t: any) => t.deadline ? parseISO(t.deadline).getTime() : (t.start_date ? parseISO(t.start_date).getTime() : startDate.getTime()));
     pStart = new Date(Math.min(...starts));
     pEnd = new Date(Math.max(...ends));
  }

  let leftOffsetDays = differenceInDays(pStart, startDate);
  let durationDays = differenceInDays(pEnd, pStart) + 1;

  if (leftOffsetDays < 0) {
    durationDays += leftOffsetDays;
    leftOffsetDays = 0;
  }
  if (leftOffsetDays + durationDays > daysCount) {
    durationDays = daysCount - leftOffsetDays;
  }

  const cClass = project.color || "#3b82f6";
  const isHex = cClass.startsWith("#");
  const bgStyle = isHex ? { backgroundColor: cClass } : {};

  return (
    <>
      <div 
        className="group grid grid-cols-[250px_1fr] bg-surface/50 border-b border-border/50 cursor-pointer hover:bg-surface/80 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 p-3 border-r border-border/40 font-semibold text-sm">
          {expanded ? <ChevronDown size={16} className="text-text-muted" /> : <ChevronRight size={16} className="text-text-muted" />}
          <div className="w-3 h-3 rounded-sm" style={bgStyle} />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-xs text-text-muted bg-surface/50 px-2 py-0.5 rounded-full">{project.tasks.length}</span>
        </div>
        <div className="relative flex">
          {Array.from({ length: daysCount }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-border/20 border-dashed" />
          ))}
          {!expanded && durationDays > 0 && leftOffsetDays < daysCount && (
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full opacity-60"
              style={{
                left: `calc((${leftOffsetDays} / ${daysCount}) * 100% + 4px)`,
                width: `calc((${durationDays} / ${daysCount}) * 100% - 8px)`,
                ...bgStyle
              }}
            >
              {!isHex && <div className={cn("absolute inset-0 rounded-full", cClass)} />}
            </div>
          )}
        </div>
      </div>
      {expanded && project.tasks.map((task: any) => (
        <TaskRow key={task.id} task={task} startDate={startDate} daysCount={daysCount} colorClass={cClass} />
      ))}
    </>
  );
};

export const WeeklyGantt: FC<{
  tasks: any[],
  startDateStr: string,
  onTasksReorder?: (newTasks: any[]) => void
}> = ({ tasks, startDateStr }) => {
  
  const startDate = startDateStr ? parseISO(startDateStr) : new Date();
  const daysCount = 14; 

  const daysLabels = useMemo(() => {
    return Array.from({ length: daysCount }).map((_, i) => addDays(startDate, i));
  }, [startDate, daysCount]);

  // Group tasks by project
  const groupedProjects = useMemo(() => {
    const map: Record<number, { id: number, name: string, color: string, tasks: any[] }> = {};
    tasks.forEach(t => {
      if (!map[t.project_id]) {
        map[t.project_id] = {
          id: t.project_id,
          name: t.project_name,
          color: t.project_color,
          tasks: []
        };
      }
      map[t.project_id].tasks.push(t);
    });
    return Object.values(map);
  }, [tasks]);

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-xl border border-border/50 animate-slide-up">
      <div className="p-4 border-b border-border/50 bg-surface/50 backdrop-blur flex justify-between items-center">
        <h3 className="font-semibold text-text-base">Interactive Timeline</h3>
        <span className="text-xs text-text-muted bg-white/5 py-1 px-3 rounded-full border border-white/10">Click projects to expand tasks</span>
      </div>

      <div className="w-full overflow-x-auto">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[250px_1fr] bg-surface/20 border-b border-border/60 uppercase tracking-widest text-[10px] text-text-muted font-bold select-none">
            <div className="p-3 border-r border-border/40 flex items-center">Project / Task Details</div>
            <div className="flex">
              {daysLabels.map((date, i) => (
                <div key={i} className="flex-1 flex justify-center items-center p-2 border-r border-border/20 border-dashed text-center">
                  <span>{format(date, "MMM d")}<br/><span className="text-[11px] font-normal opacity-70">{format(date, "E")}</span></span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col relative min-h-[150px]">
             {groupedProjects.length === 0 ? (
                <div className="p-10 text-center text-text-muted text-sm w-full absolute inset-0 flex items-center justify-center">
                  No active projects or tasks scheduled for this period.
                </div>
             ) : (
                groupedProjects.map((project) => (
                  <ProjectGroup key={project.id} project={project} startDate={startDate} daysCount={daysCount} />
                ))
             )}
          </div>
        </div>
      </div>
    </div>
  );
};
