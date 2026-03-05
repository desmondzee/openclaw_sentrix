'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { AgentStatus } from '../../types';

interface BaseNodeData {
  label: string;
  status: string;
  record?: string;
  isSelected?: boolean;
  currentStatus?: AgentStatus;
  onPatrolClick?: (nodeId: string) => void;
  isUnderInvestigation?: boolean;
}

// Agent Node — colors by record: clear=blue, low_risk=yellow, high_risk=red
const RECORD_COLORS: Record<string, { bg: string; border: string }> = {
  clear:     { bg: '#1e3a5f', border: '#3b82f6' },
  low_risk:  { bg: '#3a3500', border: '#eab308' },
  high_risk: { bg: '#3a1a1a', border: '#ff3355' },
};

export const AgentNode = memo(function AgentNode({ data }: NodeProps<BaseNodeData>) {
  const status = data.currentStatus || data.status;
  const record = (data.record as string) || 'clear';
  const recordStyles = RECORD_COLORS[record] ?? RECORD_COLORS.clear;

  const getStyles = () => {
    switch (status) {
      case 'working':
        return { ...recordStyles, pulse: false };
      case 'restricted':
        return { bg: recordStyles.bg, border: '#ffaa00', pulse: false, subtlePulse: true };
      case 'suspended':
        return { bg: '#1f2937', border: '#6b7280', pulse: false };
      default: // idle
        return { ...recordStyles, pulse: false };
    }
  };

  const styles = getStyles();

  return (
    <div className="relative">
      {/* Investigation alert ring — pulsing red when under investigation */}
      {data.isUnderInvestigation && (
        <div
          className="absolute rounded-full animate-ping"
          style={{
            inset: '-6px',
            backgroundColor: 'transparent',
            border: '2px solid #ef4444',
            opacity: 0.7,
          }}
        />
      )}
      {data.isUnderInvestigation && (
        <div
          className="absolute rounded-full"
          style={{
            inset: '-6px',
            backgroundColor: 'transparent',
            border: '2px solid #ef4444',
            opacity: 0.4,
          }}
        />
      )}

      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all ${
          data.isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a]' : ''
        } ${styles.subtlePulse ? 'pulse-warning' : ''}`}
        style={{
          backgroundColor: styles.bg,
          border: `2px solid ${data.isUnderInvestigation ? '#ef4444' : styles.border}`,
          boxShadow: data.isUnderInvestigation
            ? '0 0 20px #ef4444'
            : data.isSelected ? `0 0 20px ${styles.border}` : 'none',
        }}
      >
        <span className="text-[8px] text-center text-white/80 px-1 leading-tight">
          {data.label}
        </span>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
    </div>
  );
});

// Tripwire Node - Diamond
export const TripwireNode = memo(function TripwireNode({ data }: NodeProps<BaseNodeData>) {
  return (
    <div className="relative">
      <svg width="50" height="50" viewBox="0 0 50 50" className="cursor-pointer">
        <polygon
          points="25,2 48,25 25,48 2,25"
          fill="#3a0010"
          stroke="#ff3355"
          strokeWidth="2"
          className={data.isSelected ? 'filter drop-shadow-[0_0_10px_#ff3355]' : ''}
        />
        <text
          x="25"
          y="25"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize="7"
          className="pointer-events-none"
        >
          {data.label}
        </text>
      </svg>

      <Handle type="target" position={Position.Top} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
    </div>
  );
});

// Patrol Node - Hexagon
export const PatrolNode = memo(function PatrolNode({ data, id }: NodeProps<BaseNodeData>) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data.onPatrolClick) {
      data.onPatrolClick(id);
    }
  };

  return (
    <div className="relative">
      <div onClick={handleClick} className="cursor-pointer transition-transform hover:scale-110">
        <svg width="40" height="36" viewBox="0 0 40 36">
          <polygon
            points="10,0 30,0 40,18 30,36 10,36 0,18"
            fill="#1a1a3a"
            stroke="#9b59b6"
            strokeWidth="2"
            className={data.isSelected ? 'filter drop-shadow-[0_0_10px_#9b59b6]' : ''}
          />
          <text
            x="20"
            y="18"
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#9b59b6"
            fontSize="6"
            className="pointer-events-none"
          >
            {data.label}
          </text>
        </svg>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
    </div>
  );
});

// Superintendent Node - Larger circle with distinct style
export const SuperintendentNode = memo(function SuperintendentNode({ data }: NodeProps<BaseNodeData>) {
  return (
    <div className="relative">
      <div
        className={`w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all ${
          data.isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a]' : ''
        }`}
        style={{
          backgroundColor: '#1a1a3a',
          border: '2px solid #9b59b6',
          boxShadow: data.isSelected ? '0 0 20px #9b59b6' : 'none',
        }}
      >
        <span className="text-[7px] text-center text-[#9b59b6] px-1 leading-tight font-semibold">
          {data.label}
        </span>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
    </div>
  );
});

// Investigator Node - Clickable circle that opens agent selection modal
export const InvestigatorNode = memo(function InvestigatorNode({ data, id }: NodeProps<BaseNodeData>) {
  return (
    <div className="relative">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          data.isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a]' : ''
        }`}
        style={{
          backgroundColor: '#2a1a3a',
          border: '2px solid #9b59b6',
          boxShadow: data.isSelected ? '0 0 20px #9b59b6' : 'none',
        }}
      >
        <span className="text-[7px] text-center text-[#9b59b6] px-1 leading-tight">
          {data.label}
        </span>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
    </div>
  );
});

// Network Node - Octagon-style circle with violet/teal color
export const NetworkNode = memo(function NetworkNode({ data }: NodeProps<BaseNodeData>) {
  return (
    <div className="relative">
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          data.isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0a0e1a]' : ''
        }`}
        style={{
          backgroundColor: '#1a1a3a',
          border: '2px solid #7c3aed',
          boxShadow: data.isSelected ? '0 0 20px #7c3aed' : 'none',
        }}
      >
        <span className="text-[7px] text-center text-[#7c3aed] px-1 leading-tight">
          {data.label}
        </span>
      </div>

      <Handle type="target" position={Position.Top} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !top-1/2 !left-1/2 !-translate-x-1/2 !-translate-y-1/2" />
    </div>
  );
});

export const nodeTypes = {
  agent: AgentNode,
  tripwire: TripwireNode,
  patrol: PatrolNode,
  superintendent: SuperintendentNode,
  investigator: InvestigatorNode,
  network: NetworkNode,
};
