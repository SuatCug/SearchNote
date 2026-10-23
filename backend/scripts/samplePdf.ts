// Örnek veri betiklerinin (seed, seedPeople) ortak kullandığı basit PDF üreticisi.

// PDF'in standart fontu Türkçe karakterleri içermediği için sayfa metninde ASCII karşılıkları kullanılır.
const ASCII_MAP: Record<string, string> = { ç: 'c', Ç: 'C', ğ: 'g', Ğ: 'G', ı: 'i', İ: 'I', ö: 'o', Ö: 'O', ş: 's', Ş: 'S', ü: 'u', Ü: 'U' };
export const toAscii = (s: string) => s.replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => ASCII_MAP[c]);
const escapePdf = (s: string) => toAscii(s).replace(/[\\()]/g, (c) => `\\${c}`);

// Tek sayfalık, geçerli (xref tablolu) basit bir PDF üretir.
export const buildPdf = ({ title, subtitle, lines }: { title: string; subtitle: string; lines: string[] }) => {
  const ops = ['BT', '/F1 22 Tf', '60 770 Td', `(${escapePdf(title)}) Tj`, '/F1 12 Tf', '0 -26 Td', `(${escapePdf(subtitle)}) Tj`, '/F1 13 Tf'];
  lines.forEach((line, i) => ops.push(`0 ${i === 0 ? -44 : -26} Td`, `(${i + 1}. ${escapePdf(line)}) Tj`));
  ops.push('/F1 10 Tf', `0 -${60 + 0} Td`, '(Shared on SearchNote - sample note) Tj', 'ET');
  const content = ops.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = objects.map((obj, i) => {
    const offset = Buffer.byteLength(pdf);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
};
