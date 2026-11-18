import notesSearchImage from '@/assets/ai/notes-search.jpg';

// "Search inside notes" görseli (Search inside notes sayfasının boş hâli ve karşılama sayfası): elinde kitapla
// duran bir öğrenci, büyütecini not sayfasındaki vurgulu satıra tutuyor; yanında kaynak rozeti.
// Görselin beyaz zemini mix-blend-multiply ile sayfanın açık zeminine karışır (kutu gibi durmaz).
// Oran 3:2; kare alanlarda (karşılama sayfası) object-contain ile kırpılmadan sığar.
export default function NotesSearchIllustration({ className = '' }: { className?: string }) {
  return (
    <img
      src={notesSearchImage}
      width={1200}
      height={824}
      loading="lazy"
      decoding="async"
      className={`object-contain mix-blend-multiply ${className}`}
      alt="A student holding a magnifying glass up to a note page, highlighting the line that answers a question"
    />
  );
}
