import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import SocialHome from '@/components/feed/SocialHome';
import PageLayout from '@/components/layout/PageLayout';
import SearchBox from '@/components/layout/SearchBox';
import { GuestSectionChips } from '@/components/layout/GuestNavbar';
import BrowseNotes from '@/components/notes/BrowseNotes';
import LandingPage from '@/pages/LandingPage';

// Ana sayfa: giriş yapmış kullanıcıya sosyal akış (arama / Explore dahil).
// Ziyaretçi: düz "/" tanıtım sayfası; arama / filtre / ?all=1 varsa notları hesapsız gezebileceği Explore görünümü.
// Beğeni, yorum, kaydetme, indirme, yükleme ve AI araçları giriş ister (ilgili butonlar giriş sayfasına götürür).
export default function HomePage() {
  const token = useAppSelector((state) => state.auth.token);
  const [searchParams] = useSearchParams();
  if (token) return <SocialHome />;
  return searchParams.toString() ? <GuestExplore /> : <LandingPage />;
}

function GuestExplore() {
  const location = useLocation();
  const exploring = location.search;

  // Tanıtım sayfası ↔ Explore geçişinde adres yolu (/) değişmediği için ScrollToTop çalışmaz.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [exploring]);

  return (
    <PageLayout>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] gap-8 items-start">
        <div className="min-w-0">
          <GuestSearch />
          <JoinBanner className="lg:hidden mb-5" />
          <BrowseNotes gridClassName="grid gap-4 sm:grid-cols-2" />
        </div>
        <aside className="hidden lg:block sticky top-24">
          <JoinBanner />
        </aside>
      </div>
    </PageLayout>
  );
}

// Ziyaretçinin arama kutusu (üye navbar'daki kutuyla aynı öneriler: kişi / ders / not, son aramalar).
// Ziyaretçi navbar'ında arama olmadığı için burada büyük ve sayfanın en üstünde.
function GuestSearch() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const [search, setSearch] = useState(urlQuery);
  // Adresteki arama değişirse (filtre temizlendi, geri tuşu, etikete tıklandı) kutu senkronlanır.
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    setSearch(urlQuery);
  }

  const runSearch = (q: string) => {
    const params = new URLSearchParams(searchParams);
    if (q) params.set('q', q);
    else params.delete('q');
    params.delete('page');
    if (!params.toString()) params.set('all', '1');
    navigate(`/?${params}`);
  };

  return (
    <div className="mb-6">
      <SearchBox
        variant="light"
        value={search}
        onChange={setSearch}
        onSearch={runSearch}
        placeholder="Search notes, courses or people..."
      />
      <GuestSectionChips className="mt-3 md:hidden" />
    </div>
  );
}

// Hesap açmaya çağıran kısa kart: gezinmek serbest, etkileşim için giriş gerekir.
function JoinBanner({ className = '' }: { className?: string }) {
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  return (
    <section className={`card p-5 ${className}`} aria-labelledby="join-title">
      <h2 id="join-title" className="text-base font-bold text-gray-900">
        You&rsquo;re browsing as a guest
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
        Read any public note for free. To like, comment, save, download, upload your own notes or study with AI quizzes, you&rsquo;ll need an account.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row lg:flex-col">
        <Link to="/register" className="btn-primary sm:flex-1 lg:flex-none">
          Join now
        </Link>
        <Link to="/login" state={{ from }} className="btn-secondary sm:flex-1 lg:flex-none">
          Log in
        </Link>
      </div>
    </section>
  );
}
