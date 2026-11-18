import studyTableImage from '@/assets/landing/study-table.jpg';

// Karşılama sayfası hero görseli: yuvarlak masada notlarla birlikte çalışan üç öğrenci.
// Sayfanın ilk ekranında olduğu için hemen yüklenir (lazy değil). Beyaz zemini mix-blend-multiply ile sayfanın
// açık zeminine karışır (kutu gibi durmaz).
export default function StudyTableIllustration({ className = '' }: { className?: string }) {
  return (
    <img
      src={studyTableImage}
      width={1428}
      height={906}
      decoding="async"
      fetchPriority="high"
      className={`object-contain mix-blend-multiply ${className}`}
      alt="Three students studying together around a round table with their notes"
    />
  );
}
