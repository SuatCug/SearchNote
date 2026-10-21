import { Link } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { band, Container, Heading, muted, PageTitle, pillPrimary, RuledColumn, textLink } from '@/components/info/InfoParts';

// Notların nasıl sıralandığını gösteren örnek yol: okul → bölüm → ders → not. Tıklanmaz.
const SAMPLE_PATH = [
  { label: 'University', value: 'Istanbul Technical University' },
  { label: 'Department', value: 'Computer Engineering' },
  { label: 'Course', value: 'BLG 223E · Data Structures' },
  { label: 'Note', value: 'Final summary.pdf' },
];

function SamplePath() {
  return (
    <ol className="m-0 p-0 list-none" aria-label="Example: how a note is filed">
      {SAMPLE_PATH.map(({ label, value }, i) => (
        <li key={label} className="relative flex gap-4 pb-6 last:pb-0">
          {i < SAMPLE_PATH.length - 1 && <span className="absolute left-[7px] top-5 bottom-0 w-px bg-[#c9c3b5]" aria-hidden="true" />}
          <span
            className={`relative mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-navy-900 ${
              i === SAMPLE_PATH.length - 1 ? 'bg-navy-900' : 'bg-white'
            }`}
            aria-hidden="true"
          />
          <span className="flex flex-col">
            <span className="text-xs font-bold tracking-[0.08em] uppercase text-[#5e6670]">{label}</span>
            <span className="text-lg sm:text-xl font-semibold">{value}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export default function AboutPage() {
  return (
    <PageLayout full>
      <section>
        <Container className="py-12 sm:py-16 flex flex-wrap items-center gap-10 lg:gap-16">
          <div className="flex-[1_1_420px] max-w-[560px] flex flex-col gap-6">
            <PageTitle>Course notes shouldn&rsquo;t disappear when the term ends</PageTitle>
            <p className={`m-0 text-lg ${muted}`}>
              Every term, students taking the same course write the same summaries and look for the same past exams. Most
              of that work stays in one notebook or gets lost in a group chat. SearchNote keeps it in one place, filed by
              university, department and course, so the next student can find it.
            </p>
          </div>
          <div className={`flex-[1_1_320px] max-w-[440px] rounded-lg ${band} p-6 sm:p-8`}>
            <SamplePath />
          </div>
        </Container>
      </section>

      <section className={band}>
        <Container className="py-12 sm:py-16">
          <Heading>A few things we decided early</Heading>
          <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
            <RuledColumn title="Free, without credits">
              Searching, previewing and downloading cost nothing. There are no paid plans, download credits or limits.
            </RuledColumn>
            <RuledColumn title="You choose the audience">
              Every note can go to everyone, only your followers, or one study group. Your email is never shown to others.
            </RuledColumn>
            <RuledColumn title="No ads, no data selling">
              Your data is used only to run SearchNote. The{' '}
              <Link to="/legal/privacy" className={textLink}>
                Privacy Policy
              </Link>{' '}
              lists everything we keep.
            </RuledColumn>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-12 sm:py-16 flex flex-wrap gap-8 lg:gap-16">
          <div className="flex-[1_1_300px]">
            <Heading>Who&rsquo;s behind it</Heading>
          </div>
          <div className="flex-[2_1_480px] flex flex-col gap-4 text-lg">
            <p className="m-0">
              SearchNote is built and run by Suat Cuğ, an individual developer. There is no company or investor behind it,
              which is why the site stays simple and free.
            </p>
            <p className={`m-0 ${muted}`}>
              That also means feedback reaches the person who writes the code. If something is broken, confusing or
              missing, a short message is the fastest way to get it changed.
            </p>
          </div>
        </Container>
      </section>

      <section className={band}>
        <Container className="py-12 sm:py-14 flex flex-wrap items-center justify-between gap-6">
          <Heading>Have an idea or found a bug?</Heading>
          <Link to="/contact?topic=feedback" className={pillPrimary}>
            Write to us
          </Link>
        </Container>
      </section>
    </PageLayout>
  );
}
