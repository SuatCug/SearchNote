import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, ChevronUp, GraduationCap, Landmark, LayoutGrid } from 'lucide-react';
import GuestNavbar from '@/components/layout/GuestNavbar';
import Footer from '@/components/layout/Footer';
import StudyTableIllustration from '@/components/landing/StudyTableIllustration';
import NotePageSample from '@/components/landing/NotePageSample';
import GroupChatSample from '@/components/landing/GroupChatSample';
import GoogleButton from '@/components/auth/GoogleButton';
import Alert from '@/components/common/Alert';
import { GOOGLE_CLIENT_ID } from '@/lib/constants';
import sampleProfilePhoto from '@/assets/landing/sample-profile.jpg';

// Giriş yapmamış ziyaretçilere ana sayfada gösterilen tanıtım sayfası.
// Bölüm id'leri (top, features, departments, profiles, community) GuestNavbar ve Footer bağlantılarıyla eşleşir.
// Ziyaretçi notlara göz atamadığı için ders/bölüm çipleri giriş sayfasına gider; girişten sonra o aramaya dönülür.

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <GuestNavbar />
      <main className="flex-1 overflow-x-hidden font-display text-[#1b1f24]">
        <HeroSection />
        <BrowseSection />
        <ProfileSection />
        <GroupsSection />
        <AudienceSection />
        <ClosingSection />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------- Ortak parçalar */

const pillBase = 'inline-flex items-center justify-center rounded-full font-semibold transition-colors';
const pillPrimary = `${pillBase} min-h-[52px] px-7 text-[17px] bg-navy-900 text-white hover:bg-navy-950`;
const textLink = 'font-semibold text-navy-900 underline-offset-2 hover:underline hover:text-navy-950';

function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-light leading-[1.15] text-navy-900 text-balance text-[30px] sm:text-[36px] lg:text-[44px]">{children}</h2>;
}

// Ders ya da bölüm adı, girişten sonra açılacak arama adresi olarak giriş sayfasına taşınır.
const searchState = (query: string) => ({ from: `/?q=${encodeURIComponent(query)}` });

function ChipList({ items, extra }: { items: string[]; extra: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? [...items, ...extra] : items;
  const chipClass = 'border border-[#8c9199] hover:border-navy-900 hover:bg-white';

  return (
    <div className="flex flex-wrap gap-2.5 sm:gap-3">
      {shown.map((item) => (
        <Link
          key={item}
          to="/login"
          state={searchState(item)}
          className={`${pillBase} min-h-12 px-5 text-base sm:text-[17px] text-[#3d434a] hover:text-navy-900 ${chipClass}`}
        >
          {item}
        </Link>
      ))}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={`${pillBase} min-h-12 gap-1.5 px-5 text-base sm:text-[17px] text-[#3d434a] hover:bg-black/5`}
      >
        {expanded ? 'Show less' : 'Show more'}
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ Hero */

function HeroSection() {
  const [googleError, setGoogleError] = useState('');
  return (
    <section id="top" className="scroll-mt-[72px]">
      <Container className="pt-8 pb-14 sm:pt-10 sm:pb-16 flex flex-wrap items-center gap-8">
        <div className="flex-[1_1_420px] max-w-[540px] flex flex-col gap-8">
          <h1 className="m-0 font-light leading-[1.15] text-navy-900 text-balance text-[36px] sm:text-[46px] lg:text-[56px]">
            Find the notes your classmates already took
          </h1>

          {/* LinkedIn'deki gibi: Google ile devam et, e-postayla giriş, yasal metin ve "Join now" */}
          <div className="flex flex-col gap-3.5 max-w-[400px]">
            <Alert>{googleError}</Alert>
            {GOOGLE_CLIENT_ID ? (
              <GoogleButton theme="filled_blue" shape="pill" onError={setGoogleError} />
            ) : (
              <Link to="/register" className={pillPrimary}>
                Create a free account
              </Link>
            )}
            {/* Google butonuyla (40px) aynı yükseklikte */}
            <Link
              to="/login"
              className={`${pillBase} h-10 px-6 text-base border border-[#5e6670] text-[#3d434a] hover:bg-gray-50 hover:border-[#3d434a]`}
            >
              Sign in with email
            </Link>
            <p className="m-0 text-xs text-center text-[#5e6670]">
              By continuing, you agree to SearchNote&rsquo;s{' '}
              <Link to="/legal/terms" className={textLink}>Terms of Use</Link>,{' '}
              <Link to="/legal/privacy" className={textLink}>Privacy Policy</Link> and{' '}
              <Link to="/legal/cookies" className={textLink}>Cookie Policy</Link>.
            </p>
            <p className="m-0 mt-2 text-center text-[17px] text-[#1b1f24]">
              New to SearchNote?{' '}
              <Link to="/register" className={textLink}>
                Join now
              </Link>
            </p>
          </div>
        </div>

        <div className="flex-[1_1_440px] min-w-0 flex justify-center">
          <StudyTableIllustration className="w-full max-w-[700px] h-auto" />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------- Dersler ve bölümler */

const COURSES = ['Calculus I', 'Physics II', 'Data Structures', 'Linear Algebra', 'Microeconomics', 'Organic Chemistry', 'Anatomy', 'Statistics'];
const MORE_COURSES = ['Differential Equations', 'Thermodynamics', 'Discrete Mathematics', 'Macroeconomics', 'Biochemistry', 'Algorithms'];
const DEPARTMENTS = ['Computer Engineering', 'Electrical & Electronics', 'Medicine', 'Law', 'Economics', 'Business', 'Architecture', 'Psychology'];
const MORE_DEPARTMENTS = ['Civil Engineering', 'Mechanical Engineering', 'Industrial Engineering', 'Mathematics', 'Molecular Biology', 'Political Science'];

type BrowseTab = 'courses' | 'departments';

// Eskiden art arda iki ayrı çip bölümüydü; tek bölümde "Courses / Departments" sekmesiyle birleşti.
// Navbar'daki "Departments" (/#departments) bağlantısı bölümü bölümler sekmesiyle açar.
function BrowseSection() {
  const { hash } = useLocation();
  const [tab, setTab] = useState<BrowseTab>(hash === '#departments' ? 'departments' : 'courses');
  const [prevHash, setPrevHash] = useState(hash);
  if (hash !== prevHash) {
    setPrevHash(hash);
    if (hash === '#departments') setTab('departments');
    if (hash === '#features') setTab('courses');
  }

  return (
    <section id="features" className="relative scroll-mt-[72px] bg-[#f4f2ee]">
      <span id="departments" className="absolute top-0 scroll-mt-[72px]" aria-hidden="true" />
      <Container className="py-12 sm:py-14 flex flex-wrap gap-8">
        <div className="flex-[1_1_300px] flex flex-col gap-2">
          <Heading>Find notes for your courses</Heading>
          <p className="m-0 text-lg text-[#5e6670]">Search by course or by department</p>
        </div>
        <div className="flex-[2_1_520px] min-w-0 flex flex-col gap-5">
          <div className="flex gap-6 border-b border-[#d6d1c4]" role="tablist">
            {(
              [
                ['courses', 'Courses'],
                ['departments', 'Departments'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`-mb-px border-b-2 pb-2.5 text-[17px] font-semibold transition-colors ${
                  tab === key ? 'border-navy-900 text-navy-900' : 'border-transparent text-[#5e6670] hover:text-navy-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'courses' ? (
            <ChipList key="courses" items={COURSES} extra={MORE_COURSES} />
          ) : (
            <ChipList key="departments" items={DEPARTMENTS} extra={MORE_DEPARTMENTS} />
          )}
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- Profil */

// Paylaşılan not kutuları marka tonlarında (lacivert, orta mavi, açık mavi).
const SAMPLE_NOTES = [
  { type: 'PDF', title: 'Data Structures final summary', className: 'bg-navy-900 text-white' },
  { type: 'DOCX', title: 'Linear Algebra midterm prep', className: 'bg-[#34557d] text-white' },
  { type: 'JPG', title: 'Algorithm analysis board notes', className: 'bg-[#c9d6ea] text-navy-900' },
];

function ProfileSection() {
  return (
    <section id="profiles" className="scroll-mt-[72px]">
      <Container className="py-14 sm:py-[72px] flex flex-wrap items-center gap-10 lg:gap-16">
        <div className="flex-[1_1_360px] max-w-[460px] flex flex-col gap-5">
          <Heading>Build your profile and let your notes speak for you</Heading>
          <p className="m-0 text-lg text-[#5e6670]">
            Your department, your courses and the notes you share — all on one page. Students taking the same course
            can find you and ask their questions directly.
          </p>
          <p className="m-0 text-lg text-[#5e6670]">
            Every note you upload counts its likes and downloads, so you can see which of your summaries actually
            helped someone before an exam.
          </p>
        </div>

        <SampleProfile />
      </Container>
    </section>
  );
}

// Tanıtım amaçlı örnek profil; hiçbir parçası tıklanmaz.
function SampleProfile() {
  return (
    <div className="flex-[1_1_420px] min-w-0 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 sm:gap-7">
        <span className="flex h-36 w-36 sm:h-[172px] sm:w-[172px] shrink-0 rounded-full bg-navy-900 p-1">
          <img
            src={sampleProfilePhoto}
            alt="Profile photo of Ayşe Yılmaz"
            className="h-full w-full rounded-full border-4 border-white object-cover"
          />
        </span>
        <div className="flex-[1_1_200px] flex flex-col gap-3">
          <span className="text-[26px] font-semibold">Ayşe Yılmaz</span>
          <div className="flex flex-wrap gap-5">
            {[
              ['24', 'notes'],
              ['312', 'followers'],
              ['180', 'following'],
            ].map(([value, label]) => (
              <span key={label} className="flex items-baseline gap-1.5">
                <span className="text-lg font-bold">{value}</span>
                <span className="text-[#3d434a]">{label}</span>
              </span>
            ))}
          </div>
          {/* Örnek profil: butonlar sadece görünüm, tıklanmaz */}
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            <span className={`${pillBase} min-h-[38px] px-[18px] text-[15px] bg-navy-900 text-white cursor-default select-none`}>
              Message
            </span>
            <span
              className={`${pillBase} min-h-[38px] px-[18px] text-[15px] border border-navy-900 text-navy-900 cursor-default select-none`}
            >
              Follow
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 font-semibold">
          <Landmark size={18} strokeWidth={1.8} aria-hidden="true" />
          Istanbul Technical University
        </span>
        <span className="flex items-center gap-2 text-[#3d434a]">
          <GraduationCap size={18} strokeWidth={1.8} aria-hidden="true" />
          Computer Engineering · 3rd year
        </span>
        <span className="text-[#3d434a]">My notes are public — feel free to send me your questions.</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex justify-center items-center gap-2 border-t border-[#d6d1c4] pt-3 text-[13px] font-bold tracking-[0.08em]">
          <LayoutGrid size={16} aria-hidden="true" />
          SHARED NOTES
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SAMPLE_NOTES.map((note) => (
            <div
              key={note.title}
              // Telefonda kutular biraz uzun: başlık okunur boyda (15px) sığsın.
              className={`aspect-[3/4] sm:aspect-square min-w-0 rounded-md p-3 flex flex-col justify-between ${note.className}`}
            >
              <span className="text-xs font-bold tracking-[0.08em]">{note.type}</span>
              <span className="text-[15px] font-semibold leading-tight">{note.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Çalışma grupları */

// İkonlu özellik listesi yerine uygulamadaki gerçek bir grup sohbetinin örneği gösterilir.
function GroupsSection() {
  return (
    <section id="community" className="scroll-mt-[72px] bg-[#f4f2ee]">
      {/* Başlık sohbet kartının üstüyle aynı hizada: navbar'dan "Groups"a basınca başlık ekranın üstünde görünsün
          (ortalanınca uzun kartın yanında ekranın ortasına düşüyordu). flex-wrap-reverse dikey ekseni de ters çevirdiği için "üst" = items-end. */}
      <Container className="py-14 sm:py-[72px] flex flex-wrap-reverse items-end gap-10 lg:gap-14">
        <div className="flex-[1_1_440px] min-w-0">
          <GroupChatSample />
        </div>

        <div className="flex-[1_1_360px] flex flex-col gap-6 lg:pt-6">
          <Heading>Learn together in study groups</Heading>
          <p className="m-0 max-w-[470px] text-lg text-[#5e6670]">
            Start a group for a course or an exam. Members share notes in the group, ask each other questions in the
            chat and get ready for the exam together. Private groups only let in the people you approve.
          </p>
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------ Kimler için */

const AUDIENCES = [
  { title: 'Starting a few days before the exam', text: 'Get course summaries and solved questions from classmates in one place' },
  { title: 'Missed a class', text: 'Find the notes for the week you missed from someone taking the same course' },
  { title: 'Want to share your notes', text: 'Upload your tidy notes and answer questions by message' },
];

function AudienceSection() {
  return (
    <section>
      {/* Sade üç sütunlu metin: kart / gölge yok, tıklanabilir gibi durmasın. */}
      <Container className="py-12 sm:py-16">
        <Heading>Who is SearchNote for?</Heading>
        <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
          {AUDIENCES.map(({ title, text }) => (
            <div key={title} className="flex flex-col gap-2 border-t-2 border-navy-900 pt-4">
              <span className="text-lg sm:text-xl font-semibold">{title}</span>
              <span className="text-[#5e6670]">{text}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------------- Kapanış */

// Footer'dan önceki son bölüm: sade bir davet ve uygulamadaki not sayfasının örneği (sahte arama yok).
function ClosingSection() {
  return (
    <section className="scroll-mt-[72px] bg-[#f4f2ee]">
      <Container className="py-12 sm:py-20 flex flex-wrap items-center gap-10">
        <div className="flex-[1_1_320px] max-w-[460px] flex flex-col gap-5">
          <Heading>Someone in your class already wrote it down</Heading>
          <p className="m-0 text-lg text-[#5e6670]">
            Every note here was shared by a student at a university in Türkiye. Read it in your browser, download it
            for free, and if a step isn&rsquo;t clear, message the person who wrote it.
          </p>
        </div>
        <div className="flex-[1_1_480px] min-w-0">
          <NotePageSample />
        </div>
      </Container>
    </section>
  );
}
