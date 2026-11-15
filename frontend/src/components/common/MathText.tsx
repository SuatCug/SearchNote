import { Fragment, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// AI'nın yazdığı metindeki LaTeX formüllerini KaTeX ile gösterir: satır içi \( ... \), ayrı satırda \[ ... \].
// ($ kullanılmaz: "5$" gibi para birimleriyle karışırdı.) Formül içermeyen metin olduğu gibi gösterilir; hatalı bir
// formül de sayfayı bozmaz (KaTeX onu kırmızı ham metin olarak basar).
const MATH = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;

// Model bazen ters eğik çizgiyi iki kez kaçırıyor (\\(\\frac..\\)). Metinde \\( ya da \\[ varsa bütün metin
// çift kaçırılmıştır: \\ → \. Backend yeni üretimlerde bunu düzeltir; bu, daha önce kaydedilmiş setler için.
const fixLatex = (text: string) => (/\\\\[([]/.test(text) ? text.replace(/\\\\/g, '\\') : text);

type Part = { text: string } | { html: string; display: boolean };

const parse = (text: string): Part[] => {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(MATH)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index) });
    const display = match[1] !== undefined;
    const tex = (display ? match[1] : match[2]).trim();
    parts.push({
      // trust: false (varsayılan) → \href gibi komutlar çalışmaz; çıktı güvenli HTML'dir.
      html: katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' }),
      display,
    });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
};

export default function MathText({ text: raw }: { text: string }) {
  const text = fixLatex(raw);
  const parts = useMemo(() => (text.includes('\\(') || text.includes('\\[') ? parse(text) : null), [text]);
  if (!parts) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) =>
        'text' in part ? (
          <Fragment key={i}>{part.text}</Fragment>
        ) : (
          <span key={i} className={part.display ? 'math-display' : undefined} dangerouslySetInnerHTML={{ __html: part.html }} />
        )
      )}
    </>
  );
}
