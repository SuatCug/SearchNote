import { Link, NavLink, useParams } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import NotFoundPage from './NotFoundPage';
import { formatDate } from '@/lib/format';
import { LAST_UPDATED, LEGAL_DOCUMENTS, type LegalBlock } from './legalDocuments';

// Düzen LinkedIn'in Privacy Policy sayfasını izler: üstte belge sekmeleri, krem başlık bandı (altında varsa video),
// içindekiler, numaralı bölümler ve alt bölümler (1.1, 1.2 ...). Metinler legalDocuments.ts'te.
const bodyClass = 'text-[15px] leading-relaxed text-gray-700';

function Blocks({ blocks }: { blocks: LegalBlock[] }) {
  return blocks.map((block, i) =>
    Array.isArray(block) ? (
      <ul key={i} className={`mt-3 list-disc pl-5 space-y-1.5 ${bodyClass}`}>
        {block.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={i} className={`mt-3 ${bodyClass}`}>
        {block}
      </p>
    )
  );
}

// Alttaki iletişim bağlantısı formu belgeye uygun konu seçili açar.
const CONTACT_TOPIC: Record<string, string> = { privacy: 'privacy', kvkk: 'privacy', copyright: 'copyright' };

export default function LegalPage() {
  const { slug } = useParams();
  const doc = slug ? LEGAL_DOCUMENTS[slug] : undefined;
  if (!doc) return <NotFoundPage />;

  const hero = (
    <header>
      <nav className="bg-white border-b border-gray-200" aria-label="Legal documents">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 overflow-x-auto no-scrollbar">
          <ul className="flex w-max mx-auto gap-1">
            {Object.entries(LEGAL_DOCUMENTS).map(([key, { title }]) => (
              <li key={key} className="shrink-0">
                <NavLink
                  to={`/legal/${key}`}
                  className={({ isActive }) =>
                    `block px-3 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
                      isActive ? 'border-navy-700 text-navy-800' : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`
                  }
                >
                  {title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="bg-[#f6efe2]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h1 className="text-center text-3xl sm:text-4xl font-semibold text-gray-900">{doc.title}</h1>
          <p className="mt-2 text-center text-sm italic text-gray-500">Effective {formatDate(doc.updated ?? LAST_UPDATED)}</p>

          {doc.intro && <p className={`mt-8 max-w-3xl mx-auto text-center ${bodyClass}`}>{doc.intro}</p>}
        </div>
      </div>
    </header>
  );

  return (
    <PageLayout hero={hero} plain>
      <article className="max-w-3xl mx-auto pb-4">
        {doc.video && (
          <video
            src={doc.video.src}
            poster={doc.video.poster}
            controls
            preload="metadata"
            className="mt-4 block w-full h-auto"
          />
        )}

        <nav className={doc.video ? 'mt-12' : 'mt-4'} aria-label="Table of contents">
          <h2 className="text-lg font-semibold text-gray-900">Table of contents</h2>
          <ol className="mt-3 space-y-2 list-decimal list-inside text-[15px]">
            {doc.sections.map(({ heading }, i) => (
              <li key={heading} className="text-gray-500">
                <a href={`#section-${i + 1}`} className="text-navy-700 hover:underline">
                  {heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-4">
          {doc.sections.map(({ heading, blocks, subsections }, i) => (
            <section key={heading} id={`section-${i + 1}`} className="scroll-mt-24 border-t border-gray-200 pt-8 mt-8">
              <h2 className="text-xl font-semibold text-gray-900">
                {i + 1}. {heading}
              </h2>
              {blocks && <Blocks blocks={blocks} />}
              {subsections?.map((sub, j) => (
                <div key={sub.heading} className="mt-6">
                  <h3 className="text-base font-semibold text-gray-900">
                    {i + 1}.{j + 1} {sub.heading}
                  </h3>
                  <Blocks blocks={sub.blocks} />
                </div>
              ))}
            </section>
          ))}
        </div>

        <p className={`mt-10 border-t border-gray-200 pt-8 ${bodyClass}`}>
          Questions about this document? Write to us through the{' '}
          <Link to={`/contact?topic=${CONTACT_TOPIC[slug!] ?? 'general'}`} className="text-navy-700 hover:underline">
            contact form
          </Link>
          .
        </p>
      </article>
    </PageLayout>
  );
}
