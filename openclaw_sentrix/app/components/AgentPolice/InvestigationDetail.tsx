'use client';

import { useEffect, useMemo } from 'react';
import type { InvestigationReport } from '@/lib/investigationReports';
import { FileText, X, Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface InvestigationDetailProps {
  report: InvestigationReport;
  onClose: () => void;
}

const severityConfig: Record<string, { color: string; bg: string; label: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { color: '#ff3355', bg: 'rgba(255,51,85,0.12)', label: 'CRITICAL', icon: AlertTriangle },
  HIGH: { color: '#ff6b35', bg: 'rgba(255,107,53,0.12)', label: 'HIGH', icon: AlertTriangle },
  MEDIUM: { color: '#ffaa00', bg: 'rgba(255,170,0,0.12)', label: 'MEDIUM', icon: Shield },
  LOW: { color: '#00c853', bg: 'rgba(0,200,83,0.12)', label: 'LOW', icon: CheckCircle },
};

function getVerdictFromReport(report: InvestigationReport): {
  verdict: 'guilty' | 'not_guilty' | 'under_watch';
  label: string;
  color: string;
  bg: string;
} {
  const facts = (report.case_file.case_facts || '').toLowerCase();
  const summary = (report.case_file.verdict_summary || '').toLowerCase();
  const combined = facts + ' ' + summary;
  
  if (combined.includes('not guilty') || combined.includes('false positive') || combined.includes('cleared')) {
    return { verdict: 'not_guilty', label: 'CLEARED', color: '#00c853', bg: 'rgba(0,200,83,0.12)' };
  }
  if (combined.includes('guilty') || combined.includes('violation') || combined.includes('confirmed')) {
    return { verdict: 'guilty', label: 'VIOLATION', color: '#ff3355', bg: 'rgba(255,51,85,0.12)' };
  }
  return { verdict: 'under_watch', label: 'INCONCLUSIVE', color: '#ffaa00', bg: 'rgba(255,170,0,0.12)' };
}

function SectionLabel({ children, color = '#6b7280' }: { children: React.ReactNode; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-0.5 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>
        {children}
      </span>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#0d1320] rounded-lg p-3 border border-[var(--pixel-border)] ${className}`}>
      {children}
    </div>
  );
}

export function InvestigationDetail({ report, onClose }: InvestigationDetailProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const verdict = useMemo(() => getVerdictFromReport(report), [report]);
  const severity = (report.case_file.severity_score || 'LOW').toUpperCase();
  const sevCfg = severityConfig[severity] || severityConfig.LOW;
  const confidence = Math.round((report.case_file.confidence || 0.5) * 100);
  const confColor = confidence >= 70 ? '#00c853' : confidence >= 40 ? '#ffaa00' : '#ff3355';
  
  const SeverityIcon = sevCfg.icon;

  const relevantLogs = report.case_file.relevant_log_ids || [];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          background: 'linear-gradient(180deg, #0b0f1d 0%, #080c17 100%)',
          border: `1px solid ${verdict.color}40`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div 
          className="h-0.5 w-full"
          style={{ background: `linear-gradient(90deg, ${verdict.color}, transparent)` }}
        />

        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-[var(--pixel-border)]">
          <div className="flex items-center gap-3 min-w-0">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: verdict.bg, border: `1px solid ${verdict.color}40` }}
            >
              <FileText className="w-5 h-5" style={{ color: verdict.color }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono text-[#4b5563]">Case File</span>
                <span className="text-[10px] font-mono text-[#4b5563] truncate max-w-[120px]">
                  {report.investigation_id.slice(0, 16)}...
                </span>
              </div>
              <h2 className="text-sm font-semibold text-white font-mono truncate">
                {report.target_agent_id || 'Unknown Agent'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#4b5563] hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Verdict strip */}
        <div 
          className="flex items-center px-4 py-2.5 border-b border-[var(--pixel-border)]"
          style={{ background: verdict.bg }}
        >
          <div className="flex items-center gap-2 flex-1">
            {verdict.verdict === 'guilty' && <AlertTriangle className="w-4 h-4" style={{ color: verdict.color }} />}
            {verdict.verdict === 'not_guilty' && <CheckCircle className="w-4 h-4" style={{ color: verdict.color }} />}
            {verdict.verdict === 'under_watch' && <Clock className="w-4 h-4" style={{ color: verdict.color }} />}
            <span 
              className="text-xs font-bold tracking-wider font-mono"
              style={{ color: verdict.color }}
            >
              {verdict.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Severity */}
            <div 
              className="flex items-center gap-1.5 px-2 py-1 rounded"
              style={{ background: sevCfg.bg, border: `1px solid ${sevCfg.color}40` }}
            >
              <SeverityIcon className="w-3 h-3" style={{ color: sevCfg.color }} />
              <span className="text-[10px] font-mono font-medium" style={{ color: sevCfg.color }}>
                {sevCfg.label}
              </span>
            </div>
            {/* Confidence */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-[#4b5563] font-mono">CONF</span>
              <span 
                className="text-[10px] font-mono font-bold"
                style={{ color: confColor }}
              >
                {confidence}%
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Crime Classification */}
          <Card>
            <SectionLabel color="#9b59b6">Classification</SectionLabel>
            <p className="text-xs text-white font-mono">
              {(report.case_file.crime_classification || 'unknown').replace(/_/g, ' ').toUpperCase()}
            </p>
          </Card>

          {/* Case Facts */}
          {report.case_file.case_facts && (
            <Card>
              <SectionLabel color="#00d4ff">Case Facts</SectionLabel>
              <p className="text-xs text-[#9baab8] leading-relaxed">
                {report.case_file.case_facts}
              </p>
            </Card>
          )}

          {/* Verdict Summary */}
          {report.case_file.verdict_summary && (
            <Card>
              <SectionLabel color={verdict.color}>Summary</SectionLabel>
              <p className="text-xs text-[#9baab8] leading-relaxed">
                {report.case_file.verdict_summary}
              </p>
            </Card>
          )}

          {/* Relevant Logs */}
          {relevantLogs.length > 0 && (
            <Card>
              <SectionLabel color="#ffaa00">Related Logs</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {relevantLogs.map((logId) => (
                  <span 
                    key={logId}
                    className="text-[9px] font-mono px-2 py-1 rounded bg-[#ffaa00]/10 text-[#ffaa00] border border-[#ffaa00]/30"
                  >
                    {logId}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <SectionLabel color="#4b5563">Metadata</SectionLabel>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div>
                <span className="text-[#4b5563]">Flag ID:</span>
                <span className="text-[#9baab8] ml-1.5">{report.flag_id.slice(0, 20)}...</span>
              </div>
              <div>
                <span className="text-[#4b5563]">Concluded:</span>
                <span className="text-[#9baab8] ml-1.5">
                  {new Date(report.concluded_at).toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottom rule */}
        <div 
          className="h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${verdict.color}40 50%, transparent)` }}
        />
      </div>
    </div>
  );
}
