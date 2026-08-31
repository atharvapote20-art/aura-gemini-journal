/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  GitBranch,
  Clock,
  CheckCircle2,
  Lock,
  PlayCircle,
  Zap,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  ArrowRight,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { DagTask, PriorityType } from '../types';

interface DagVisualizerProps {
  tasks: DagTask[];
  onToggleTask: (taskId: string) => Promise<void> | void;
}

interface NodeLayout {
  task: DagTask;
  id: string;
  level: number;
  indexInLevel: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isReady: boolean;
  isBlocked: boolean;
  isCompleted: boolean;
  blockingDeps: string[];
  isCritical: boolean;
}

interface EdgeLayout {
  id: string;
  from: string;
  to: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isResolved: boolean;
  isCritical: boolean;
}

interface ScheduledTask {
  task: DagTask;
  startMinute: number;
  endMinute: number;
  isReady: boolean;
  isBlocked: boolean;
  isCompleted: boolean;
}

export const DagVisualizer: React.FC<DagVisualizerProps> = ({ tasks, onToggleTask }) => {
  const [viewSubMode, setViewSubMode] = useState<'graph' | 'timeline'>('graph');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [highlightCriticalOnly, setHighlightCriticalOnly] = useState<boolean>(false);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- 1. Topological Sorting & Level Computations ---
  const { nodeLayouts, edgeLayouts, criticalTaskIds, totalEstimatedMinutes, totalGraphWidth, totalGraphHeight } = useMemo(() => {
    if (!tasks || tasks.length === 0) {
      return {
        nodeLayouts: [],
        edgeLayouts: [],
        criticalTaskIds: new Set<string>(),
        totalEstimatedMinutes: 0,
        totalGraphWidth: 600,
        totalGraphHeight: 400,
      };
    }

    const taskMap = new Map<string, DagTask>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    // Calculate level (depth) for each task
    const levelMap = new Map<string, number>();
    const visited = new Set<string>();

    const getLevel = (taskId: string, currentPath = new Set<string>()): number => {
      if (levelMap.has(taskId)) return levelMap.get(taskId)!;
      if (currentPath.has(taskId)) return 0; // Prevent cycle loops

      const task = taskMap.get(taskId);
      if (!task || !task.depends_on || task.depends_on.length === 0) {
        levelMap.set(taskId, 0);
        return 0;
      }

      currentPath.add(taskId);
      let maxDepLevel = -1;
      task.depends_on.forEach((depId) => {
        if (taskMap.has(depId)) {
          const l = getLevel(depId, new Set(currentPath));
          if (l > maxDepLevel) maxDepLevel = l;
        }
      });
      currentPath.delete(taskId);

      const computedLevel = maxDepLevel + 1;
      levelMap.set(taskId, computedLevel);
      return computedLevel;
    };

    tasks.forEach((t) => getLevel(t.id));

    // Group tasks by level
    const levels: DagTask[][] = [];
    tasks.forEach((t) => {
      const lvl = levelMap.get(t.id) || 0;
      if (!levels[lvl]) levels[lvl] = [];
      levels[lvl].push(t);
    });

    // Compute Critical Path (longest path weighted by estimated_minutes)
    const memoPathDuration = new Map<string, { duration: number; path: string[] }>();

    const computeMaxChain = (taskId: string): { duration: number; path: string[] } => {
      if (memoPathDuration.has(taskId)) return memoPathDuration.get(taskId)!;
      const task = taskMap.get(taskId);
      if (!task) return { duration: 0, path: [] };

      // Find children who depend on this task
      const children = tasks.filter((t) => t.depends_on?.includes(taskId));
      if (children.length === 0) {
        const res = { duration: task.estimated_minutes || 15, path: [taskId] };
        memoPathDuration.set(taskId, res);
        return res;
      }

      let bestChildChain = { duration: 0, path: [] as string[] };
      children.forEach((child) => {
        const chain = computeMaxChain(child.id);
        if (chain.duration > bestChildChain.duration) {
          bestChildChain = chain;
        }
      });

      const res = {
        duration: (task.estimated_minutes || 15) + bestChildChain.duration,
        path: [taskId, ...bestChildChain.path],
      };
      memoPathDuration.set(taskId, res);
      return res;
    };

    // Find roots to compute overall longest chain
    const rootTasks = tasks.filter((t) => !t.depends_on || t.depends_on.length === 0);
    let absoluteLongest = { duration: 0, path: [] as string[] };
    (rootTasks.length > 0 ? rootTasks : tasks).forEach((root) => {
      const chain = computeMaxChain(root.id);
      if (chain.duration > absoluteLongest.duration) {
        absoluteLongest = chain;
      }
    });

    const criticalSet = new Set<string>(absoluteLongest.path);

    // Layout Dimensions
    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 100;
    const HORIZONTAL_GAP = 90;
    const VERTICAL_GAP = 28;
    const PADDING = 30;

    let maxLevelCount = 0;
    levels.forEach((lvlTasks) => {
      if (lvlTasks && lvlTasks.length > maxLevelCount) {
        maxLevelCount = lvlTasks.length;
      }
    });

    const graphWidth = Math.max(600, levels.length * (NODE_WIDTH + HORIZONTAL_GAP) + PADDING * 2);
    const graphHeight = Math.max(340, maxLevelCount * (NODE_HEIGHT + VERTICAL_GAP) + PADDING * 2);

    // Compute exact (x, y) coordinates
    const nodes: NodeLayout[] = [];
    const nodeCoordMap = new Map<string, { x: number; y: number }>();

    levels.forEach((lvlTasks, lvlIdx) => {
      if (!lvlTasks) return;
      const x = PADDING + lvlIdx * (NODE_WIDTH + HORIZONTAL_GAP);
      const totalColHeight = lvlTasks.length * NODE_HEIGHT + (lvlTasks.length - 1) * VERTICAL_GAP;
      const startY = PADDING + Math.max(0, (graphHeight - PADDING * 2 - totalColHeight) / 2);

      lvlTasks.forEach((task, idx) => {
        const y = startY + idx * (NODE_HEIGHT + VERTICAL_GAP);
        nodeCoordMap.set(task.id, { x, y });

        const blockingDeps = (task.depends_on || []).filter((depId) => {
          const parent = taskMap.get(depId);
          return parent && !parent.completed;
        });

        const isCompleted = !!task.completed;
        const isBlocked = !isCompleted && blockingDeps.length > 0;
        const isReady = !isCompleted && blockingDeps.length === 0;
        const isCritical = criticalSet.has(task.id);

        nodes.push({
          task,
          id: task.id,
          level: lvlIdx,
          indexInLevel: idx,
          x,
          y,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          isReady,
          isBlocked,
          isCompleted,
          blockingDeps,
          isCritical,
        });
      });
    });

    // Compute Edges
    const edges: EdgeLayout[] = [];
    tasks.forEach((task) => {
      if (!task.depends_on) return;
      const targetPos = nodeCoordMap.get(task.id);
      if (!targetPos) return;

      task.depends_on.forEach((depId) => {
        const sourcePos = nodeCoordMap.get(depId);
        if (!sourcePos) return;

        const parentTask = taskMap.get(depId);
        const isResolved = !!parentTask?.completed;
        const isCritical = criticalSet.has(depId) && criticalSet.has(task.id);

        edges.push({
          id: `${depId}->${task.id}`,
          from: depId,
          to: task.id,
          fromX: sourcePos.x + NODE_WIDTH,
          fromY: sourcePos.y + NODE_HEIGHT / 2,
          toX: targetPos.x,
          toY: targetPos.y + NODE_HEIGHT / 2,
          isResolved,
          isCritical,
        });
      });
    });

    const sumMinutes = tasks.reduce((acc, t) => acc + (t.estimated_minutes || 15), 0);

    return {
      nodeLayouts: nodes,
      edgeLayouts: edges,
      criticalTaskIds: criticalSet,
      totalEstimatedMinutes: sumMinutes,
      totalGraphWidth: graphWidth,
      totalGraphHeight: graphHeight,
    };
  }, [tasks]);

  // --- 2. Timeline Schedule Computations (Topological Horizon) ---
  const scheduledTasks: ScheduledTask[] = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];

    const taskMap = new Map<string, DagTask>();
    tasks.forEach((t) => taskMap.set(t.id, t));

    const endMinuteMap = new Map<string, number>();

    const getEndMinute = (taskId: string, visiting = new Set<string>()): number => {
      if (endMinuteMap.has(taskId)) return endMinuteMap.get(taskId)!;
      if (visiting.has(taskId)) return 0;

      const task = taskMap.get(taskId);
      if (!task) return 0;

      visiting.add(taskId);
      let earliestStart = 0;
      (task.depends_on || []).forEach((depId) => {
        if (taskMap.has(depId)) {
          const depEnd = getEndMinute(depId, new Set(visiting));
          if (depEnd > earliestStart) earliestStart = depEnd;
        }
      });
      visiting.delete(taskId);

      const duration = task.estimated_minutes || 15;
      const calculatedEnd = earliestStart + duration;
      endMinuteMap.set(taskId, calculatedEnd);
      return calculatedEnd;
    };

    tasks.forEach((t) => getEndMinute(t.id));

    return tasks.map((task) => {
      const duration = task.estimated_minutes || 15;
      const endMinute = endMinuteMap.get(task.id) || duration;
      const startMinute = endMinute - duration;

      const blockingDeps = (task.depends_on || []).filter((depId) => {
        const p = taskMap.get(depId);
        return p && !p.completed;
      });

      return {
        task,
        startMinute,
        endMinute,
        isCompleted: !!task.completed,
        isBlocked: !task.completed && blockingDeps.length > 0,
        isReady: !task.completed && blockingDeps.length === 0,
      };
    }).sort((a, b) => a.startMinute - b.startMinute);
  }, [tasks]);

  const maxTimelineMinutes = useMemo(() => {
    return Math.max(60, Math.max(...scheduledTasks.map((s) => s.endMinute), 0));
  }, [scheduledTasks]);

  // Priority badge styling helper
  const getPriorityStyle = (priority: PriorityType) => {
    switch (priority) {
      case 'high':
        return 'border-rose-200 bg-rose-50 text-rose-800 font-semibold';
      case 'medium':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'low':
      default:
        return 'border-neutral-200 bg-neutral-100 text-neutral-600';
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const readyCount = nodeLayouts.filter((n) => n.isReady).length;
  const blockedCount = nodeLayouts.filter((n) => n.isBlocked).length;

  return (
    <div className="space-y-3">
      {/* Header & Sub-Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5">
            <button
              id="btn-dag-view-graph"
              onClick={() => setViewSubMode('graph')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewSubMode === 'graph'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>Interactive Graph</span>
            </button>

            <button
              id="btn-dag-view-timeline"
              onClick={() => setViewSubMode('timeline')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                viewSubMode === 'timeline'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Timeline / Gantt</span>
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="hidden sm:flex items-center gap-2 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> {completedCount} Done
            </span>
            <span className="flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              <PlayCircle className="h-3 w-3" /> {readyCount} Ready
            </span>
            {blockedCount > 0 && (
              <span className="flex items-center gap-1 font-medium text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                <Lock className="h-3 w-3" /> {blockedCount} Blocked
              </span>
            )}
          </div>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          {viewSubMode === 'graph' && (
            <>
              <button
                id="btn-dag-toggle-critical"
                onClick={() => setHighlightCriticalOnly(!highlightCriticalOnly)}
                className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                  highlightCriticalOnly
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-semibold'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
                }`}
                title="Highlight the longest critical path chain"
              >
                <Zap className={`h-3 w-3 ${highlightCriticalOnly ? 'text-indigo-600 fill-indigo-600' : ''}`} />
                <span>Critical Path</span>
              </button>

              <div className="flex items-center rounded-md border border-neutral-200 bg-white">
                <button
                  id="btn-dag-zoom-out"
                  onClick={() => setZoomLevel((z) => Math.max(0.6, z - 0.15))}
                  className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-1 text-[10px] font-mono text-neutral-500">{Math.round(zoomLevel * 100)}%</span>
                <button
                  id="btn-dag-zoom-in"
                  onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.15))}
                  className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  id="btn-dag-zoom-reset"
                  onClick={() => setZoomLevel(1)}
                  className="p-1 text-neutral-500 hover:text-neutral-900 border-l border-neutral-200 hover:bg-neutral-50"
                  title="Reset Zoom"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}

          <div className="flex items-center gap-1 text-[11px] font-mono text-neutral-600 bg-neutral-100 px-2 py-1 rounded">
            <Clock className="h-3 w-3 text-neutral-500" />
            <span>Est: {totalEstimatedMinutes}m</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE FLOWCHART (GRAPH) */}
      {viewSubMode === 'graph' && (
        <div
          ref={containerRef}
          className="relative w-full rounded-xl border border-neutral-200 bg-neutral-900/2 overflow-auto shadow-inner min-h-[380px] max-h-[500px]"
        >
          {/* Legend Bar */}
          <div className="sticky top-2 left-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200/80 bg-white/95 px-3 py-1.5 text-[10px] text-neutral-600 shadow-xs backdrop-blur-xs w-max max-w-full">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Ready / Next</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-neutral-400" />
              <span>Blocked</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              <span>Critical Path</span>
            </div>
            <span className="text-neutral-400">|</span>
            <span className="text-neutral-400 italic">Click node to toggle state</span>
          </div>

          <div
            style={{
              width: totalGraphWidth * zoomLevel,
              height: totalGraphHeight * zoomLevel,
              transformOrigin: '0 0',
              position: 'relative',
            }}
          >
            {/* SVG Connecting Edges */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{
                width: totalGraphWidth,
                height: totalGraphHeight,
                transform: `scale(${zoomLevel})`,
                transformOrigin: '0 0',
              }}
            >
              <defs>
                {/* Arrow markers */}
                <marker
                  id="arrow-resolved"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrow-critical"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#6366f1" />
                </marker>
                <marker
                  id="arrow-pending"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#9ca3af" />
                </marker>
              </defs>

              {edgeLayouts.map((edge) => {
                const isHovered = hoveredTaskId === edge.from || hoveredTaskId === edge.to;
                const isDimmed = highlightCriticalOnly && !edge.isCritical;

                // Bezier Curve
                const dx = (edge.toX - edge.fromX) / 2;
                const pathD = `M ${edge.fromX} ${edge.fromY} C ${edge.fromX + dx} ${edge.fromY}, ${edge.toX - dx} ${edge.toY}, ${edge.toX} ${edge.toY}`;

                let strokeColor = '#d1d5db';
                let markerId = 'arrow-pending';
                let strokeWidth = 1.5;
                let strokeDash = 'none';

                if (edge.isResolved) {
                  strokeColor = '#10b981';
                  markerId = 'arrow-resolved';
                  strokeWidth = 2;
                } else if (edge.isCritical) {
                  strokeColor = '#6366f1';
                  markerId = 'arrow-critical';
                  strokeWidth = 2.5;
                } else {
                  strokeDash = '4 3';
                }

                if (isHovered) {
                  strokeWidth = 3;
                }

                return (
                  <path
                    key={edge.id}
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                    markerEnd={`url(#${markerId})`}
                    opacity={isDimmed ? 0.2 : 1}
                    className="transition-all duration-200"
                  />
                );
              })}
            </svg>

            {/* Interactive Node Elements */}
            {nodeLayouts.map((node) => {
              const isHovered = hoveredTaskId === node.id;
              const isDimmed = highlightCriticalOnly && !node.isCritical;

              let cardBorder = 'border-neutral-200 bg-white hover:border-neutral-400';
              let statusBadge = (
                <span className="flex items-center gap-1 text-[10px] font-medium text-neutral-500 bg-neutral-100 px-1.5 py-0.2 rounded">
                  <Lock className="h-2.5 w-2.5" /> Blocked
                </span>
              );

              if (node.isCompleted) {
                cardBorder = 'border-emerald-300 bg-emerald-50/50 opacity-75';
                statusBadge = (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-1.5 py-0.2 rounded">
                    <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Done
                  </span>
                );
              } else if (node.isReady) {
                cardBorder = 'border-amber-400 bg-white shadow-md ring-2 ring-amber-400/20';
                statusBadge = (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded animate-pulse">
                    <PlayCircle className="h-2.5 w-2.5 text-amber-600" /> Ready
                  </span>
                );
              }

              if (node.isCritical && !node.isCompleted) {
                cardBorder += ' ring-1 ring-indigo-400/40';
              }

              return (
                <div
                  key={node.id}
                  id={`dag-node-${node.id}`}
                  onClick={() => onToggleTask(node.id)}
                  onMouseEnter={() => setHoveredTaskId(node.id)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  style={{
                    position: 'absolute',
                    left: node.x * zoomLevel,
                    top: node.y * zoomLevel,
                    width: node.width * zoomLevel,
                    height: node.height * zoomLevel,
                    transformOrigin: '0 0',
                  }}
                  className={`group cursor-pointer rounded-xl border p-2.5 transition-all duration-200 flex flex-col justify-between select-none ${cardBorder} ${
                    isDimmed ? 'opacity-20 pointer-events-none' : ''
                  } ${isHovered ? 'scale-[1.03] z-30 shadow-lg' : 'z-10'}`}
                >
                  {/* Top Row: Task ID & Badges */}
                  <div className="flex items-center justify-between gap-1 border-b border-neutral-100 pb-1.5">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="font-mono text-[10px] font-bold text-neutral-600">
                        {node.id}
                      </span>
                      <span className={`rounded px-1.5 py-0.2 text-[9px] uppercase border ${getPriorityStyle(node.task.priority)}`}>
                        {node.task.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {statusBadge}
                    </div>
                  </div>

                  {/* Body Text */}
                  <p
                    className={`text-xs font-medium leading-snug line-clamp-2 my-1 ${
                      node.isCompleted ? 'line-through text-neutral-400' : 'text-neutral-900'
                    }`}
                  >
                    {node.task.task}
                  </p>

                  {/* Footer Row: Duration & Critical Indicator */}
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-100">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="h-2.5 w-2.5 text-neutral-400" />
                      {node.task.estimated_minutes || 15}m
                    </span>

                    {node.isCritical && (
                      <span className="flex items-center gap-0.5 text-indigo-700 font-semibold text-[9px] bg-indigo-50 px-1 rounded">
                        <Zap className="h-2.5 w-2.5 text-indigo-600" />
                        Critical
                      </span>
                    )}

                    {node.blockingDeps.length > 0 && (
                      <span className="text-[9px] text-neutral-400 truncate max-w-[90px]">
                        Req: {node.blockingDeps.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: TIMELINE / GANTT HORIZON VIEW */}
      {viewSubMode === 'timeline' && (
        <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-600">
            <span className="font-semibold text-neutral-900">Sequential Execution Horizon</span>
            <span>Total Schedule: {maxTimelineMinutes} minutes</span>
          </div>

          {/* Time axis ruler */}
          <div className="relative h-6 border-b border-neutral-200 text-[10px] font-mono text-neutral-400">
            {[0, 15, 30, 45, 60, 90, 120, 150, 180].filter((m) => m <= maxTimelineMinutes + 15).map((minute) => {
              const leftPercent = (minute / maxTimelineMinutes) * 100;
              return (
                <div
                  key={minute}
                  style={{ left: `${leftPercent}%` }}
                  className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
                >
                  <span>{minute}m</span>
                  <div className="h-1.5 w-px bg-neutral-300" />
                </div>
              );
            })}
          </div>

          {/* Stacked Task Bars */}
          <div className="space-y-2.5 pt-2">
            {scheduledTasks.map(({ task, startMinute, endMinute, isCompleted, isReady, isBlocked }) => {
              const leftPercent = (startMinute / maxTimelineMinutes) * 100;
              const widthPercent = Math.max(6, ((endMinute - startMinute) / maxTimelineMinutes) * 100);

              let barBg = 'bg-neutral-100 border-neutral-300 text-neutral-700';
              if (isCompleted) {
                barBg = 'bg-emerald-100/70 border-emerald-300 text-emerald-900 line-through opacity-70';
              } else if (isReady) {
                barBg = 'bg-amber-100 border-amber-400 text-amber-950 font-semibold shadow-xs';
              } else if (isBlocked) {
                barBg = 'bg-neutral-100 border-neutral-200 text-neutral-500';
              }

              return (
                <div
                  key={task.id}
                  id={`timeline-bar-${task.id}`}
                  onClick={() => onToggleTask(task.id)}
                  className="group flex flex-col gap-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-neutral-500">{task.id}</span>
                      <span className={`text-xs ${isCompleted ? 'line-through text-neutral-400' : 'text-neutral-800'}`}>
                        {task.task}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-500">
                      <span>{startMinute}m - {endMinute}m</span>
                      <span>({task.estimated_minutes || 15}m)</span>
                    </div>
                  </div>

                  {/* Visual Bar Container */}
                  <div className="relative h-6 w-full rounded bg-neutral-50 border border-neutral-100 overflow-hidden">
                    <div
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                      className={`absolute top-0 bottom-0 rounded border px-2 flex items-center justify-between transition-all duration-200 ${barBg}`}
                    >
                      <span className="text-[10px] truncate font-medium">{task.id}</span>
                      <span className="text-[9px] font-mono">{task.estimated_minutes || 15}m</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-lg bg-neutral-50 p-3 border border-neutral-200 text-xs text-neutral-600 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-neutral-700" />
              <span>Recommended Next Focus Block:</span>
            </span>
            <span className="font-semibold text-neutral-900">
              {scheduledTasks.find((s) => s.isReady)?.task.task || 'All tasks unblocked or completed!'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
