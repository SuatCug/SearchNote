import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Spinner from '@/components/common/Spinner';
import Alert from '@/components/common/Alert';
import KnowledgeTreeIllustration from '@/components/ai/KnowledgeTreeIllustration';
import { useGetKnowledgeMapQuery } from '@/services/aiApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import type { KnowledgeEdge, KnowledgeFocus, KnowledgeMap, KnowledgeNode, TopicStatus } from '@/types/api';

// Kişisel bilgi haritası: quiz cevaplarından konu başına durum, konular arası ön koşul grafiği ve
// zorlanılan konular için "nereye odaklanmalı" kartları (eksik temel + o konuyu anlatan notlar).

const STATUS: Record<TopicStatus, { label: string; fill: string; stroke: string; text: string; pill: string }> = {
  strong: { label: 'Strong', fill: '#ecfdf5', stroke: '#34d399', text: '#065f46', pill: 'bg-emerald-50 text-emerald-700' },
  learning: { label: 'Getting there', fill: '#fffbeb', stroke: '#fbbf24', text: '#92400e', pill: 'bg-amber-50 text-amber-700' },
  weak: { label: 'Struggling', fill: '#fff1f2', stroke: '#fb7185', text: '#9f1239', pill: 'bg-rose-50 text-rose-700' },
  untested: { label: 'Not practiced', fill: '#ffffff', stroke: '#cbd5e1', text: '#475569', pill: 'bg-gray-100 text-gray-600' },
};

const DESCRIPTION =
  'Built from your practice quiz answers. It shows which topics you know, where you struggle, and which foundation a weak topic depends on.';

export default function KnowledgePage() {
  const { data, isLoading, error } = useGetKnowledgeMapQuery(undefined, { refetchOnMountOrArgChange: true });
  const map = data?.data;

  const empty = !isLoading && !error && (!map || !map.nodes.length);
  const hasMap = Boolean(map?.nodes.length);
  // Ağacın yaprakları öğrencinin en çok çalıştığı konular (12 dal).
  const leaves = useMemo(
    () =>
      map?.nodes.length
        ? [...map.nodes]
            .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'tr'))
            .slice(0, TREE_LEAVES)
            .map((n) => n.status)
        : undefined,
    [map]
  );

  // Sayfanın solunda büyük ağaç (geniş ekranda kaydırırken sabit), sağda başlık ve harita.
  return (
    <PageLayout>
      <div className={`grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 ${empty ? 'items-center sm:py-6 lg:py-8' : ''}`}>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <KnowledgeTreeIllustration
            leaves={leaves}
            className="mx-auto h-auto w-full max-w-[280px] sm:max-w-[380px] lg:max-w-none"
          />
          {hasMap && map && <TreeSummary map={map} />}
        </aside>

        <div className="min-w-0">
          <h1 className={`font-bold text-gray-900 ${empty ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-2xl sm:text-3xl'}`}>
            My knowledge map
          </h1>
          <p className={`mt-2 text-gray-600 ${empty ? 'text-sm sm:text-base lg:text-lg' : 'text-sm sm:text-base'}`}>
            {DESCRIPTION}
          </p>

          {empty ? (
            <>
              <p className="mt-6 text-sm text-gray-700 sm:text-base">
                Your map is empty for now. Take a quiz on any note and every answer you give fills in a topic on the tree.
              </p>
              <Link to="/practice" className="btn-primary mt-5">
                Take a quiz
              </Link>
            </>
          ) : (
            <div className="mt-6">
              {isLoading ? <Spinner /> : error ? <Alert>{getErrorMessage(error)}</Alert> : map && <MapView map={map} />}
            </div>
          )}

          <p className="mt-6 flex items-start gap-2 text-xs text-gray-500">
            <Sparkles size={14} className="mt-px shrink-0 text-navy-400" />
            Quiz questions are written by AI from the note’s pages. Only you can see your map.
          </p>
        </div>
      </div>
    </PageLayout>
  );
}

const TREE_LEAVES = 12;

// Ağacın altında: konu sayıları durumlara göre.
function TreeSummary({ map }: { map: KnowledgeMap }) {
  const counts = (Object.keys(STATUS) as TopicStatus[])
    .map((s) => ({ status: s, count: map.nodes.filter((n) => n.status === s).length }))
    .filter((c) => c.count > 0);
  return (
    <div className="mx-auto mt-2 max-w-[380px] text-center lg:max-w-none">
      <p className="text-sm font-semibold text-gray-900">
        {map.totals.topics} topics · {map.totals.answered} answers
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600">
        {counts.map(({ status, count }) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS[status].stroke }} />
            {count} {STATUS[status].label.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MapView({ map }: { map: KnowledgeMap }) {
  const [selected, setSelected] = useState<string | null>(map.focus[0]?.topic ?? null);
  const nodesByKey = useMemo(() => new Map(map.nodes.map((n) => [n.key, n])), [map.nodes]);
  const selectedNode = selected ? nodesByKey.get(selected) : undefined;

  return (
    <div className="space-y-6">
      {map.focus.length > 0 && (
        <section aria-labelledby="focus-title">
          <h2 id="focus-title" className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Where to focus
          </h2>
          <div className="grid gap-3 xl:grid-cols-2">
            {map.focus.map((f) => (
              <FocusCard key={f.topic} focus={f} onShow={() => setSelected(f.topic)} />
            ))}
          </div>
        </section>
      )}

      <section className="card p-4 sm:p-5" aria-labelledby="graph-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="graph-title" className="text-lg font-semibold text-gray-900">
            Topics and what they build on
          </h2>
          <Legend />
        </div>
        <p className="mt-1 text-xs text-gray-500">Arrows go from a foundation to the topic that needs it. Tap a topic for details.</p>
        <Graph nodes={map.nodes} edges={map.edges} selected={selected} onSelect={setSelected} />
        {selectedNode && <NodeDetails node={selectedNode} map={map} nodesByKey={nodesByKey} onSelect={setSelected} />}
      </section>
    </div>
  );
}

function StatusPill({ status }: { status: TopicStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[status].pill}`}>{STATUS[status].label}</span>
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
      {(Object.keys(STATUS) as TopicStatus[]).map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-sm border"
            style={{ background: STATUS[s].fill, borderColor: STATUS[s].stroke, borderStyle: s === 'untested' ? 'dashed' : 'solid' }}
          />
          {STATUS[s].label}
        </li>
      ))}
    </ul>
  );
}

function FocusCard({ focus, onShow }: { focus: KnowledgeFocus; onShow: () => void }) {
  return (
    <article className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onShow} className="truncate text-left font-semibold text-gray-900 hover:text-navy-700">
          {focus.name}
        </button>
        <StatusPill status={focus.status} />
      </div>
      <p className="mt-1.5 text-sm text-gray-700">{focus.message}</p>
      {focus.notes.length > 0 ? (
        <>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Notes on {focus.recommendedFor}</p>
          <ul className="mt-1.5 space-y-1.5">
            {focus.notes.map((n) => (
              <li key={n._id}>
                <Link
                  to={`/notes/${n._id}${n.page ? `?page=${n.page}` : ''}`}
                  className="block rounded-lg border border-gray-100 px-3 py-2 hover:border-navy-200 hover:bg-navy-50/40"
                >
                  <span className="block truncate text-sm font-semibold text-gray-900">
                    {n.courseCode ? `${n.courseCode} – ` : ''}
                    {n.title}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {[n.author?.fullName, n.page ? `page ${n.page}` : null].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-xs text-gray-500">
          No shared notes cover {focus.recommendedFor} yet.{' '}
          <Link to={`/ask?q=${encodeURIComponent(focus.recommendedFor)}`} className="font-semibold text-navy-600 hover:underline">
            Search inside notes
          </Link>
        </p>
      )}
    </article>
  );
}

// ---------- Grafik ----------

const NODE_W = 168;
const NODE_H = 50;
const COL_GAP = 64;
const ROW_GAP = 18;
const PAD = 12;

// Her konu, ön koşullarının bir sağındaki sütuna yerleşir (temeller solda). Döngü varsa sınırlı sayıda
// geçişten sonra durulur.
const layout = (nodes: KnowledgeNode[], edges: KnowledgeEdge[]) => {
  const level = new Map(nodes.map((n) => [n.key, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of edges) {
      const next = (level.get(e.from) ?? 0) + 1;
      if (next > (level.get(e.to) ?? 0) && next < nodes.length) {
        level.set(e.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const columns = new Map<number, KnowledgeNode[]>();
  for (const n of nodes) {
    const l = level.get(n.key) ?? 0;
    columns.set(l, [...(columns.get(l) ?? []), n]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  const colCount = Math.max(...columns.keys()) + 1;
  const maxRows = Math.max(...[...columns.values()].map((c) => c.length));
  const height = maxRows * NODE_H + (maxRows - 1) * ROW_GAP;
  for (const [l, col] of columns) {
    // Sütunlar dikeyde ortalanır; zayıf konular üstte.
    const order = { weak: 0, learning: 1, untested: 2, strong: 3 };
    col.sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'tr'));
    const colHeight = col.length * NODE_H + (col.length - 1) * ROW_GAP;
    col.forEach((n, i) =>
      positions.set(n.key, {
        x: PAD + l * (NODE_W + COL_GAP),
        y: PAD + (height - colHeight) / 2 + i * (NODE_H + ROW_GAP),
      })
    );
  }
  return {
    positions,
    width: PAD * 2 + colCount * NODE_W + (colCount - 1) * COL_GAP,
    height: PAD * 2 + height,
  };
};

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

function Graph({
  nodes,
  edges,
  selected,
  onSelect,
}: {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const { positions, width, height } = useMemo(() => layout(nodes, edges), [nodes, edges]);
  // Seçili konunun bağlantıları vurgulanır.
  const related = new Set(selected ? edges.filter((e) => e.from === selected || e.to === selected).flatMap((e) => [e.from, e.to]) : []);

  return (
    <div className="mt-4 overflow-x-auto overscroll-x-contain rounded-lg bg-gray-50">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Topic map" className="block">
        <defs>
          <marker id="km-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#94a3b8" />
          </marker>
          <marker id="km-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#1e3a8a" />
          </marker>
        </defs>
        {edges.map((e) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x - 2;
          const y2 = b.y + NODE_H / 2;
          const mid = (x1 + x2) / 2;
          const active = selected !== null && (e.from === selected || e.to === selected);
          return (
            <path
              key={`${e.from}-${e.to}`}
              d={`M${x1} ${y1} C${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`}
              fill="none"
              stroke={active ? '#1e3a8a' : '#cbd5e1'}
              strokeWidth={active ? 2 : 1.5}
              markerEnd={`url(#${active ? 'km-arrow-active' : 'km-arrow'})`}
            />
          );
        })}
        {nodes.map((n) => {
          const p = positions.get(n.key)!;
          const s = STATUS[n.status];
          const isSelected = n.key === selected;
          const dimmed = selected !== null && !isSelected && !related.has(n.key);
          return (
            <g
              key={n.key}
              transform={`translate(${p.x} ${p.y})`}
              role="button"
              tabIndex={0}
              aria-label={`${n.name}: ${s.label}${n.total ? `, ${n.correct} of ${n.total} correct` : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelect(n.key)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(n.key))}
              className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-navy-700"
              opacity={dimmed ? 0.45 : 1}
            >
              <title>{n.name}</title>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill={s.fill}
                stroke={isSelected ? '#1e3a8a' : s.stroke}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeDasharray={n.status === 'untested' ? '5 4' : undefined}
              />
              <text x={12} y={21} fontSize={13} fontWeight={600} fill="#111827">
                {truncate(n.name, 20)}
              </text>
              <text x={12} y={38} fontSize={11} fill={s.text}>
                {n.total ? `${n.correct}/${n.total} correct` : 'Not practiced'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function NodeDetails({
  node,
  map,
  nodesByKey,
  onSelect,
}: {
  node: KnowledgeNode;
  map: KnowledgeMap;
  nodesByKey: Map<string, KnowledgeNode>;
  onSelect: (key: string) => void;
}) {
  const foundations = map.edges.filter((e) => e.to === node.key).map((e) => nodesByKey.get(e.from)).filter((n) => n !== undefined);
  const buildsOn = map.edges.filter((e) => e.from === node.key).map((e) => nodesByKey.get(e.to)).filter((n) => n !== undefined);
  const focus = map.focus.find((f) => f.topic === node.key);

  const chips = (list: KnowledgeNode[]) =>
    list.map((n) => (
      <button
        key={n.key}
        type="button"
        onClick={() => onSelect(n.key)}
        className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:border-navy-200 hover:bg-navy-50"
      >
        {n.name}
      </button>
    ));

  return (
    <div className="mt-4 rounded-lg border border-gray-100 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-gray-900">{node.name}</h3>
        <StatusPill status={node.status} />
        <span className="text-xs text-gray-500">
          {node.total ? `${node.correct} of ${node.total} answers correct` : 'You haven’t answered questions on this yet'}
        </span>
      </div>
      {focus && <p className="mt-2 text-sm text-gray-700">{focus.message}</p>}
      {foundations.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">Builds on:</span>
          {chips(foundations)}
        </div>
      )}
      {buildsOn.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-500">Needed for:</span>
          {chips(buildsOn)}
        </div>
      )}
      <Link
        to={`/ask?q=${encodeURIComponent(node.name)}`}
        className="mt-3 inline-block text-sm font-semibold text-navy-600 hover:underline"
      >
        Find notes about {node.name}
      </Link>
    </div>
  );
}
