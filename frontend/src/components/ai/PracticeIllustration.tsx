import practiceImage from '@/assets/ai/practice.jpg';
import practiceImage800 from '@/assets/ai/practice-800.jpg';
import practiceImage1200 from '@/assets/ai/practice-1200.jpg';

// "Practice" görseli (Practice sayfası ve karşılama sayfası): bilgisayarının başında düşünen bir öğrenci, yanında
// doğru şıkkı işaretlenmiş bir quiz sorusu ve "Stack" flashcard'ı.
// Resimde küçük yazılar var: tarayıcı büyük resmi çok küçültünce yazılar bulanıklaşıyordu. Bu yüzden önceden
// net küçültülmüş (hafif keskinleştirilmiş) 800 ve 1200 px sürümleri var; tarayıcı ekrana uygun olanı seçer.
// Beyaz zemini mix-blend-multiply ile sayfanın açık zeminine karışır. Oran ~16:9; kare alanlarda object-contain.
export default function PracticeIllustration({ className = '' }: { className?: string }) {
  return (
    <img
      src={practiceImage1200}
      srcSet={`${practiceImage800} 800w, ${practiceImage1200} 1200w, ${practiceImage} 1614w`}
      sizes="(min-width: 1024px) 640px, (min-width: 640px) 560px, 100vw"
      width={1614}
      height={864}
      loading="lazy"
      decoding="async"
      className={`object-contain mix-blend-multiply ${className}`}
      alt="A student at a laptop answering a quiz question, with the correct answer checked and a flashcard beside it"
    />
  );
}
