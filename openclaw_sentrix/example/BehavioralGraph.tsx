'use client';

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useViewport,
  type Node,
  type Edge,
  type NodeChange,
  type NodePositionChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import type { AgentStatus, PatrolSelection } from '../../types';
import type { PatrolResponseState } from '../../hooks/usePatrolResponseSequence';
import { violationCounts as mockViolationCounts, agents as mockAgents } from '../../data/mockData';
import { nodeTypes } from './CustomNodes';
import { useAgentViolationCounts } from '../../hooks/api/useBridgeQueries';
import { edgeTypes } from './CustomEdges';
import { useAgentsRaw } from '../../hooks/api/useBridgeQueries';

// Node radius for collision detection (based on visual sizes)
const NODE_RADII: Record<string, number> = {
  agent: 32,        // 64px / 2
  superintendent: 28, // 56px / 2
  investigator: 24,  // 48px / 2
  network: 24,       // 48px / 2
  tripwire: 25,      // 50px / 2
  patrol: 20,        // ~40px / 2
};

interface BehavioralGraphProps {
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string | null) => void;
  getAgentStatus: (agentId: string) => AgentStatus;
  historicalAgentStates?: Record<string, AgentStatus>;
  isLive?: boolean;
  patrolSelection: PatrolSelection | null;
  onPatrolSelect: (selection: PatrolSelection | null) => void;
  showHeatmap?: boolean;
  response?: PatrolResponseState;
  useMocks?: boolean;
}

// Store initial edge lengths for constraint-based dragging
const edgeLengths = new Map<string, number>();

// Helper to calculate distance between two positions
function calculateDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Helper to generate fully interconnected edges for a cluster
function generateClusterEdges(agentIds: string[], clusterPrefix: string): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      edges.push({
        id: `${clusterPrefix}-e-${agentIds[i]}-${agentIds[j]}`,
        source: agentIds[i],
        target: agentIds[j],
        type: 'animated',
        data: { color: '#4b5563' },
      });
    }
  }
  return edges;
}

// ── Grid layout helpers for dynamic cluster nodes ────────────────────────────

/**
 * Arrange nodes from a single cluster in a tight circular layout.
 * Returns ReactFlow Node objects with positions relative to (originX, originY).
 */
function layoutClusterNodes(
  agentIds: string[],
  agentLabels: Record<string, string>,
  agentStatuses: Record<string, string>,
  agentRecords: Record<string, string>,
  originX: number,
  originY: number,
): Node[] {
  const count = agentIds.length;
  if (count === 0) return [];
  const minRadius = 90;
  const radiusPerNode = 18;
  const radius = Math.max(minRadius, (count * radiusPerNode) / Math.PI);
  return agentIds.map((agentId, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = originX + radius * Math.cos(angle);
    const y = originY + radius * Math.sin(angle);
    return {
      id: agentId,
      type: 'agent',
      position: { x, y },
      data: {
        label: agentLabels[agentId] ?? agentId,
        status: agentStatuses[agentId] ?? 'idle',
        record: agentRecords[agentId] ?? 'clear',
      },
    };
  });
}

/**
 * Build all agent nodes + intra-cluster edges from Bridge DB agents data.
 * Clusters are arranged in a 2-column grid layout.
 */
function buildGraphFromDbAgents(agentsDict: Record<string, Record<string, unknown>>): {
  agentNodes: Node[];
  agentEdges: Edge[];
  clusterDefs: Array<{ prefix: string; label: string; ids: string[] }>;
} {
  const clusterMap = new Map<string, string[]>();
  const agentLabels: Record<string, string> = {};
  const agentStatuses: Record<string, string> = {};
  const agentRecords: Record<string, string> = {};
  for (const [agentId, profile] of Object.entries(agentsDict)) {
    const clusterId = (profile.cluster_id as string) || 'default';
    if (!clusterMap.has(clusterId)) clusterMap.set(clusterId, []);
    clusterMap.get(clusterId)!.push(agentId);
    agentLabels[agentId] = (profile.name as string) || agentId;
    agentStatuses[agentId] = (profile.agent_status as string) || 'idle';
    agentRecords[agentId] = (profile.record as string) || 'clear';
  }
  const clusterIds = Array.from(clusterMap.keys()).sort();
  const CLUSTER_SPACING_X = 380;
  const CLUSTER_SPACING_Y = 360;
  const COLS = 2;
  const agentNodes: Node[] = [];
  const agentEdges: Edge[] = [];
  const clusterDefs: Array<{ prefix: string; label: string; ids: string[] }> = [];
  clusterIds.forEach((clusterId, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const originX = 150 + col * CLUSTER_SPACING_X;
    const originY = 150 + row * CLUSTER_SPACING_Y;
    const ids = clusterMap.get(clusterId)!;
    agentNodes.push(...layoutClusterNodes(ids, agentLabels, agentStatuses, agentRecords, originX, originY));
    agentEdges.push(...generateClusterEdges(ids, clusterId));
    clusterDefs.push({ prefix: clusterId, label: clusterId, ids });
  });
  return { agentNodes, agentEdges, clusterDefs };
}

/**
 * Fallback static data: used while the DB is loading / unreachable.
 * Mirrors the original 4-cluster hardcoded layout.
 */
const FALLBACK_AGENTS: Record<string, Record<string, unknown>> = {
  'c1-email':    { cluster_id: 'cluster-1', agent_type: 'email',    agent_status: 'working', record: 'high_risk' },
  'c1-coding':   { cluster_id: 'cluster-1', agent_type: 'code',     agent_status: 'idle',   record: 'clear' },
  'c1-document': { cluster_id: 'cluster-1', agent_type: 'document', agent_status: 'idle',  record: 'low_risk' },
  'c1-data':     { cluster_id: 'cluster-1', agent_type: 'code',     agent_status: 'restricted', record: 'low_risk' },
  'c2-email':    { cluster_id: 'cluster-2', agent_type: 'email',    agent_status: 'idle',  record: 'clear' },
  'c2-coding':   { cluster_id: 'cluster-2', agent_type: 'code',     agent_status: 'idle',  record: 'clear' },
  'c2-document': { cluster_id: 'cluster-2', agent_type: 'document', agent_status: 'idle',  record: 'low_risk' },
  'c2-data':     { cluster_id: 'cluster-2', agent_type: 'code',     agent_status: 'idle',  record: 'clear' },
  'c3-email':    { cluster_id: 'cluster-3', agent_type: 'email',    agent_status: 'idle',  record: 'clear' },
  'c3-coding':   { cluster_id: 'cluster-3', agent_type: 'code',     agent_status: 'idle',  record: 'high_risk' },
  'c3-document': { cluster_id: 'cluster-3', agent_type: 'document', agent_status: 'restricted', record: 'low_risk' },
  'c3-data':     { cluster_id: 'cluster-3', agent_type: 'code',     agent_status: 'idle',  record: 'clear' },
  'c4-email':    { cluster_id: 'cluster-4', agent_type: 'email',    agent_status: 'idle',  record: 'low_risk' },
  'c4-coding':   { cluster_id: 'cluster-4', agent_type: 'code',     agent_status: 'idle',  record: 'clear' },
  'c4-document': { cluster_id: 'cluster-4', agent_type: 'document', agent_status: 'idle',  record: 'high_risk' },
  'c4-data':     { cluster_id: 'cluster-4', agent_type: 'code',     agent_status: 'working', record: 'high_risk' },
};

// System nodes (patrol, superintendent, investigators, network) — always static
const systemNodes: Node[] = [
  { id: 'p1', type: 'patrol', position: { x: 280, y: 330 }, data: { label: 'Patrol-1', status: 'active' } },
  { id: 'p2', type: 'patrol', position: { x: 320, y: 330 }, data: { label: 'Patrol-2', status: 'active' } },
  { id: 'inv', type: 'superintendent', position: { x: 300, y: 360 }, data: { label: 'Superintendent', status: 'active' } },
  { id: 'f1', type: 'investigator', position: { x: 270, y: 400 }, data: { label: 'Investigator-1', status: 'active' } },
  { id: 'f2', type: 'investigator', position: { x: 330, y: 400 }, data: { label: 'Investigator-2', status: 'active' } },
  { id: 'net', type: 'network', position: { x: 300, y: 420 }, data: { label: 'Network', status: 'active' } },
];

const systemEdges: Edge[] = [
  {
    id: 'sys-f1-inv',
    source: 'f1',
    target: 'inv',
    type: 'dashed',
    data: { color: '#9b59b6' },
  },
  {
    id: 'sys-f2-inv',
    source: 'f2',
    target: 'inv',
    type: 'dashed',
    data: { color: '#9b59b6' },
  },
  {
    id: 'sys-net-inv',
    source: 'net',
    target: 'inv',
    type: 'dashed',
    data: { color: '#7c3aed' },
  },
];



export function BehavioralGraph({
  selectedAgentId,
  onSelectAgent,
  getAgentStatus,
  historicalAgentStates,
  isLive = true,
  patrolSelection,
  onPatrolSelect,
  showHeatmap = false,
  response,
  useMocks = false,
}: BehavioralGraphProps) {
  // Ensure client-side only rendering for animations to prevent hydration mismatch
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // ── Fetch live agent data from Bridge DB ─────────────────────────────────
  const { data: agentsResponse } = useAgentsRaw();
  const agentIds = useMemo(
    () => (agentsResponse?.agents ? Object.keys(agentsResponse.agents) : []),
    [agentsResponse]
  );
  const { data: violationCountsMap = {} } = useAgentViolationCounts(useMocks ? [] : agentIds);
  const violationMap = useMemo(() => {
    if (useMocks) {
      const m = new Map<string, number>();
      mockAgents.forEach((a, i) => m.set(a.id, mockViolationCounts[i]));
      return m;
    }
    return new Map(Object.entries(violationCountsMap));
  }, [useMocks, violationCountsMap]);

  // Build base nodes/edges from DB data (or fallback). Store in a ref so
  // positions are not recalculated on every render — only when the agent set changes.
  const baseAgentNodesRef = useRef<Node[]>([]);
  const baseAgentEdgesRef = useRef<Edge[]>([]);
  const clusterDefsRef = useRef<Array<{ prefix: string; label: string; ids: string[] }>>([]);
  const dbAgentIdsRef = useRef<string>('');

  const agentsDict = agentsResponse?.agents ?? null;
  // Use stable key to detect when the set of agents changes ('__fallback__' as initial sentinel)
  const agentIdsKey = agentsDict && Object.keys(agentsDict).length > 0
    ? Object.keys(agentsDict).sort().join(',')
    : '__fallback__';

  if (agentIdsKey !== dbAgentIdsRef.current) {
    const source = agentsDict && Object.keys(agentsDict).length > 0 ? agentsDict : FALLBACK_AGENTS;
    const { agentNodes, agentEdges, clusterDefs } = buildGraphFromDbAgents(source);
    baseAgentNodesRef.current = agentNodes;
    baseAgentEdgesRef.current = agentEdges;
    clusterDefsRef.current = clusterDefs;
    dbAgentIdsRef.current = agentIdsKey;
  }

  const baseAgentNodes = baseAgentNodesRef.current;
  const baseAgentEdges = baseAgentEdgesRef.current;
  const currentClusterDefs = clusterDefsRef.current;

  // Full initial node/edge lists combining DB agents + system nodes
  const initialNodes: Node[] = useMemo(
    () => [...baseAgentNodes, ...systemNodes],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentIdsKey]
  );
  const initialEdges: Edge[] = useMemo(
    () => [...baseAgentEdges, ...systemEdges],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentIdsKey]
  );

  // Keep a ref so onNodesChange can always read the latest edges without stale closure
  const initialEdgesRef = useRef<Edge[]>(initialEdges);
  initialEdgesRef.current = initialEdges;

  // Get the effective status for an agent (historical or live)
  const getEffectiveStatus = useCallback(
    (agentId: string): AgentStatus => {
      if (!isLive && historicalAgentStates && historicalAgentStates[agentId]) {
        return historicalAgentStates[agentId];
      }
      return getAgentStatus(agentId);
    },
    [isLive, historicalAgentStates, getAgentStatus]
  );

  // Track patrol connections (patrolId -> targetNodeId)
  const patrolConnections = useRef<Map<string, string>>(new Map());

  // Initialize state

  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Patrol click handler - toggles selection in sidebar
  const handlePatrolClick = useCallback((patrolId: string) => {
    // If clicking the same patrol that's already selected, deselect
    if (patrolSelection?.patrolId === patrolId) {
      onPatrolSelect(null);
      onSelectAgent(null);
      return;
    }

    // Find from initialNodes instead of state nodes to avoid dependency
    const patrolNode = initialNodes.find((n) => n.id === patrolId);
    if (patrolNode) {
      onPatrolSelect({
        patrolId,
        patrolLabel: patrolNode.data.label,
      });
      onSelectAgent(patrolId);
    }
  }, [onPatrolSelect, onSelectAgent, patrolSelection]);

  // Handle agent selection from sidebar (called via onPatrolAssign)
  const handleAgentAssignment = useCallback(
    (patrolId: string, targetNodeId: string) => {

      setNodes((currentNodes) => {
        const nodesList = currentNodes as Node[];

        // Find the patrol and target nodes
        const patrolNode = nodesList.find((n) => n.id === patrolId);
        const targetNode = nodesList.find((n) => n.id === targetNodeId);

        if (!patrolNode || !targetNode || !patrolNode.position || !targetNode.position) {
          return currentNodes;
        }

        // Store connection
        patrolConnections.current.set(patrolId, targetNodeId);

        // Calculate distance between nodes
        const patrolRadius = NODE_RADII[patrolNode.type || 'patrol'] || 20;
        const targetRadius = NODE_RADII.agent;

        const patrolCenterX = patrolNode.position.x + patrolRadius;
        const patrolCenterY = patrolNode.position.y + patrolRadius;
        const targetCenterX = targetNode.position.x + targetRadius;
        const targetCenterY = targetNode.position.y + targetRadius;

        const dx = targetCenterX - patrolCenterX;
        const dy = targetCenterY - patrolCenterY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        // Store edge length for physics
        const edgeId = `patrol-${patrolId}-${targetNodeId}`;

        // Move patrol closer to the target agent (about 100px away)
        const desiredDistance = 100;
        let newPatrolCenterX = patrolCenterX;
        let newPatrolCenterY = patrolCenterY;

        if (currentDistance > desiredDistance) {
          const ratio = desiredDistance / currentDistance;
          newPatrolCenterX = targetCenterX - dx * ratio;
          newPatrolCenterY = targetCenterY - dy * ratio;
        }

        const newPos = {
          x: newPatrolCenterX - patrolRadius,
          y: newPatrolCenterY - patrolRadius,
        };

        const newDx = targetCenterX - newPatrolCenterX;
        const newDy = targetCenterY - newPatrolCenterY;
        const newDistance = Math.sqrt(newDx * newDx + newDy * newDy);
        edgeLengths.set(edgeId, newDistance);

        setEdges((currentEdges) => {
          const filteredEdges = currentEdges.filter((edge) => edge.source !== patrolId);
          return [
            ...filteredEdges,
            {
              id: edgeId,
              source: patrolId,
              target: targetNodeId,
              type: 'animated',
              data: { color: '#00d4ff', animated: true },
            },
          ];
        });

        if (patrolId === 'p1' || patrolId === 'p2') {
          // Slide patrol agents smoothly to target instead of respawning/snapping
          patrolTarget.current[patrolId as 'p1' | 'p2'] = newPos;
          return currentNodes;
        } else {
          // Snap to position
          return nodesList.map((n) => {
            if (n.id === patrolId) {
              return { ...n, position: newPos };
            }
            return n;
          });
        }
      });

      // Notify parent that assignment is complete
      onPatrolSelect(null);
    },
    [setNodes, setEdges, onPatrolSelect]
  );

  // When response enters patrol_moving (from triggerManual or notification), drive graph layout
  const lastHandledAssignment = useRef<string | null>(null);
  useEffect(() => {
    if (response?.phase !== 'patrol_moving' || !response.patrolId || !response.flaggedAgentId) {
      lastHandledAssignment.current = null;
      return;
    }
    const key = `${response.patrolId}-${response.flaggedAgentId}`;
    if (lastHandledAssignment.current === key) return;
    lastHandledAssignment.current = key;
    handleAgentAssignment(response.patrolId, response.flaggedAgentId);
  }, [response?.phase, response?.patrolId, response?.flaggedAgentId, handleAgentAssignment]);

  // Update nodes with current status and selection state
  const nodesWithStatus = useMemo(() => {
    return initialNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === selectedAgentId,
        currentStatus: node.type === 'agent' ? getEffectiveStatus(node.id) : undefined,
        // Add click handler for patrol nodes
        ...(node.type === 'patrol' && {
          onPatrolClick: handlePatrolClick,
        }),
      },
    }));
  }, [initialNodes, selectedAgentId, getEffectiveStatus, handlePatrolClick]);

  // Update edges based on agent states
  const edgesWithStatus = useMemo(() => {
    return initialEdges.map((edge) => {
      // Update system edges (superintendent/investigator connections) based on target agent status
      if (edge.id.startsWith('sys-')) {
        const targetStatus = getEffectiveStatus(edge.target);
        const isInvestigating = targetStatus === 'working' || targetStatus === 'restricted';
        return {
          ...edge,
          data: {
            ...edge.data,
            animated: isInvestigating,
          },
        };
      }
      return edge;
    });
  }, [initialEdges, getEffectiveStatus]);

  // Initialize edge lengths on first render, and re-initialize when agent set changes
  const edgeLengthsInitialized = useRef(false);

  // Reset edge-length cache when DB agent set changes
  useEffect(() => {
    edgeLengthsInitialized.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentIdsKey]);

  useEffect(() => {
    if (!edgeLengthsInitialized.current && nodes.length > 0) {
      // Calculate and store initial edge lengths
      initialEdgesRef.current.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        if (sourceNode && targetNode) {
          const sourceRadius = NODE_RADII[sourceNode.type || 'agent'] || 32;
          const targetRadius = NODE_RADII[targetNode.type || 'agent'] || 32;

          const sourceCenterX = sourceNode.position.x + sourceRadius;
          const sourceCenterY = sourceNode.position.y + sourceRadius;
          const targetCenterX = targetNode.position.x + targetRadius;
          const targetCenterY = targetNode.position.y + targetRadius;

          const length = calculateDistance(
            { x: sourceCenterX, y: sourceCenterY },
            { x: targetCenterX, y: targetCenterY }
          );

          edgeLengths.set(edge.id, length);
        }
      });

      edgeLengthsInitialized.current = true;
    }
  }, [nodes]);

  // Custom node change handler with collision physics and fixed-length constraints
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // First apply the base changes
      onNodesChangeBase(changes);

      // Track patrol drag state and sync positions back into patrolPos
      changes.forEach((change) => {
        if (change.type === 'position' && (change.id === 'p1' || change.id === 'p2')) {
          const pid = change.id as 'p1' | 'p2';
          if (change.dragging && change.position) {
            patrolDragging.current[pid] = true;
            patrolPos.current[pid] = change.position;
            patrolTarget.current[pid] = change.position;
          } else if (!change.dragging) {
            patrolDragging.current[pid] = false;
          }
        }
      });

      // Check for position changes (dragging)
      const positionChanges = changes.filter(
        (change): change is NodePositionChange =>
          change.type === 'position' && change.dragging === true && change.position !== undefined
      );

      if (positionChanges.length === 0) return;

      // Apply fixed-length constraints and collision resolution
      setNodes((currentNodes) => {
        let updatedNodes = [...currentNodes];

        // Apply fixed-length constraints for dragged nodes
        const draggedNodeIds = new Set(positionChanges.map((c) => c.id));
        const processedNodes = new Set<string>();

        // Iteratively apply constraints to maintain fixed edge lengths
        const constraintIterations = 3;
        for (let iter = 0; iter < constraintIterations; iter++) {
          const nodesToProcess = [...draggedNodeIds];

          while (nodesToProcess.length > 0) {
            const nodeId = nodesToProcess.shift()!;
            if (processedNodes.has(nodeId) && iter > 0) continue;
            processedNodes.add(nodeId);

            const draggedNode = updatedNodes.find((n) => n.id === nodeId);
            if (!draggedNode || draggedNode.draggable === false) continue;

            // Find all edges connected to this node (cluster edges + investigator edges, not system edges)
            const connectedEdges = [...initialEdgesRef.current, ...edges].filter(
              (edge) =>
                !edge.id.startsWith('sys-') &&
                (edge.source === nodeId || edge.target === nodeId)
            );

            // For each connected edge, adjust the connected node to maintain fixed length
            connectedEdges.forEach((edge) => {
              const isSource = edge.source === nodeId;
              const connectedNodeId = isSource ? edge.target : edge.source;
              const connectedNode = updatedNodes.find((n) => n.id === connectedNodeId);

              if (!connectedNode || connectedNode.draggable === false) return;

              const fixedLength = edgeLengths.get(edge.id);
              if (!fixedLength) return;

              const draggedRadius = NODE_RADII[draggedNode.type || 'agent'] || 32;
              const connectedRadius = NODE_RADII[connectedNode.type || 'agent'] || 32;

              const draggedCenterX = draggedNode.position.x + draggedRadius;
              const draggedCenterY = draggedNode.position.y + draggedRadius;
              const connectedCenterX = connectedNode.position.x + connectedRadius;
              const connectedCenterY = connectedNode.position.y + connectedRadius;

              // Calculate current distance
              const dx = connectedCenterX - draggedCenterX;
              const dy = connectedCenterY - draggedCenterY;
              const currentDistance = Math.sqrt(dx * dx + dy * dy);

              if (currentDistance > 0.1) {
                // Calculate new position to maintain fixed length
                const ratio = fixedLength / currentDistance;
                const newConnectedCenterX = draggedCenterX + dx * ratio;
                const newConnectedCenterY = draggedCenterY + dy * ratio;

                // Update the connected node position
                const nodeIndex = updatedNodes.findIndex((n) => n.id === connectedNodeId);
                if (nodeIndex !== -1) {
                  updatedNodes[nodeIndex] = {
                    ...updatedNodes[nodeIndex],
                    position: {
                      x: newConnectedCenterX - connectedRadius,
                      y: newConnectedCenterY - connectedRadius,
                    },
                  };

                  // Add this node to be processed for its connections
                  if (!draggedNodeIds.has(connectedNodeId)) {
                    nodesToProcess.push(connectedNodeId);
                    draggedNodeIds.add(connectedNodeId);
                  }
                }
              }
            });
          }
        }

        // Apply collision resolution
        {
          let hasCollision = true;
          let iterations = 0;
          const maxIterations = 10;

          while (hasCollision && iterations < maxIterations) {
            hasCollision = false;
            iterations++;

            for (let i = 0; i < updatedNodes.length; i++) {
              for (let j = i + 1; j < updatedNodes.length; j++) {
                const nodeA = updatedNodes[i];
                const nodeB = updatedNodes[j];

                const nodeAIsDraggable = nodeA.draggable !== false;
                const nodeBIsDraggable = nodeB.draggable !== false;

              const radiusA = NODE_RADII[nodeA.type || 'agent'] || 32;
              const radiusB = NODE_RADII[nodeB.type || 'agent'] || 32;

              const centerAX = nodeA.position.x + radiusA;
              const centerAY = nodeA.position.y + radiusA;
              const centerBX = nodeB.position.x + radiusB;
              const centerBY = nodeB.position.y + radiusB;

              const dx = centerBX - centerAX;
              const dy = centerBY - centerAY;
              const distance = Math.sqrt(dx * dx + dy * dy);

              const minDistance = radiusA + radiusB + 8;

              if (distance < minDistance && distance > 0) {
                hasCollision = true;

                const overlap = minDistance - distance;
                const nx = dx / distance;
                const ny = dy / distance;

                const nodeAWasDragged = draggedNodeIds.has(nodeA.id);
                const nodeBWasDragged = draggedNodeIds.has(nodeB.id);

                if (nodeAWasDragged && nodeBIsDraggable) {
                  updatedNodes[j] = {
                    ...nodeB,
                    position: {
                      x: nodeB.position.x + nx * overlap,
                      y: nodeB.position.y + ny * overlap,
                    },
                  };
                } else if (nodeBWasDragged && nodeAIsDraggable) {
                  updatedNodes[i] = {
                    ...nodeA,
                    position: {
                      x: nodeA.position.x - nx * overlap,
                      y: nodeA.position.y - ny * overlap,
                    },
                  };
                } else if (nodeAIsDraggable && nodeBIsDraggable) {
                  const halfOverlap = overlap / 2;
                  updatedNodes[i] = {
                    ...nodeA,
                    position: {
                      x: nodeA.position.x - nx * halfOverlap,
                      y: nodeA.position.y - ny * halfOverlap,
                    },
                  };
                  updatedNodes[j] = {
                    ...nodeB,
                    position: {
                      x: nodeB.position.x + nx * halfOverlap,
                      y: nodeB.position.y + ny * halfOverlap,
                    },
                  };
                } else if (nodeAIsDraggable) {
                  updatedNodes[i] = {
                    ...nodeA,
                    position: {
                      x: nodeA.position.x - nx * overlap,
                      y: nodeA.position.y - ny * overlap,
                    },
                  };
                } else if (nodeBIsDraggable) {
                  updatedNodes[j] = {
                    ...nodeB,
                    position: {
                      x: nodeB.position.x + nx * overlap,
                      y: nodeB.position.y + ny * overlap,
                    },
                  };
                }
              }
            }
          }
        }
        }

        return updatedNodes;
      });
    },
    [onNodesChangeBase, setNodes]
  );

  // Track current patrol positions in a ref so the status-update effect preserves them
  const patrolPos = useRef({ p1: { x: 280, y: 330 }, p2: { x: 320, y: 330 } });
  const patrolTarget = useRef({ p1: { x: 280, y: 330 }, p2: { x: 320, y: 330 } });
  const patrolDragging = useRef({ p1: false, p2: false });
  const isMounted = useRef(false);

  // System entity home positions (match systemNodes initial positions)
  const NET_HOME = { x: 300, y: 420 };
  const F1_HOME  = { x: 270, y: 400 };

  // Track net/f1 positions for lerp-based response movement
  const netPos    = useRef(NET_HOME);
  const netTarget = useRef(NET_HOME);
  const f1Pos     = useRef(F1_HOME);
  const f1Target  = useRef(F1_HOME);

  // Keep a ref to the latest response state so the lerp loop can read it without stale closure
  const responseRef = useRef(response);
  responseRef.current = response;

  // Random walk: pick new targets every 2s, glide towards them at ~30fps
  useEffect(() => {
    // Don't start animation until client-side hydration is complete
    if (!isClient) return;

    isMounted.current = true;

    const pickTargets = () => {
      const wander = (pos: { x: number; y: number }) => ({
        x: Math.max(200, Math.min(400, pos.x + (Math.random() - 0.5) * 100)),
        y: Math.max(250, Math.min(450, pos.y + (Math.random() - 0.5) * 100)),
      });
      if (!patrolConnections.current.has('p1')) {
        patrolTarget.current.p1 = wander(patrolPos.current.p1);
      }
      if (!patrolConnections.current.has('p2')) {
        patrolTarget.current.p2 = wander(patrolPos.current.p2);
      }
    };

    const targetTimer = setInterval(pickTargets, 2000);

    const moveTimer = setInterval(() => {
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const t = 0.04;
      const newP1 = (patrolConnections.current.has('p1') || patrolDragging.current.p1) ? patrolPos.current.p1 : {
        x: lerp(patrolPos.current.p1.x, patrolTarget.current.p1.x, t),
        y: lerp(patrolPos.current.p1.y, patrolTarget.current.p1.y, t),
      };
      const newP2 = (patrolConnections.current.has('p2') || patrolDragging.current.p2) ? patrolPos.current.p2 : {
        x: lerp(patrolPos.current.p2.x, patrolTarget.current.p2.x, t),
        y: lerp(patrolPos.current.p2.y, patrolTarget.current.p2.y, t),
      };
      patrolPos.current.p1 = newP1;
      patrolPos.current.p2 = newP2;

      // Update net/f1 targets from response state
      const rs = responseRef.current;
      const isResponseActive = rs && rs.phase !== 'idle' && rs.phase !== 'patrol_moving';
      if (isResponseActive && rs) {
        if (rs.phase === 'summoning' || rs.phase === 'at_scene') {
          // Move toward flagged agent
          if (rs.networkTargetPos) netTarget.current = rs.networkTargetPos;
          if (rs.investigatorTargetPos) f1Target.current = rs.investigatorTargetPos;
        } else if (rs.phase === 'returning' || rs.phase === 'reporting') {
          netTarget.current = NET_HOME;
          f1Target.current = F1_HOME;
        }
      } else {
        // Return home when idle
        netTarget.current = NET_HOME;
        f1Target.current = F1_HOME;
      }

      const tFast = 0.06;
      const newNet = {
        x: lerp(netPos.current.x, netTarget.current.x, tFast),
        y: lerp(netPos.current.y, netTarget.current.y, tFast),
      };
      const newF1 = {
        x: lerp(f1Pos.current.x, f1Target.current.x, tFast),
        y: lerp(f1Pos.current.y, f1Target.current.y, tFast),
      };
      netPos.current = newNet;
      f1Pos.current = newF1;

      setNodes((nds) => {
        // First update patrol + net/f1 positions
        let updatedNodes = nds.map((n) => {
          if (n.id === 'p1') return { ...n, position: newP1 };
          if (n.id === 'p2') return { ...n, position: newP2 };
          if (n.id === 'net') return { ...n, position: newNet };
          if (n.id === 'f1') return { ...n, position: newF1 };
          return n;
        });

        // Apply collision resolution for patrol nodes pushing others
        const patrolIds = ['p1', 'p2'];
        let hasCollision = true;
        let iterations = 0;

        while (hasCollision && iterations < 5) {
          hasCollision = false;
          iterations++;

          for (const patrolId of patrolIds) {
            const patrolNode = updatedNodes.find((n) => n.id === patrolId);
            if (!patrolNode) continue;

            const patrolRadius = NODE_RADII.patrol;
            const patrolCenterX = patrolNode.position.x + patrolRadius;
            const patrolCenterY = patrolNode.position.y + patrolRadius;

            updatedNodes = updatedNodes.map((node) => {
              if (node.id === patrolId || node.draggable === false) return node;

              const nodeRadius = NODE_RADII[node.type || 'agent'] || 32;
              const nodeCenterX = node.position.x + nodeRadius;
              const nodeCenterY = node.position.y + nodeRadius;

              const dx = nodeCenterX - patrolCenterX;
              const dy = nodeCenterY - patrolCenterY;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const minDistance = patrolRadius + nodeRadius + 8;

              if (distance < minDistance && distance > 0) {
                hasCollision = true;
                const overlap = minDistance - distance;
                const nx = dx / distance;
                const ny = dy / distance;

                return {
                  ...node,
                  position: {
                    x: node.position.x + nx * overlap,
                    y: node.position.y + ny * overlap,
                  },
                };
              }

              return node;
            });
          }
        }

        return updatedNodes;
      });
    }, 33);

    return () => {
      isMounted.current = false;
      clearInterval(targetTimer);
      clearInterval(moveTimer);
    };
  }, [isClient, setNodes]);

  // Update nodes when selection or status changes, preserving all current positions
  useEffect(() => {
    setNodes((currentNodes) => {
      // Create a map of current positions
      const currentPositions = new Map(
        currentNodes.map((node) => [node.id, node.position])
      );

      return nodesWithStatus.map((n) => {
        // Preserve current position if it exists, otherwise use the new position
        const preservedPosition = currentPositions.get(n.id) || n.position;

        // Special handling for patrol nodes to use their animated positions
        if (n.id === 'p1') return { ...n, position: patrolPos.current.p1 };
        if (n.id === 'p2') return { ...n, position: patrolPos.current.p2 };

        return { ...n, position: preservedPosition };
      });
    });
  }, [nodesWithStatus, setNodes]);

  // Update edges when status changes
  useEffect(() => {
    setEdges(edgesWithStatus);
  }, [edgesWithStatus, setEdges]);

  // ── Response sequence: inject/remove edges and flag the agent node ──────────
  useEffect(() => {
    const phase = response?.phase ?? 'idle';
    const flaggedId = response?.flaggedAgentId ?? null;
    const patrolId = response?.patrolId ?? null;

    // Edges to add per phase
    const responseEdgeIds = ['resp-patrol-agent', 'resp-f1-agent', 'resp-net-agent'];

    if (phase === 'idle' || phase === 'patrol_moving') {
      // Remove all response edges; clear isUnderInvestigation
      setEdges((eds) => eds.filter((e) => !responseEdgeIds.includes(e.id)));
      setNodes((nds) => nds.map((n) =>
        n.type === 'agent' ? { ...n, data: { ...n.data, isUnderInvestigation: false } } : n
      ));
      return;
    }

    if (!flaggedId) return;

    // Mark flagged agent as under investigation
    const isAtScene = phase === 'at_scene' || phase === 'summoning' || phase === 'returning';
    setNodes((nds) => nds.map((n) =>
      n.id === flaggedId
        ? { ...n, data: { ...n.data, isUnderInvestigation: isAtScene } }
        : n.type === 'agent'
          ? { ...n, data: { ...n.data, isUnderInvestigation: false } }
          : n
    ));

    // Build response edges
    const newEdges: Edge[] = [];

    if (patrolId && (phase === 'summoning' || phase === 'at_scene' || phase === 'returning')) {
      newEdges.push({
        id: 'resp-patrol-agent',
        source: patrolId,
        target: flaggedId,
        type: 'glowing',
        data: { color: '#00d4ff' },
      });
    }

    if (phase === 'summoning' || phase === 'at_scene' || phase === 'returning') {
      newEdges.push({
        id: 'resp-f1-agent',
        source: 'f1',
        target: flaggedId,
        type: 'dashed',
        data: { color: '#9b59b6', animated: true },
      });
      newEdges.push({
        id: 'resp-net-agent',
        source: 'net',
        target: flaggedId,
        type: 'dashed',
        data: { color: '#7c3aed', animated: true },
      });
    }

    setEdges((eds) => {
      const filtered = eds.filter((e) => !responseEdgeIds.includes(e.id));
      return [...filtered, ...newEdges];
    });
  }, [response?.phase, response?.flaggedAgentId, response?.patrolId, setEdges, setNodes]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const selectable = node.type === 'agent' || node.type === 'investigator' || node.type === 'network' || node.type === 'superintendent';
      if (selectable) {
        onSelectAgent(node.id === selectedAgentId ? null : node.id);
      }
    },
    [onSelectAgent, selectedAgentId]
  );

  // Click on background to deselect
  const onPaneClick = useCallback(() => {
    onSelectAgent(null);
  }, [onSelectAgent]);

  return (
    <div className="h-full flex flex-col bg-[#0a0e1a]">
      {/* Historical mode indicator */}
      {!isLive && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-[#ffaa00]/20 text-[#ffaa00] px-3 py-1 rounded-full text-xs font-medium border border-[#ffaa00]/30">
          Historical View
        </div>
      )}

      {/* Graph Area */}
      <div className="flex-1 relative">
        {isClient ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.5}
            maxZoom={1.5}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={[0]}
            zoomOnScroll={true}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#1f2937"
            />
            {showHeatmap && (
              <HeatmapOverlay nodes={nodes} getEffectiveStatus={getEffectiveStatus} clusterDefs={currentClusterDefs} violationMap={violationMap} />
            )}
          </ReactFlow>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading graph...</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Heatmap Overlay ──────────────────────────────────────────────────────────
// Renders smooth blob cluster zones + per-agent radial threat glows behind nodes

const HEATMAP_STATUS_COLORS: Record<AgentStatus, string> = {
  working:    '#00c853',
  idle:       '#4a9eff',
  restricted: '#ffaa00',
  suspended:  '#6b7280',
};

type Vec2 = { x: number; y: number };

// ── Convex Hull (Gift-wrapping / Jarvis march) ───────────────────────────────
function convexHull(pts: Vec2[]): Vec2[] {
  if (pts.length < 3) return pts;
  const n = pts.length;
  // Find the leftmost point
  let start = 0;
  for (let i = 1; i < n; i++) if (pts[i].x < pts[start].x) start = i;

  const hull: Vec2[] = [];
  let cur = start;
  do {
    hull.push(pts[cur]);
    let next = (cur + 1) % n;
    for (let i = 0; i < n; i++) {
      const cross =
        (pts[next].x - pts[cur].x) * (pts[i].y - pts[cur].y) -
        (pts[next].y - pts[cur].y) * (pts[i].x - pts[cur].x);
      if (cross < 0) next = i;
    }
    cur = next;
  } while (cur !== start);
  return hull;
}

// ── Expand hull outward from its centroid by `pad` pixels ───────────────────
function expandHull(hull: Vec2[], pad: number): Vec2[] {
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
  });
}

// ── Convert hull points to a smooth closed SVG blob path (catmull-rom) ───────
function smoothBlobPath(pts: Vec2[], tension = 0.4): string {
  if (pts.length < 2) return '';
  const n = pts.length;

  // Wrap-around: prepend last point and append first two
  const wrapped = [pts[n - 1], ...pts, pts[0], pts[1]];

  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = wrapped[i];
    const p1 = wrapped[i + 1];
    const p2 = wrapped[i + 2];
    const p3 = wrapped[i + 3];

    // Catmull-Rom → cubic bezier control points
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d + ' Z';
}

function HeatmapOverlay({
  nodes,
  getEffectiveStatus,
  clusterDefs,
  violationMap,
}: {
  nodes: Node[];
  getEffectiveStatus: (agentId: string) => AgentStatus;
  clusterDefs: Array<{ prefix: string; label: string; ids: string[] }>;
  violationMap: Map<string, number>;
}) {
  const { x, y, zoom } = useViewport();

  // Build a position map from live node state (center of each agent node)
  const posMap = useMemo(() => {
    const m = new Map<string, Vec2>();
    for (const n of nodes) {
      if (n.type === 'agent') {
        const r = NODE_RADII.agent;
        m.set(n.id, { x: n.position.x + r, y: n.position.y + r });
      }
    }
    return m;
  }, [nodes]);

  // Compute smooth blob paths for each cluster
  const clusterBlobs = useMemo(() => {
    return clusterDefs.map((cluster) => {
      const positions = cluster.ids.map((id) => posMap.get(id)).filter(Boolean) as Vec2[];
      if (positions.length === 0) return null;

      const hull = convexHull(positions);
      const expanded = expandHull(hull, 68);
      const path = smoothBlobPath(expanded, 0.38);

      // Worst status in cluster
      const statuses = cluster.ids.map((id) => getEffectiveStatus(id));
      let worstStatus: AgentStatus = 'idle';
      if (statuses.includes('restricted')) worstStatus = 'restricted';
      else if (statuses.includes('suspended')) worstStatus = 'suspended';
      else if (statuses.includes('working')) worstStatus = 'working';

      const color = HEATMAP_STATUS_COLORS[worstStatus];
      const fillOpacity = worstStatus === 'restricted' ? 0.07 : worstStatus === 'working' ? 0.05 : 0.025;
      const strokeOpacity = worstStatus === 'restricted' ? 0.25 : worstStatus === 'working' ? 0.18 : 0.08;

      return { key: cluster.prefix, path, color, fillOpacity, strokeOpacity };
    }).filter(Boolean);
  }, [posMap, getEffectiveStatus, clusterDefs]);

  // Per-agent radial glows
  const agentGlows = useMemo(() => {
    return Array.from(posMap.entries()).map(([id, pos]) => {
      const status = getEffectiveStatus(id);
      const violations = violationMap.get(id) || 0;

      if (status === 'idle' && violations === 0) return null;

      const color = HEATMAP_STATUS_COLORS[status];
      const baseRadius = 50;
      const statusBonus = status === 'restricted' ? 40 : status === 'working' ? 20 : 0;
      const violationBonus = violations * 15;
      const radius = baseRadius + statusBonus + violationBonus;
      const opacity = status === 'restricted' ? 0.35 : status === 'working' ? 0.2 : 0.1;

      return { key: id, cx: pos.x, cy: pos.y, radius, color, opacity };
    }).filter(Boolean);
  }, [posMap, getEffectiveStatus, violationMap]);

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <defs>
        {agentGlows.map((glow) =>
          glow ? (
            <radialGradient key={`grad-${glow.key}`} id={`glow-${glow.key}`}>
              <stop offset="0%" stopColor={glow.color} stopOpacity={glow.opacity} />
              <stop offset="70%" stopColor={glow.color} stopOpacity={glow.opacity * 0.3} />
              <stop offset="100%" stopColor={glow.color} stopOpacity={0} />
            </radialGradient>
          ) : null
        )}
      </defs>

      <g transform={`translate(${x}, ${y}) scale(${zoom})`}>
        {/* Smooth blob cluster zones */}
        {clusterBlobs.map((blob) =>
          blob ? (
            <path
              key={blob.key}
              d={blob.path}
              fill={blob.color}
              fillOpacity={blob.fillOpacity}
              stroke={blob.color}
              strokeOpacity={blob.strokeOpacity}
              strokeWidth={1.5 / zoom}
            />
          ) : null
        )}

        {/* Per-agent radial glows */}
        {agentGlows.map((glow) =>
          glow ? (
            <circle
              key={glow.key}
              cx={glow.cx}
              cy={glow.cy}
              r={glow.radius}
              fill={`url(#glow-${glow.key})`}
            />
          ) : null
        )}
      </g>
    </svg>
  );
}
