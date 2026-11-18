import practiceImage from '@/assets/ai/practice.jpg';

// "Practice" görseli (Practice sayfası ve karşılama sayfası): bilgisayarının başında düşünen bir öğrenci, yanında
// doğru şıkkı işaretlenmiş bir quiz sorusu ve "Stack" flashcard'ı.
// Beyaz zemini mix-blend-multiply ile sayfanın açık zeminine karışır. Oran ~16:9; kare alanlarda (karşılama
// sayfası) object-contain ile kırpılmadan sığar.
export default function PracticeIllustration({ className = '' }: { className?: string }) {
  return (
    <img
      src={practiceImage}
      width={1614}
      height={864}
      loading="lazy"
      decoding="async"
      className={`object-contain mix-blend-multiply ${className}`}
      alt="A student at a laptop answering a quiz question, with the correct answer checked and a flashcard beside it"
    />
  );
}
