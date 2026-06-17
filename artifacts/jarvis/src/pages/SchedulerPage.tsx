import React, { useState } from 'react';
import { useListScheduledTasks, useCreateScheduledTask, useDeleteScheduledTask, getListScheduledTasksQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Clock, Play, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const SchedulerPage: React.FC = () => {
  const [cronExpression, setCronExpression] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  
  const { data: tasks, isLoading, error } = useListScheduledTasks();
  const createTask = useCreateScheduledTask();
  const deleteTask = useDeleteScheduledTask();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cronExpression.trim() || !taskDescription.trim()) return;

    createTask.mutate({
      data: {
        cronExpression: cronExpression.trim(),
        taskDescription: taskDescription.trim()
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListScheduledTasksQueryKey() });
        setCronExpression('');
        setTaskDescription('');
        toast({
          title: "Task scheduled",
          description: "Your background job was successfully registered and started.",
        });
      },
      onError: (err: any) => {
        toast({
          title: "Failed to schedule task",
          description: err.message || "An error occurred.",
          variant: "destructive"
        });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteTask.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListScheduledTasksQueryKey() });
        toast({
          title: "Task cancelled",
          description: "The background task was stopped and removed.",
        });
      },
      onError: (err: any) => {
        toast({
          title: "Failed to cancel task",
          description: err.message || "An error occurred.",
          variant: "destructive"
        });
      }
    });
  };

  const setPreset = (expr: string) => {
    setCronExpression(expr);
  };

  const presets = [
    { label: "Every 1 min", expr: "*/1 * * * *" },
    { label: "Every 15 mins", expr: "*/15 * * * *" },
    { label: "Every 30 mins", expr: "*/30 * * * *" },
    { label: "Every hour", expr: "0 * * * *" },
    { label: "Daily at midnight", expr: "0 0 * * *" },
  ];

  return (
    <div className="h-full flex flex-col p-5 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
      <header className="mb-6 shrink-0">
        <h2 className="text-xl font-semibold text-foreground">Background Scheduler</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage automated tasks and reminders running proactively in the background.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
        {/* Create Task Form */}
        <div className="lg:col-span-1 rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Plus size={16} className="text-primary" /> Schedule New Task
          </h3>

          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase">Cron Expression</label>
              <input
                type="text"
                placeholder="e.g. */30 * * * *"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {presets.map((p) => (
                  <button
                    key={p.expr}
                    type="button"
                    onClick={() => setPreset(p.expr)}
                    className="text-[11px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors font-medium"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase">Task Description / Prompt</label>
              <textarea
                placeholder="Describe what JARVIS should do when this triggers (e.g. 'Send a desktop notification reminding the user to drink water')"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={createTask.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Clock size={16} /> {createTask.isPending ? 'Scheduling...' : 'Schedule Task'}
            </button>
          </form>

          <div className="p-3 border border-blue-100 bg-blue-50/50 rounded-lg flex gap-2.5 items-start">
            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700 leading-normal">
              Background tasks use standard 5-field cron syntax (minutes, hours, day of month, month, day of week). When triggered, they invoke the JARVIS agentic framework with all tools enabled.
            </p>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-white flex flex-col shadow-sm overflow-hidden">
          <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Cron Jobs</p>
            {tasks && <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">{tasks.length} Active</span>}
          </div>

          <div className="divide-y divide-border overflow-y-auto">
            {isLoading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Loading scheduled jobs...</p>
            ) : error ? (
              <div className="p-8 text-center text-sm text-destructive flex flex-col items-center gap-2">
                <AlertCircle size={24} />
                <p>Failed to load scheduled tasks</p>
              </div>
            ) : !tasks?.length ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
                <Clock size={36} className="opacity-20" />
                <p>No active scheduled tasks. Set one up to get started!</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="p-4 flex justify-between items-start gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold">
                        {task.cronExpression}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-slate-50 border border-slate-100 px-1.5 py-0.25 rounded">
                        ID: #{task.id}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{task.taskDescription}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Created: {new Date(task.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deleteTask.isPending}
                    className="p-1.5 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all shrink-0"
                    title="Stop and Delete Task"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
