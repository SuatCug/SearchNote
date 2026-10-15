import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Folder,
  GraduationCap,
  Landmark,
  LayoutGrid,
  MessageCircle,
  Users,
  type LucideIcon,
} from 'lucide-react';
import GuestNavbar from '@/components/layout/GuestNavbar';
import Footer from '@/components/layout/Footer';
import StudyTableIllustration from '@/components/landing/StudyTableIllustration';
import SearchDemo from '@/components/landing/SearchDemo';
import sampleProfilePhoto from '@/assets/landing/sample-profile.jpg';
import studyGroupIllustration from '@/assets/landing/study-group.svg';

// Giriş yapmamış ziyaretçilere ana sayfada gösterilen tanıtım sayfası.
// Bölüm id'leri (top, features, departments, how-it-works, community) GuestNavbar ve Footer bağlantılarıyla eşleşir.
// Ziyaretçi notlara göz atamadığı için ders/bölüm çipleri giriş sayfasına gider; girişten sonra o aramaya dönülür.

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <GuestNavbar />
      <main className="flex-1 overflow-x-hidden font-display text-[#1b1f24]">
        <HeroSection />
        <CoursesSection />
        <DepartmentsSection />
        <UploadBand />
        <ProfileSection />
        <GroupsSection />
        <AudienceSection />
        <TrySearchSection />
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------- Ortak parçalar */

const pillBase = 'inline-flex items-center justify-center rounded-full font-semibold transition-colors';
const pillPrimary = `${pillBase} min-h-[52px] px-7 text-[17px] bg-navy-900 text-white hover:bg-navy-950`;
const pillOutline = `${pillBase} min-h-[52px] px-7 text-[17px] border border-navy-900 bg-white text-navy-900 hover:bg-navy-50`;
const textLink = 'font-semibold text-navy-900 underline-offset-2 hover:underline hover:text-navy-950';

function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`max-w-6xl mx-auto px-4 sm:px-6 ${className}`}>{children}</div>;
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="m-0 font-light leading-[1.15] text-navy-900 text-balance text-[30px] sm:text-[36px] lg:text-[44px]">{children}</h2>;
}

// Ders ya da bölüm adı, girişten sonra açılacak arama adresi olarak giriş sayfasına taşınır.
const searchState = (query: string) => ({ from: `/?q=${encodeURIComponent(query)}` });

function ChipList({ items, extra, variant }: { items: string[]; extra: string[]; variant: 'outline' | 'soft' }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? [...items, ...extra] : items;
  const chipClass =
    variant === 'outline'
      ? 'border border-[#8c9199] hover:border-navy-900 hover:bg-white'
      : 'bg-[#e9edf4] hover:bg-navy-100';

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
  return (
    <section id="top" className="scroll-mt-16">
      <Container className="pt-8 pb-14 sm:pt-10 sm:pb-16 flex flex-wrap items-center gap-8">
        <div className="flex-[1_1_420px] max-w-[540px] flex flex-col gap-8">
          <h1 className="m-0 font-light leading-[1.15] text-navy-900 text-balance text-[36px] sm:text-[46px] lg:text-[56px]">
            Welcome to the place where students find their notes
          </h1>

          <div className="flex flex-col gap-3.5 max-w-[400px]">
            <Link to="/register" className={pillPrimary}>
              Create a free account
            </Link>
            <Link
              to="/login"
              className={`${pillBase} min-h-[52px] px-6 text-[17px] border border-[#5e6670] text-[#3d434a] hover:bg-gray-50 hover:border-[#3d434a]`}
            >
              Log in
            </Link>
            <p className="m-0 text-xs text-center text-[#5e6670]">
              By continuing, you agree to SearchNote&rsquo;s{' '}
              <Link to="/legal/terms" className={textLink}>Terms of Use</Link>,{' '}
              <Link to="/legal/privacy" className={textLink}>Privacy Policy</Link> and{' '}
              <Link to="/legal/cookies" className={textLink}>Cookie Policy</Link>.
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

/* -------------------------------------------------------- Popüler dersler */

const COURSES = ['Calculus I', 'Physics II', 'Data Structures', 'Linear Algebra', 'Microeconomics', 'Organic Chemistry', 'Anatomy', 'Statistics'];
const MORE_COURSES = ['Differential Equations', 'Thermodynamics', 'Discrete Mathematics', 'Macroeconomics', 'Biochemistry', 'Algorithms'];

function CoursesSection() {
  return (
    <section id="features" className="scroll-mt-16 bg-[#f4f2ee]">
      <Container className="py-12 sm:py-14 flex flex-wrap gap-8">
        <div className="flex-[1_1_300px] flex flex-col gap-2">
          <Heading>Explore popular courses</Heading>
          <p className="m-0 text-lg text-[#5e6670]">The most searched courses this term</p>
        </div>
        <div className="flex-[2_1_520px] min-w-0">
          <ChipList items={COURSES} extra={MORE_COURSES} variant="outline" />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------- Bölüm sınavları */

const DEPARTMENTS = ['Computer Engineering', 'Electrical & Electronics', 'Medicine', 'Law', 'Economics', 'Business', 'Architecture', 'Psychology'];
const MORE_DEPARTMENTS = ['Civil Engineering', 'Mechanical Engineering', 'Industrial Engineering', 'Mathematics', 'Molecular Biology', 'Political Science'];

function DepartmentsSection() {
  return (
    <section id="departments" className="scroll-mt-16">
      <Container className="py-12 sm:py-14 flex flex-wrap gap-8">
        <div className="flex-[1_1_300px]">
          <Heading>Find notes for your department</Heading>
        </div>
        <div className="flex-[2_1_520px] min-w-0 flex flex-col gap-4">
          <span className="text-sm font-semibold tracking-wide text-[#5e6670]">BROWSE DEPARTMENTS</span>
          <ChipList items={DEPARTMENTS} extra={MORE_DEPARTMENTS} variant="soft" />
        </div>
      </Container>
    </section>
  );
}

/* ------------------------------------------------------------ Not yükle */

function UploadBand() {
  return (
    <section className="bg-[#eaf0f8]">
      <Container className="py-10 sm:py-12 flex flex-wrap items-center justify-between gap-6">
        <h2 className="flex-[1_1_480px] m-0 font-light leading-[1.15] text-navy-900 text-balance text-[28px] sm:text-[34px] lg:text-[40px]">
          Upload your notes and reach the students who need them
        </h2>
        <Link to="/register" className={pillOutline}>
          Upload a note
        </Link>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------------- Profil */

const PROFILE_POINTS = [
  'All the notes you’ve shared in one place',
  'Your university, department and year',
  'One tap from your profile to a message',
];

const SAMPLE_NOTES = [
  { type: 'PDF', title: 'Data Structures final summary', className: 'bg-navy-900 text-white' },
  { type: 'DOCX', title: 'Linear Algebra midterm prep', className: 'bg-[#f2c14e] text-navy-900' },
  { type: 'JPG', title: 'Algorithm analysis board notes', className: 'bg-[#c9d6ea] text-navy-900' },
];

function ProfileSection() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-[#f4f2ee]">
      <Container className="py-14 sm:py-[72px] flex flex-wrap items-center gap-10 lg:gap-14">
        <div className="flex-[1_1_400px] flex flex-col gap-6">
          <Heading>Build your profile and let your notes speak for you</Heading>
          <p className="m-0 max-w-[470px] text-lg text-[#5e6670]">
            Your department, your courses and the notes you share — all on one page. Students taking the same course
            can find you and ask their questions directly.
          </p>
          <ul className="m-0 p-0 list-none flex flex-col gap-3">
            {PROFILE_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-[17px]">
                <CircleCheck size={22} className="shrink-0 text-navy-900" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
          <Link to="/register" className={`${pillPrimary} self-start`}>
            Create your profile
          </Link>
        </div>

        <SampleProfile />
      </Container>
    </section>
  );
}

// Tanıtım amaçlı örnek profil; butonlar kayıt sayfasına gider.
function SampleProfile() {
  return (
    <div className="flex-[1_1_420px] min-w-0 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-6 sm:gap-7">
        <span className="flex h-36 w-36 sm:h-[172px] sm:w-[172px] shrink-0 rounded-full bg-navy-900 p-1">
          <img
            src={sampleProfilePhoto}
            alt="Profile photo of Ayşe Yılmaz"
            className="h-full w-full rounded-full border-4 border-[#f4f2ee] object-cover"
          />
        </span>
        <div className="flex-[1_1_200px] flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[26px] font-semibold">Ayşe Yılmaz</span>
            <span className="rounded-full border border-[#c4c4c4] px-2.5 py-0.5 text-xs font-semibold text-[#5e6670]">
              Sample profile
            </span>
          </div>
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
          <div className="flex flex-wrap gap-2">
            <Link to="/register" className={`${pillBase} min-h-[38px] px-[18px] text-[15px] bg-navy-900 text-white hover:bg-navy-950`}>
              Message
            </Link>
            <Link
              to="/register"
              className={`${pillBase} min-h-[38px] px-[18px] text-[15px] border border-navy-900 text-navy-900 hover:bg-white`}
            >
              Follow
            </Link>
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
            <Link
              key={note.title}
              to="/register"
              className={`aspect-square min-w-0 rounded-md p-2.5 sm:p-3 flex flex-col justify-between transition-opacity hover:opacity-90 ${note.className}`}
            >
              <span className="text-[11px] font-bold tracking-[0.08em]">{note.type}</span>
              <span className="text-[13px] sm:text-[15px] font-semibold leading-tight">{note.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Çalışma grupları */

const GROUP_FEATURES: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Users, title: 'Course groups', text: 'Start a group with students taking the same course, or join an existing one.' },
  { icon: Folder, title: 'Shared note space', text: 'Notes shared in the group are right there for every member.' },
  { icon: MessageCircle, title: 'Group chat', text: 'Ask questions instantly and plan your study sessions together.' },
];

function GroupsSection() {
  return (
    <section id="community" className="scroll-mt-16">
      <Container className="py-14 sm:py-[72px] flex flex-wrap-reverse items-center gap-10 lg:gap-14">
        <div className="flex-[1_1_400px] min-w-0 flex justify-center">
          <img
            src={studyGroupIllustration}
            alt="A group of students looking at results shared on a screen together"
            className="w-full max-w-[500px] h-auto"
          />
        </div>

        <div className="flex-[1_1_400px] flex flex-col gap-6">
          <Heading>Learn together in study groups</Heading>
          <p className="m-0 max-w-[470px] text-lg text-[#5e6670]">
            Start a group for a course or an exam, keep the notes in one place and get ready for the exam together.
          </p>
          <div className="flex flex-col gap-4">
            {GROUP_FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-navy-900 ring-1 ring-black/[0.06]"
                >
                  <Icon size={22} strokeWidth={1.8} />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-lg font-semibold">{title}</span>
                  <span className="text-[#5e6670]">{text}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/register" className={pillPrimary}>
              Start a group
            </Link>
            <Link to="/groups" className={pillOutline}>
              Browse groups
            </Link>
          </div>
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
    <section className="bg-[#f4f2ee]">
      <Container className="py-12 sm:py-16 flex flex-wrap gap-8">
        <div className="flex-[1_1_300px]">
          <Heading>Who is SearchNote for?</Heading>
        </div>
        <div className="flex-[2_1_520px] min-w-0 flex flex-col gap-3">
          {AUDIENCES.map(({ title, text }) => (
            <Link
              key={title}
              to="/register"
              className="group flex items-center justify-between gap-5 rounded-lg bg-white p-5 sm:p-6 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_6px_14px_rgba(0,0,0,0.08)]"
            >
              <span className="flex flex-col gap-1">
                <span className="text-lg sm:text-xl font-semibold">{title}</span>
                <span className="text-[#5e6670]">{text}</span>
              </span>
              <ChevronRight size={24} className="shrink-0 text-[#3d434a] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------------------------------------------------------- Aramayı dene */

function TrySearchSection() {
  return (
    <section id="try-search" className="scroll-mt-16">
      <Container className="py-12 sm:py-16 flex flex-wrap gap-8">
        <div className="flex-[1_1_300px] flex flex-col gap-4">
          <Heading>Try the search before you sign up</Heading>
          <p className="m-0 text-lg text-[#5e6670]">
            These are sample notes. Search them by course, course code, instructor or university — exactly the way it
            works inside SearchNote.
          </p>
          <Link to="/register" className={`${pillPrimary} self-start`}>
            Search the real catalog
          </Link>
        </div>
        <div className="flex-[2_1_520px] min-w-0">
          <SearchDemo />
        </div>
      </Container>
    </section>
  );
}
