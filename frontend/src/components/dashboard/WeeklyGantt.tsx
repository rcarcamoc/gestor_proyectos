import { type FC, useMemo } from "react";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock } from "lucide-react";
import { cn } from "../../lib/utils";

// Project color palette mapping (dynamically generated or hardcoded for a few)
const PROJECT_COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-pink-500", "bg-emerald-500", "bg-orange-500"
];

// Sub-component for individual Task Row (Sortable)
const SortableTaskRow: FC<{ task: any, startDate: Date, daysCount: number }> = ({ task, startDate, daysCount }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Calculate pill position
  const taskStart = task.start_date ? parseISO(task.start_date) : startDate;
  const taskEnd = task.deadline ? parseISO(task.deadline) : taskStart;
  
  let leftOffsetDays = differenceInDays(taskStart, startDate);
  let durationDays = differenceInDays(taskEnd, taskStart) + 1; // inclusive

  // Bound within the visible window
  if (leftOffsetDays < 0) {
    durationDays += leftOffsetDays;
    leftOffsetDays = 0;
  }
  if (leftOffsetDays + durationDays > daysCount) {
    durationDays = daysCount - leftOffsetDays;
  }

  // Get color based on project
  const colorClass = PROJECT_COLORS[task.project_id % PROJECT_COLORS.length];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group grid grid-cols-[250px_1fr] bg-surface/30 hover:bg-surface/60 border-b border-border/40 transition-colors focus-within:ring-2 ring-primary relative z-10",
        isDragging && "z-50 shadow-2xl scale-[1.01] opacity-90 ring-1 ring-primary/50 cursor-grabbing bg-surface/80"
      )}
    >
      {/* Task Info Column */}
      <div className="flex items-center gap-3 p-3 border-r border-border/40">
        <div {...attributes} {...listeners} className="text-text-muted hover:text-text-base cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text-base truncate">{task.name}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn("inline-block w-2 h-2 rounded-full", colorClass)} />
            <span className="text-xs text-text-muted truncate">{task.project_name}</span>
          </div>
        </div>
        {/* Assignee Avatar */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-2 mr-2">
            <div className="w-6 h-6 rounded-full bg-secondary border border-surface flex items-center justify-center text-[10px] font-bold text-white uppercase" title={task.assignees[0].name}>
              {task.assignees[0].name.substring(0,2)}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Grid (Background lines + Pill) */}
      <div className="relative flex">
        {/* Background Day Cells */}
        {Array.from({ length: daysCount }).map((_, i) => (
          <div key={i} className="flex-1 border-r border-border/20 border-dashed" />
        ))}
        
        {/* Task Pill mapped over the correct days */}
        {durationDays > 0 && leftOffsetDays < daysCount && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-8 rounded-md shadow-md flex items-center px-3 overflow-hidden cursor-pointer"
            style={{ 
              left: `calc((${leftOffsetDays} / ${daysCount}) * 100% + 4px)`, 
              width: `calc((${durationDays} / ${daysCount}) * 100% - 8px)`
            }}
          >
            <div className={cn("absolute inset-0 opacity-80 backdrop-blur-sm", colorClass)} />
            <div className="relative z-10 flex items-center gap-2 text-white text-xs font-medium w-full">
              <span className="truncate flex-1">{task.status}</span>
              {task.estimated_hours > 0 && (
                <span className="flex items-center gap-1 opacity-80 shrink-0">
                  <Clock size={12} /> {task.estimated_hours}h
                </span>
              )}
            </div>
            {/* Visual shine effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
          </div>
        )}
      </div>
    </div>
  );
};

export const WeeklyGantt: FC<{ 
  tasks: any[], 
  startDateStr: string,
  onTasksReorder?: (newTasks: any[]) => void
}> = ({ tasks, startDateStr, onTasksReorder }) => {
  const sensors = useSensors(
    usePointerSensor(),
    useKeyboardSensor()
  );

  function usePointerSensor() {
    return useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }, // Prevents drag when just clicking inside the task
    });
  }

  function useKeyboardSensor() {
    return useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    });
  }

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(tasks, oldIndex, newIndex);
      onTasksReorder?.(reordered);
    }
  };

  const startDate = startDateStr ? parseISO(startDateStr) : new Date();
  const daysCount = 14; // Showing 14 days

  const daysLabels = useMemo(() => {
    return Array.from({ length: daysCount }).map((_, i) => addDays(startDate, i));
  }, [startDate, daysCount]);

  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-xl border border-border/50 animate-slide-up">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-surface/50 backdrop-blur flex justify-between items-center">
        <h3 className="font-semibold text-text-base">Interactive Timeline</h3>
        <span className="text-xs text-text-muted bg-white/5 py-1 px-3 rounded-full border border-white/10">Drag rows to reorder priority</span>
      </div>

      {/* Grid Container */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Days Header */}
          <div className="grid grid-cols-[250px_1fr] bg-surface/20 border-b border-border/60 uppercase tracking-widest text-[10px] text-text-muted font-bold select-none">
            <div className="p-3 border-r border-border/40 flex items-center">Task Details</div>
            <div className="flex">
              {daysLabels.map((date, i) => (
                <div key={i} className="flex-1 flex justify-center items-center p-2 border-r border-border/20 border-dashed text-center">
                  <span>{format(date, "MMM d")}<br/><span className="text-[11px] font-normal opacity-70">{format(date, "E")}</span></span>
                </div>
              ))}
            </div>
          </div>

          {/* Sortable Tasks List */}
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={tasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col relative min-h-[150px]">
                {tasks.length === 0 ? (
                  <div className="p-10 text-center text-text-muted text-sm w-full absolute inset-0 flex items-center justify-center">
                    No active tasks scheduled for this period.
                  </div>
                ) : (
                  tasks.map((task) => (
                    <SortableTaskRow 
                      key={task.id} 
                      task={task} 
                      startDate={startDate} 
                      daysCount={daysCount} 
                    />
                  ))
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
};
