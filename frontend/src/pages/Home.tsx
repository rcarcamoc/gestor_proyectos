import { type FC, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary, getDashboardTimeline } from "../api/dashboard";
import { KPIWidgets } from "../components/dashboard/KPIWidgets";
import { WeeklyGantt } from "../components/dashboard/WeeklyGantt";
import { Users, User as UserIcon } from "lucide-react";
import { cn } from "../lib/utils";

export const Home: FC = () => {
  const [viewMode, setViewMode] = useState<"personal" | "team">("personal");
  const [localTasks, setLocalTasks] = useState<any[]>([]);

  const { data: summary, isLoading: isLoadingSummary } = useQuery({
    queryKey: ["dashboardSummary", viewMode],
    queryFn: () => getDashboardSummary(viewMode),
  });

  const { data: timelineData, isLoading: isLoadingTimeline } = useQuery({
    queryKey: ["dashboardTimeline", viewMode],
    queryFn: () => getDashboardTimeline(viewMode),
  });

  // Sync tasks to local state when loaded to allow client-side reordering
  import("react").then(React => {
    React.useEffect(() => {
      if (timelineData?.tasks) {
        setLocalTasks(timelineData.tasks);
      }
    }, [timelineData]);
  });

  const handleTasksReorder = (newTasks: any[]) => {
    setLocalTasks(newTasks);
    // Future: API call to save priority order conceptually
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-base">Dashboard Overview</h2>
          <p className="text-sm text-text-muted mt-1">Here's your productivity summary.</p>
        </div>

        {/* View Mode Toggle */}
        <div className="bg-surface/50 backdrop-blur-md p-1 items-center rounded-lg border border-border/50 inline-flex">
          <button
            onClick={() => setViewMode("personal")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium",
              viewMode === "personal"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-text-muted hover:text-text-base hover:bg-white/5"
            )}
          >
            <UserIcon size={16} /> My Tasks
          </button>
          <button
            onClick={() => setViewMode("team")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md transition-all text-sm font-medium",
              viewMode === "team"
                ? "bg-primary text-white shadow-md shadow-primary/20"
                : "text-text-muted hover:text-text-base hover:bg-white/5"
            )}
          >
            <Users size={16} /> Team View
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoadingSummary || isLoadingTimeline ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <KPIWidgets data={summary} />

          <WeeklyGantt
            tasks={localTasks}
            startDateStr={timelineData?.start}
            onTasksReorder={handleTasksReorder}
          />
        </>
      )}
    </div>
  );
};
