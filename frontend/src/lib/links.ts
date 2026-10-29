import { SITE_URL } from '@/lib/constants';

// Ders etiketleri: ders kodu varsa o koda göre filtreler, yoksa ders adıyla arar.
export const courseLink = ({ courseCode, courseName }: { courseCode?: string; courseName: string }) =>
  courseCode ? `/?courseCode=${encodeURIComponent(courseCode)}` : `/?q=${encodeURIComponent(courseName)}`;

// Mesaj metnindeki bağlantılar (http/https ve www.); sondaki nokta, virgül, parantez bağlantıya dahil değildir.
// Yakalama grubu var: text.split(URL_PATTERN) sonucunda tek indeksler bağlantıdır.
export const URL_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,:;!?)\]'"»”])/gi;
// Uygulamanın kendi adresleri: bunlar sayfayı yenilemeden uygulama içinde açılır (grup daveti, not, profil...).
const APP_HOSTS = new Set([new URL(SITE_URL).host, window.location.host]);

// SearchNote bağlantısıysa uygulama içi yol (/groups/...), değilse null.
export const toInternalPath = (href: string) => {
  try {
    const url = new URL(href.startsWith('www.') ? `https://${href}` : href);
    return APP_HOSTS.has(url.host) ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
};

// Mesajdaki ilk grup bağlantısı (davet kartı için): grubun id'si ve kart gösterilirken metinden çıkarılan bağlantı.
export function groupLinkInText(text: string) {
  for (const url of text.match(URL_PATTERN) ?? []) {
    const match = toInternalPath(url)?.match(/^\/groups\/([0-9a-f]{24})\/?(?:[?#].*)?$/i);
    if (match) return { id: match[1], url };
  }
  return null;
}
