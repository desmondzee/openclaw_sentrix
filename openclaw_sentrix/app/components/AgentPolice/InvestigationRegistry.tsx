'use client';

import { useState, useMemo } from 'react';
import type { InvestigationReport } from '@/lib/investigationReports';

interface InvestigationRegistryProps {
  reports: InvestigationReport[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

const severityColors: Record<string, string> = {
  LOW: '#00c853',
  MEDIUM: '#ffaa00',
  HIGH: '#ff6b35',
  CRITICAL: '#ff3355',
};

const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getVerdictFromReport(report: InvestigationReport): 'guilty' | 'not_guilty' | 'under_watch' {
  const facts = (report.case_file.case_facts || '').toLowerCase();
  const summary = (report.case_file.verdict_summary || '').toLowerCase();
  const combined = facts + ' ' + summary;
  
  if (combined.includes('not guilty') || combined.includes('false positive') || combined.includes('cleared')) {
    return 'not_guilty';
  }
  if (combined.includes('guilty') || combined.includes('violation') || combined.includes('confirmed')) {
    return 'guilty';
  }
  return 'under_watch';
}

const verdictConfig: Record<string, { label: string; color: string; bg: string }> = {
  guilty: { label: 'Violation', color: '#ff3355', bg: 'rgba(255,51,85,0.15)' },
  not_guilty: { label: 'Cleared', color: '#00c853', bg: 'rgba(0,200,83,0.15)' },
  under_watch: { label: 'Inconclusive', color: '#ffaa00', bg: 'rgba(255,170,0,0.15)' },
};

export function InvestigationRegistry({
  reports,
  selectedId,
  onSelect,
  className = '',
}: InvestigationRegistryProps) {
  const [filter, setFilter] = useState<'all' | 'unviewed'>('all');

  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      const sevA = severityOrder.indexOf(a.case_file.severity_score || 'LOW');
      const sevB = severityOrder.indexOf(b.case_file.severity_score || 'LOW');
      if (sevA !== sevB) return sevA - sevB;
      return new Date(b.concluded_at).getTime() - new Date(a.concluded_at).getTime();
    });
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (filter === 'unviewed') {
      return sortedReports.filter(r => !r.viewed);
    }
    return sortedReports;
  }, [sortedReports, filter]);

  const unviewedCount = useMemo(() => reports.filter(r => !r.viewed).length, [reports]);

  return (
    <div className={`flex flex-col bg-[#0a0f1c] border-0 rounded-none overflow-hidden h-full ${className}`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[var(--pixel-border)] bg-[#0d1320]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono font-semibold text-[var(--foreground)]">
            Investigation Reports
          </h3>
          {unviewedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#ff3355]/20 text-[#ff3355] font-mono">
              {unviewedCount} new
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-2 py-2 border-b border-[var(--pixel-border)] flex gap-1">
        <button
          onClick={() => setFilter('all')}
          className={`flex-1 text-[10px] py-1 px-2 rounded transition-colors font-mono cursor-pointer ${
            filter === 'all'
              ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
              : 'text-[#6b7280] hover:text-[#9ca3af]'
          }`}
        >
          All ({reports.length})
        </button>
        <button
          onClick={() => setFilter('unviewed')}
          className={`flex-1 text-[10px] py-1 px-2 rounded transition-colors font-mono cursor-pointer ${
            filter === 'unviewed'
              ? 'bg-[#ff3355]/20 text-[#ff3355]'
              : 'text-[#6b7280] hover:text-[#9ca3af]'
          }`}
        >
          Unviewed ({unviewedCount})
        </button>
      </div>

      {/* Report list - takes remaining height */}
      <div 
        className="flex-1 overflow-y-auto overscroll-contain min-h-0"
        onWheel={(e) => e.stopPropagation()}
      >
        {filteredReports.length === 0 ? (
          <div className="px-4 py-3 text-center">
            <p className="text-[11px] text-[#6b7280] font-mono">
              {filter === 'unviewed' ? 'No unviewed reports' : 'No reports yet'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--pixel-border)]/50">
            {filteredReports.map((report) => {
              const isSelected = selectedId === report.investigation_id;
              const severity = (report.case_file.severity_score || 'LOW').toUpperCase();
              const verdict = getVerdictFromReport(report);
              const vcfg = verdictConfig[verdict];
              const confidence = Math.round((report.case_file.confidence || 0.5) * 100);

              return (
                <button
                  key={report.investigation_id}
                  onClick={() => onSelect(report.investigation_id)}
                  className={`w-full px-3 py-2.5 text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--accent)]/10'
                      : 'hover:bg-[#111827]'
                  } ${!report.viewed ? 'border-l-2 border-l-[#ff3355]' : 'border-l-2 border-l-transparent'}`}
                >
                  {/* Top row: Agent ID + Severity */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-[#9ca3af] truncate max-w-[120px]">
                      {report.target_agent_id || 'Unknown Agent'}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono font-medium"
                      style={{
                        color: severityColors[severity] || '#6b7280',
                        backgroundColor: `${severityColors[severity] || '#6b7280'}20`,
                      }}
                    >
                      {severity}
                    </span>
                  </div>

                  {/* Classification */}
                  <div className="text-[10px] text-[#e0e6ed] mb-1.5 truncate font-mono">
                    {(report.case_file.crime_classification || 'unknown').replace(/_/g, ' ')}
                  </div>

                  {/* Bottom row: Verdict + Confidence + Time */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                      style={{
                        color: vcfg.color,
                        backgroundColor: vcfg.bg,
                      }}
                    >
                      {vcfg.label}
                    </span>
                    <div className="flex-1 flex items-center gap-1">
                      <div className="flex-1 h-1 bg-[#1f2937] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${confidence}%`,
                            backgroundColor: confidence >= 70 ? '#00c853' : confidence >= 40 ? '#ffaa00' : '#ff3355',
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-[#6b7280] font-mono w-7">
                        {confidence}%
                      </span>
                    </div>
                    <span className="text-[9px] text-[#4b5563] font-mono">
                      {formatTimeAgo(report.concluded_at)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer summary - always show for consistent height */}
      <div className="px-3 py-2 border-t border-[var(--pixel-border)] bg-[#0d1320]">
        {reports.length > 0 ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#ff3355]" />
                <span className="text-[9px] text-[#6b7280] font-mono">
                  {reports.filter(r => getVerdictFromReport(r) === 'guilty').length} violations
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00c853]" />
                <span className="text-[9px] text-[#6b7280] font-mono">
                  {reports.filter(r => getVerdictFromReport(r) === 'not_guilty').length} cleared
                </span>
              </div>
            </div>
            <span className="text-[9px] text-[#4b5563] font-mono">
              {reports.length} total
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <span className="text-[9px] text-[#4b5563] font-mono">Waiting for investigations...</span>
          </div>
        )}
      </div>
    </div>
  );
}
