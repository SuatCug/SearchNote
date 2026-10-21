import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { band, Container, Heading, muted, PageTitle, pillBase, pillPrimary } from '@/components/info/InfoParts';
import { MAX_FILE_SIZE_MB } from '@/lib/constants';

const FAQ = [
  {
    category: 'Getting started',
    items: [
      ['Is SearchNote really free?', 'Yes. Searching, previewing, downloading and sharing notes is free. There are no credits, subscriptions or download limits.'],
      ['Do I need an account?', 'Yes, to search, preview and download notes, comment, follow students or join groups. If someone sends you a link to a public note, you can open its page without signing in.'],
      ['How do I change my profile?', 'Open the menu under your profile photo in the top right corner and choose Settings. There you can change your name, school, department, bio, profile photo and password.'],
    ],
  },
  {
    category: 'Sharing notes',
    items: [
      ['Which file types can I upload?', `PDF, Word (DOCX), JPG, PNG, ZIP and RAR files up to ${MAX_FILE_SIZE_MB} MB each.`],
      ['Who can see the notes I share?', 'You choose for every note. Public notes appear in search, in feeds and on your profile. Followers-only notes are visible only to people who follow you. Notes you share in a group are visible only to that group’s members.'],
      ['Can I edit or delete a note?', 'Yes. Open the note and use the Edit or Delete buttons. The file itself cannot be replaced; upload a new note to share a different file.'],
      ['What should I not upload?', 'Copyrighted textbooks, paid course materials, other people’s personal data or anything your instructor asked to keep private. See the Community Guidelines for details.'],
    ],
  },
  {
    category: 'Study groups',
    items: [
      ['What is the difference between public and private groups?', 'Anyone can join a public group right away. A private group needs the founder’s approval, and its member list is hidden from non-members. In both, notes and chat are visible to members only.'],
      ['What can a group founder do?', 'The founder can edit or delete the group, approve join requests, remove members and hand the founder role over to another member. Deleting a group also deletes its chat and all notes shared in it.'],
      ['Can the founder leave the group?', 'Not directly. The founder first needs to hand the founder role over to another member or delete the group.'],
    ],
  },
  {
    category: 'Account & safety',
    items: [
      ['I forgot my password. What can I do?', 'On the login page choose "Forgot password?". We send a code to your email address, and you use it to set a new password.'],
      ['How do I report a user or a note?', 'To report a user, open their profile and choose Report. To report a note, use the contact form with the "Copyright / report content" topic and include the link to the note.'],
      ['How do I block someone?', 'Open their profile and choose Block. Blocked users cannot message or follow you. You can unblock them in Settings under Blocked accounts.'],
      ['How do I delete my account?', 'Go to Settings and choose Delete account. You confirm it with a code sent to your email address. Your profile, notes, comments and messages are deleted permanently.'],
    ],
  },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function HelpPage() {
  return (
    <PageLayout full>
      <section>
        <Container className="py-12 sm:py-16 flex flex-col gap-6">
          <PageTitle>How can we help?</PageTitle>
          <p className={`m-0 max-w-[560px] text-lg ${muted}`}>Answers to the questions students ask most. Pick a topic:</p>
          <div className="flex flex-wrap gap-2.5">
            {FAQ.map(({ category }) => (
              <a
                key={category}
                href={`#${slugify(category)}`}
                className={`${pillBase} min-h-11 px-5 text-base border border-[#8c9199] text-[#3d434a] hover:border-navy-900 hover:text-navy-900`}
              >
                {category}
              </a>
            ))}
          </div>
        </Container>
      </section>

      <Container className="pb-12 sm:pb-16">
        {FAQ.map(({ category, items }) => (
          <section
            key={category}
            id={slugify(category)}
            className="scroll-mt-[72px] grid gap-4 border-t border-[#d6d1c4] py-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12"
          >
            <h2 className="m-0 text-2xl font-light text-navy-900">{category}</h2>
            <div className="divide-y divide-[#e5e1d8]">
              {items.map(([question, answer]) => (
                <details key={question} className="group py-4 first:pt-0 lg:first:pt-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold hover:text-navy-900 [&::-webkit-details-marker]:hidden">
                    {question}
                    <ChevronDown size={20} className="shrink-0 text-[#8c9199] transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-2 mb-0 max-w-[640px] text-[17px] leading-relaxed text-[#3d434a]">{answer}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </Container>

      <section className={band}>
        <Container className="py-12 sm:py-14 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <Heading>Didn&rsquo;t find your answer?</Heading>
            <p className={`m-0 ${muted}`}>Send a message and we&rsquo;ll reply to your email.</p>
          </div>
          <Link to="/contact?topic=support" className={pillPrimary}>
            Contact us
          </Link>
        </Container>
      </section>
    </PageLayout>
  );
}
