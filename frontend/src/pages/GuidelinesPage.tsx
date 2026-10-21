import { Link } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { band, Container, Heading, muted, PageTitle, RuledColumn, textLink } from '@/components/info/InfoParts';

const SHORT_VERSION = ['Share your own work.', 'Be kind in comments and chats.', 'Respect who the author shared it with.'];

const DO = [
  'Share notes, summaries and solutions you prepared yourself.',
  'Fill in the course code, instructor and semester so others can find your note.',
  'Give useful feedback in comments and thank people for their work.',
  'Keep group chats on topic and friendly.',
  'Report content that breaks the rules instead of arguing about it.',
];

const DONT = [
  'Upload copyrighted textbooks, paid course packs or publisher slides.',
  'Share exam questions your instructor asked to keep private.',
  'Pass on a followers-only or group note to people outside that audience.',
  'Post other people’s personal information, photos or contact details.',
  'Spam, advertise, harass others or use hate speech.',
  'Upload files that contain malware or are not what their title says.',
];

function RuleList({ title, items, accent }: { title: string; items: string[]; accent: string }) {
  return (
    <div className={`border-t-2 ${accent} pt-4`}>
      <h2 className="m-0 text-xl font-semibold">{title}</h2>
      <ul className="mt-4 mb-0 pl-5 list-disc space-y-3 text-[17px] leading-relaxed text-[#3d434a] marker:text-[#8c9199]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function GuidelinesPage() {
  return (
    <PageLayout full>
      <section>
        <Container className="py-12 sm:py-16 flex flex-wrap items-center gap-10 lg:gap-16">
          <div className="flex-[1_1_420px] max-w-[560px] flex flex-col gap-6">
            <PageTitle>Community Guidelines</PageTitle>
            <p className={`m-0 text-lg ${muted}`}>
              SearchNote works when students can trust the notes they find. These rules apply to notes, comments, study
              groups and messages.
            </p>
          </div>
          <div className={`flex-[1_1_320px] max-w-[440px] rounded-lg ${band} p-6 sm:p-8`}>
            <p className="m-0 text-xs font-bold tracking-[0.08em] uppercase text-[#5e6670]">The short version</p>
            <ol className="mt-4 mb-0 pl-6 list-decimal space-y-2 text-xl sm:text-2xl font-light text-navy-900">
              {SHORT_VERSION.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <section>
        <Container className="pb-12 sm:pb-16 grid gap-10 md:grid-cols-2 md:gap-14">
          <RuleList title="Please do" items={DO} accent="border-navy-900" />
          <RuleList title="Please don't" items={DONT} accent="border-[#b4483c]" />
        </Container>
      </section>

      <section className={band}>
        <Container className="py-12 sm:py-16">
          <Heading>When something breaks the rules</Heading>
          <div className="mt-8 grid gap-8 sm:grid-cols-3 sm:gap-10">
            <RuledColumn title="Report it">
              Report a user from their profile. To report a note, use the{' '}
              <Link to="/contact?topic=copyright" className={textLink}>
                contact form
              </Link>{' '}
              and include the link to the note.
            </RuledColumn>
            <RuledColumn title="We review it">
              Notes, comments or messages that break these guidelines are removed. For a first or minor problem we may
              only warn the user.
            </RuledColumn>
            <RuledColumn title="Repeated problems">
              Serious or repeated violations can lead to the account being suspended or closed.
            </RuledColumn>
          </div>
        </Container>
      </section>

      <section>
        <Container className="py-10 sm:py-12">
          <p className={`m-0 text-lg ${muted}`}>
            The full rules are in the{' '}
            <Link to="/legal/terms" className={textLink}>
              Terms of Use
            </Link>
            . What you can and can&rsquo;t upload is explained in the{' '}
            <Link to="/legal/copyright" className={textLink}>
              Copyright Policy
            </Link>
            .
          </p>
        </Container>
      </section>
    </PageLayout>
  );
}
