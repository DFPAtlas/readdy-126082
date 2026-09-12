// ============================================================================
// DFP AI Operations — Group Agent Network diagram.
//
// A radial, pan/zoomable agent network: the centre is the group orchestrator
// (DFP Group Oversight / Atlas Tron), the first ring is one manager position
// per site, the second ring fans each expanded site's workers outward, and
// shared/group agents live in a separate inner ring around the centre.
//
// Layout is a pure function of the (sorted) visible sites + expansion state,
// so positions stay stable across data refresh. Edges animate ONLY when the
// target node has fresh working-run evidence (never from registry status,
// metadata or heartbeats). Respects prefers-reduced-motion.
// ============================================================================

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import {
  AI_INFRA_STATE_META,
  type AiInfraState,
} from '@/pages/ai-operations/wallboard/aiInfraSelectors';
import {
  MASTER_AGENT_STATE_META,
  NETWORK_AGENT_STATE_META,
  TONE_HEX,
  ASSIGNMENT_ISSUE_LABEL,
  type GroupNetworkModel,
  type NetworkCenter,
  type NetworkSite,
  type NetworkAgent,
} from '@/pages/ai-operations/network/networkSelectors';

// ---------------------------------------------------------------------------
// Selection target (shared with the parent for the details panel)
// ---------------------------------------------------------------------------

export type SelectTarget =
  | { kind: 'center' }
  | { kind: 'site'; siteKey: string }
  | { kind: 'agent'; agentId: string };

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const WORLD_W = 1800;
const WORLD_H = 1200;
const CX = 900;
const CY = 600;
const SITE_R = 360;
const SHARED_R = 210;
const SUB_R = 150;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.2;

const NODE_HALF: Record<string, { w: number; h: number }> = {
  center: { w: 112, h: 84 },
  site: { w: 86, h: 36 },
  agent: { w: 78, h: 32 },
  sharedGroup: { w: 92, h: 30 },
};

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

interface LayoutNode {
  key: string;
  x: number;
  y: number;
  kind: 'center' | 'site' | 'agent' | 'sharedGroup';
  site?: NetworkSite;
  agent?: NetworkAgent;
}

interface LayoutEdge {
  key: string;
  fromKey: string;
  toKey: string;
  color: string;
  animated: boolean;
}

function computeLayout(
  center: NetworkCenter,
  sites: NetworkSite[],
  sharedAgents: NetworkAgent[],
  expandedSites: Set<string>,
  expandedShared: boolean,
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  nodes.push({ key: 'center', x: CX, y: CY, kind: 'center' });

  // Shared agents — inner ring around the centre (separate expandable group).
  if (sharedAgents.length > 0) {
    if (expandedShared) {
      const n = sharedAgents.length;
      sharedAgents.forEach((agent, i) => {
        const angle = -90 + (i * 360) / n;
        const x = CX + SHARED_R * Math.cos(deg2rad(angle));
        const y = CY + SHARED_R * Math.sin(deg2rad(angle));
        const key = `agent:${agent.id}`;
        nodes.push({ key, x, y, kind: 'agent', agent });
        edges.push({
          key: `e-center-${key}`,
          fromKey: 'center',
          toKey: key,
          color: TONE_HEX.secondary,
          animated: agent.hasLiveEvidence,
        });
      });
    } else {
      nodes.push({ key: 'sharedGroup', x: CX, y: CY - SHARED_R, kind: 'sharedGroup' });
    }
  }

  // First ring — one manager position per site.
  const n = sites.length;
  sites.forEach((site, i) => {
    const angle = -90 + (i * 360) / Math.max(1, n);
    const rad = deg2rad(angle);
    const x = CX + SITE_R * Math.cos(rad);
    const y = CY + SITE_R * Math.sin(rad);
    const key = `site:${site.siteKey}`;
    nodes.push({ key, x, y, kind: 'site', site });
    const managerRunning = site.managers.some((m) => m.hasLiveEvidence);
    edges.push({
      key: `e-center-${key}`,
      fromKey: 'center',
      toKey: key,
      color: site.colorHex,
      animated: managerRunning,
    });

    // Second ring — workers fan outward around their manager.
    if (expandedSites.has(site.siteKey) && site.workers.length > 0) {
      const k = site.workers.length;
      // Wider fan-out so each sub-agent stays separated and readable: more
      // workers get a broader arc and a slightly larger radius.
      const radius = SUB_R + Math.min(60, Math.max(0, k - 3) * 12);
      const totalArc = k === 1 ? 0 : Math.min(180, (k - 1) * 50);
      const step = k === 1 ? 0 : totalArc / (k - 1);
      site.workers.forEach((worker, j) => {
        const offset = k === 1 ? 0 : (j - (k - 1) / 2) * step;
        const a = deg2rad(angle + offset);
        const wx = x + radius * Math.cos(a);
        const wy = y + radius * Math.sin(a);
        const wkey = `agent:${worker.id}`;
        nodes.push({ key: wkey, x: wx, y: wy, kind: 'agent', agent: worker });
        edges.push({
          key: `e-${key}-${wkey}`,
          fromKey: key,
          toKey: wkey,
          color: site.colorHex,
          animated: worker.hasLiveEvidence,
        });
      });
    }
  });

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Node cards
// ---------------------------------------------------------------------------

function StatusDot({ tone, animated }: { tone: string; animated: boolean }) {
  return (
    <span
      className={`gn-status-dot ${animated ? 'gn-status-dot-animated' : ''}`}
      style={{ background: tone }}
    />
  );
}

function SiteNode({
  site,
  onToggle,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  site: NetworkSite;
  onToggle: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const issue = site.assignmentIssue;
  let managerLine: { text: string; color: string };
  if (issue === 'no_manager') {
    managerLine = { text: 'Manager not assigned', color: TONE_HEX.amber };
  } else if (issue === 'multiple_managers') {
    managerLine = { text: `${site.managers.length} managers · issue`, color: TONE_HEX.red };
  } else {
    const m = site.managers[0];
    managerLine = {
      text: m.name,
      color: TONE_HEX[m.tone],
    };
  }

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
      className="gn-node gn-node-site gn-node-draggable"
      style={{ '--gn-accent': site.colorHex, width: 168 } as CSSProperties}
      aria-label={`${site.name} — ${ASSIGNMENT_ISSUE_LABEL[issue]} (${managerLine.text})`}
    >
      <span className="gn-node-badge" style={{ background: site.colorHex }}>
        {site.initials}
      </span>
      <span className="gn-node-main">
        <span className="gn-node-title" title={site.name}>{site.name}</span>
        <span className="gn-node-sub" style={{ color: managerLine.color }} title={managerLine.text}>
          {managerLine.text}
        </span>
      </span>
      {issue !== 'none' && (
        <span
          className="gn-node-issue"
          style={{ color: TONE_HEX[issue === 'no_manager' ? 'amber' : 'red'] }}
          title={ASSIGNMENT_ISSUE_LABEL[issue]}
        >
          <i className="ri-error-warning-line"></i>
        </span>
      )}
    </button>
  );
}

function AgentNode({
  agent,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  agent: NetworkAgent;
  onSelect: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const tone = TONE_HEX[agent.tone];
  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="gn-node gn-node-agent gn-node-draggable"
      style={{ '--gn-accent': tone, width: 154 } as CSSProperties}
      aria-label={`${agent.name} — ${agent.categoryLabel} — ${agent.statusLabel}`}
    >
      <span className="gn-node-head">
        <span className="gn-node-title gn-node-title-agent" title={agent.name}>{agent.name}</span>
        <StatusDot tone={tone} animated={agent.hasLiveEvidence} />
      </span>
      <span className="gn-node-sub">{agent.categoryLabel}</span>
      <span className="gn-node-task" title={agent.currentTask ?? undefined}>
        {agent.currentTask || 'No active task'}
      </span>
    </button>
  );
}

function SharedGroupNode({ count, onToggle }: { count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="gn-node gn-node-shared"
      style={{ width: 178 } as CSSProperties}
      aria-label={`Shared agents — ${count} group agents`}
    >
      <span className="gn-node-head">
        <span className="gn-node-title">Shared agents</span>
        <span className="gn-count">{count}</span>
      </span>
      <span className="gn-node-sub">Group-level · click to expand</span>
    </button>
  );
}

function CenterNode({ center }: { center: NetworkCenter }) {
  const orch = center.orchestrator;
  const orchMeta = orch ? MASTER_AGENT_STATE_META[orch.state] : null;
  const oversightMeta = AI_INFRA_STATE_META[center.oversight.state];
  const halMeta = center.hal ? AI_INFRA_STATE_META[center.hal.state as AiInfraState] : null;

  return (
    <div className="gn-node gn-node-center" style={{ width: 232 } as CSSProperties}>
      <div className="gn-center-title">
        <i className="ri-radar-line"></i>
        <span>DFP GROUP OVERSIGHT</span>
      </div>
      <div className="gn-center-sub">ATLAS TRON</div>

      <div className="gn-center-row">
        <span className="gn-center-label">Orchestrator</span>
        <span className="gn-center-value" style={{ color: orchMeta ? TONE_HEX[orchMeta.tone] : TONE_HEX.secondary }}>
          {orch ? orch.name : 'Not registered'}
        </span>
      </div>
      <div className="gn-center-row">
        <span className="gn-center-label">State</span>
        <span className="gn-center-value">{orch ? orchMeta?.label : '—'}</span>
      </div>

      <div className="gn-center-row">
        <span className="gn-center-label">TRON oversight</span>
        <span className="gn-center-value" style={{ color: TONE_HEX[oversightMeta.tone] }}>
          {oversightMeta.label}
        </span>
      </div>
      <div className="gn-center-row">
        <span className="gn-center-label">HAL execution host</span>
        <span className="gn-center-value" style={{ color: halMeta ? TONE_HEX[halMeta.tone] : TONE_HEX.secondary }}>
          {halMeta ? halMeta.label : 'Not registered'}
        </span>
      </div>

      <div className="gn-center-note">Runtime connectivity ≠ confirmed oversight activity</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diagram
// ---------------------------------------------------------------------------

interface NetworkDiagramProps {
  model: GroupNetworkModel;
  expandedSites: Set<string>;
  expandedShared: boolean;
  selected: SelectTarget | null;
  onSelect: (t: SelectTarget) => void;
  onToggleSite: (siteKey: string) => void;
  onToggleShared: () => void;
}

export default function NetworkDiagram({
  model,
  expandedSites,
  expandedShared,
  selected,
  onSelect,
  onToggleSite,
  onToggleShared,
}: NetworkDiagramProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ scale: 1, tx: 0, ty: 0 });
  const drag = useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const fittedRef = useRef(false);
  const [nodeOffsets, setNodeOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const nodeDrag = useRef<{
    key: string;
    startX: number;
    startY: number;
    baseDx: number;
    baseDy: number;
    scale: number;
    moved: boolean;
  } | null>(null);

  const { nodes, edges } = useMemo(
    () => computeLayout(model.center, model.sites, model.center.sharedAgents, expandedSites, expandedShared),
    [model, expandedSites, expandedShared],
  );

  // Apply user drag offsets to produce the final rendered positions.
  const finalNodes = useMemo(
    () =>
      nodes.map((n) => {
        const off = nodeOffsets[n.key];
        return off ? { ...n, x: n.x + off.dx, y: n.y + off.dy } : n;
      }),
    [nodes, nodeOffsets],
  );

  const posMap = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    for (const n of finalNodes) m[n.key] = { x: n.x, y: n.y };
    return m;
  }, [finalNodes]);

  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || finalNodes.length === 0) return;
    const rect = el.getBoundingClientRect();
    const half = finalNodes.map((n) => NODE_HALF[n.kind]);
    const minX = Math.min(...finalNodes.map((n, i) => n.x - half[i].w));
    const maxX = Math.max(...finalNodes.map((n, i) => n.x + half[i].w));
    const minY = Math.min(...finalNodes.map((n, i) => n.y - half[i].h));
    const maxY = Math.max(...finalNodes.map((n, i) => n.y + half[i].h));
    const bW = Math.max(1, maxX - minX);
    const bH = Math.max(1, maxY - minY);
    const pad = 56;
    const s = Math.min((rect.width - pad * 2) / bW, (rect.height - pad * 2) / bH);
    const scale = Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);
    setViewport({
      scale,
      tx: (rect.width - bW * scale) / 2 - minX * scale,
      ty: (rect.height - bH * scale) / 2 - minY * scale,
    });
  }, [finalNodes]);

  const reset = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setViewport({ scale: 1, tx: rect.width / 2 - CX, ty: rect.height / 2 - CY });
    setNodeOffsets({});
  }, []);

  // Node drag handlers (agent and site/manager nodes).
  const handleNodePointerDown = useCallback(
    (e: React.PointerEvent, node: LayoutNode) => {
      if (node.kind !== 'agent' && node.kind !== 'site') return;
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      const off = nodeOffsets[node.key] ?? { dx: 0, dy: 0 };
      nodeDrag.current = {
        key: node.key,
        startX: e.clientX,
        startY: e.clientY,
        baseDx: off.dx,
        baseDy: off.dy,
        scale: viewport.scale,
        moved: false,
      };
    },
    [nodeOffsets, viewport.scale],
  );

  const handleNodePointerMove = useCallback((e: React.PointerEvent) => {
    const d = nodeDrag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) {
      d.moved = true;
    }
    if (d.moved) {
      const dx = (e.clientX - d.startX) / d.scale;
      const dy = (e.clientY - d.startY) / d.scale;
      const key = d.key;
      const baseDx = d.baseDx;
      const baseDy = d.baseDy;
      setNodeOffsets((prev) => ({ ...prev, [key]: { dx: baseDx + dx, dy: baseDy + dy } }));
    }
  }, []);

  const handleNodePointerUp = useCallback(
    (e: React.PointerEvent, node: LayoutNode) => {
      const d = nodeDrag.current;
      if (!d) return;
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      if (!d.moved && d.key === node.key) {
        if (node.agent) {
          onSelect({ kind: 'agent', agentId: node.agent.id });
        } else if (node.site) {
          onToggleSite(node.site.siteKey);
        }
      }
      nodeDrag.current = null;
    },
    [onSelect, onToggleSite],
  );

  // Fit on first meaningful layout.
  useEffect(() => {
    if (!fittedRef.current && nodes.length > 1) {
      fittedRef.current = true;
      fit();
    }
  }, [nodes, fit]);

  const zoomBy = useCallback(
    (factor: number) => {
      const el = viewportRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setViewport((v) => {
        const s = Math.min(Math.max(v.scale * factor, MIN_SCALE), MAX_SCALE);
        const wx = (rect.width / 2 - v.tx) / v.scale;
        const wy = (rect.height / 2 - v.ty) / v.scale;
        return { scale: s, tx: rect.width / 2 - wx * s, ty: rect.height / 2 - wy * s };
      });
    },
    [],
  );

  // Wheel zoom via a native non-passive listener (React attaches `wheel` as
  // passive, so preventDefault is a no-op through onWheel).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setViewport((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const s = Math.min(Math.max(v.scale * factor, MIN_SCALE), MAX_SCALE);
        const wx = (px - v.tx) / v.scale;
        const wy = (py - v.ty) / v.scale;
        return { scale: s, tx: px - wx * s, ty: py - wy * s };
      });
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.gn-node') || t.closest('.gn-zoom-controls')) return;
    drag.current = { startX: e.clientX, startY: e.clientY, tx: viewport.tx, ty: viewport.ty };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [viewport.tx, viewport.ty]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setViewport((v) => ({
      ...v,
      tx: d.tx + (e.clientX - d.startX),
      ty: d.ty + (e.clientY - d.startY),
    }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const isSelected = (key: string) => {
    if (!selected) return false;
    if (selected.kind === 'center') return key === 'center';
    if (selected.kind === 'site') return key === `site:${selected.siteKey}`;
    if (selected.kind === 'agent') return key === `agent:${selected.agentId}`;
    return false;
  };

  return (
    <div
      ref={viewportRef}
      className="gn-viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="gn-world"
        style={{
          width: WORLD_W,
          height: WORLD_H,
          transform: `translate(${viewport.tx}px, ${viewport.ty}px) scale(${viewport.scale})`,
        }}
      >
        <svg
          className="gn-edges"
          width={WORLD_W}
          height={WORLD_H}
          viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
          aria-hidden="true"
        >
          {edges.map((edge) => {
            const from = posMap[edge.fromKey];
            const to = posMap[edge.toKey];
            if (!from || !to) return null;
            return (
              <line
                key={edge.key}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`gn-edge ${edge.animated ? 'gn-edge-animated' : ''}`}
                style={{ stroke: edge.color }}
              />
            );
          })}
        </svg>

        {finalNodes.map((node) => {
          if (node.kind === 'center') {
            return (
              <div
                key={node.key}
                className="gn-node-pos"
                style={{ left: node.x - 116, top: node.y - 84, width: 232 }}
              >
                <CenterNode center={model.center} />
              </div>
            );
          }
          if (node.kind === 'sharedGroup') {
            return (
              <div key={node.key} className="gn-node-pos" style={{ left: node.x - 89, top: node.y - 25 }}>
                <SharedGroupNode count={model.center.sharedAgents.length} onToggle={onToggleShared} />
              </div>
            );
          }
          if (node.kind === 'site' && node.site) {
            return (
              <div key={node.key} className="gn-node-pos" style={{ left: node.x - 84, top: node.y - 32 }}>
                <div className={isSelected(node.key) ? 'gn-selected' : ''}>
                  <SiteNode
                    site={node.site}
                    onToggle={() => onToggleSite(node.site!.siteKey)}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    onPointerMove={handleNodePointerMove}
                    onPointerUp={(e) => handleNodePointerUp(e, node)}
                  />
                </div>
              </div>
            );
          }
          if (node.kind === 'agent' && node.agent) {
            return (
              <div key={node.key} className="gn-node-pos" style={{ left: node.x - 77, top: node.y - 29 }}>
                <div className={isSelected(node.key) ? 'gn-selected' : ''}>
                  <AgentNode
                    agent={node.agent}
                    onSelect={() => onSelect({ kind: 'agent', agentId: node.agent!.id })}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    onPointerMove={handleNodePointerMove}
                    onPointerUp={(e) => handleNodePointerUp(e, node)}
                  />
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Floating zoom controls */}
      <div className="gn-zoom-controls" role="group" aria-label="Diagram zoom controls">
        <button type="button" onClick={() => zoomBy(1.25)} title="Zoom in" className="gn-zoom-btn">
          <i className="ri-add-line"></i>
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} title="Zoom out" className="gn-zoom-btn">
          <i className="ri-subtract-line"></i>
        </button>
        <button type="button" onClick={fit} title="Fit view" className="gn-zoom-btn">
          <i className="ri-focus-3-line"></i>
        </button>
        <button type="button" onClick={reset} title="Reset" className="gn-zoom-btn">
          <i className="ri-refresh-line"></i>
        </button>
      </div>

    </div>
  );
}