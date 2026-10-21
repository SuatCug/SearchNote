import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import PageLayout from '@/components/layout/PageLayout';
import NotePageSample from '@/components/landing/NotePageSample';
import GroupChatSample from '@/components/landing/GroupChatSample';
import { band, chip, Container, Heading, muted, PageTitle, pillOutline, pillPrimary, RuledColumn, textLink } from '@/components/info/InfoParts';
import { MAX_FILE_SIZE_MB } from '@/lib/constants';

const STEPS = [
  { id: 'sign-up', label: 'Sign up' },
  { id: 'find', label: 'Find notes' },
  { id: 'share', label: 'Share yours' },
  { id: 'together', label: 'Study together' },
];

const FILE_TYPES = ['PDF', 'DOCX', 'JPG', 'PNG', 'ZIP', 'RAR'];
const FILTERS = ['Course code', 'Course name', 'Instructor', 'University', 'Department', 'Semester', 'File type'];

function StepLabel({ n }: { n: number }) {
  return <span className="text-sm font-bold tracking-[0.08em] uppercase text-[#5e6670]">Step {n}</span>;
}

function Step({ id, className = '', children }: { id: string; className?: string; children: ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-[72px] ${className}`}>
      {children}
    </section>
  );
}

export default function HowItWorksPage() {
  const token = useAppSelector((state) => state.auth.token);

  return (
    <PageLayout full>
      <section>
        <Container className="py-12 sm:py-16 flex flex-wrap items-end gap-10 lg:gap-16">
          <div className="flex-[1_1_420px] max-w-[560px] flex flex-col gap-6">
            <PageTitle>How SearchNote works</PageTitle>
            <p className={`m-0 text-lg ${muted}`}>
              From signing up to sharing your first note. Each step takes a minute or two.
            </p>
          </div>
          <nav className="flex-[1_1_260px] max-w-[360px]" aria-label="Steps">
            <ol className="m-0 p-0 list-none border-l-2 border-[#d6d1c4]">
              {STEPS.map(({ id, label }, i) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="-ml-0.5 flex gap-3 border-l-2 border-transparent py-2 pl-4 text-lg hover:border-navy-900 hover:text-navy-900"
                  >
                    <span className="w-5 text-[#8c9199]">{i + 1}</span>
                    {label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </Container>
      </section>

      <Step id="sign-up" className={band}>
        <Container className="py-12 sm:py-16 flex flex-wrap gap-8 lg:gap-16">
          <div className="flex-[1_1_300px] flex flex-col gap-3">
            <StepLabel n={1} />
            <Heading>Create an account</Heading>
          </div>
          <div className="flex-[2_1_480px] flex flex-col gap-4 text-lg">
            <p className="m-0">
              Sign up with your email address or your Google account, then choose your university and department. If you
              use email, we send a 6-digit code to confirm it.
            </p>
            <p className={`m-0 ${muted}`}>
              Your school and department appear on your profile and help us suggest students you may know. You can change
              them later in Settings.
            </p>
          </div>
        </Container>
      </Step>

      <Step id="find">
        <Container className="py-12 sm:py-16 flex flex-wrap items-center gap-10 lg:gap-14">
          <div className="flex-[1_1_360px] max-w-[480px] flex flex-col gap-5">
            <StepLabel n={2} />
            <Heading>Find the notes for your course</Heading>
            <p className={`m-0 text-lg ${muted}`}>
              Type a course code, a course name or an instructor, then narrow it down:
            </p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <span key={f} className={chip}>
                  {f}
                </span>
              ))}
            </div>
            <p className={`m-0 text-lg ${muted}`}>
              PDFs and images open in the browser, so you can check a note before downloading it. Downloads are free and
              unlimited.
            </p>
          </div>
          <div className="flex-[1_1_480px] min-w-0">
            <NotePageSample />
          </div>
        </Container>
      </Step>

      <Step id="share" className={band}>
        <Container className="py-12 sm:py-16">
          <div className="flex flex-wrap gap-8 lg:gap-16">
            <div className="flex-[1_1_300px] flex flex-col gap-3">
              <StepLabel n={3} />
              <Heading>Share what you wrote</Heading>
            </div>
            <div className="flex-[2_1_480px] flex flex-col gap-4">
              <p className="m-0 text-lg">
                Upload one file per note, up to {MAX_FILE_SIZE_MB} MB. Add the course code and name, and if you like the
                instructor and semester, so others can find it.
              </p>
              <div className="flex flex-wrap gap-2">
                {FILE_TYPES.map((t) => (
                  <span key={t} className={chip}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-10 mb-0 text-lg font-semibold">Then choose who sees it:</p>
          <div className="mt-4 grid gap-8 sm:grid-cols-3 sm:gap-10">
            <RuledColumn title="Everyone">Shown in search, in feeds and on your profile.</RuledColumn>
            <RuledColumn title="Followers only">Only people who follow you can open it.</RuledColumn>
            <RuledColumn title="One study group">
              Only members of that group see it. It doesn&rsquo;t appear on your profile or in search.
            </RuledColumn>
          </div>
        </Container>
      </Step>

      <Step id="together">
        <Container className="py-12 sm:py-16 flex flex-wrap-reverse items-end gap-10 lg:gap-14">
          <div className="flex-[1_1_440px] min-w-0">
            <GroupChatSample />
          </div>
          <div className="flex-[1_1_360px] flex flex-col gap-5 lg:pt-6">
            <StepLabel n={4} />
            <Heading>Study together</Heading>
            <p className={`m-0 text-lg ${muted}`}>
              Start a group for a course or join one. Anyone can join a public group; a private group lets in only the
              people the founder approves. Notes and chat in a group stay inside it.
            </p>
            <p className={`m-0 text-lg ${muted}`}>
              Follow students whose notes help you, leave comments, and message the author when a step isn&rsquo;t clear.
            </p>
          </div>
        </Container>
      </Step>

      <section className={band}>
        <Container className="py-12 sm:py-14 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Heading>{token ? 'Got notes from this term?' : 'Ready to try it?'}</Heading>
            <p className={`m-0 ${muted}`}>
              More questions are answered in the{' '}
              <Link to="/help" className={textLink}>
                Help Center
              </Link>
              .
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {token ? (
              <Link to="/upload" className={pillPrimary}>
                Upload a note
              </Link>
            ) : (
              <>
                <Link to="/register" className={pillPrimary}>
                  Sign up
                </Link>
                <Link to="/login" className={pillOutline}>
                  Log in
                </Link>
              </>
            )}
          </div>
        </Container>
      </section>
    </PageLayout>
  );
}
