// Ziyaretçi navbar'ının dolu (solid) simgeleri. LinkedIn'deki gibi ince çizgili değil, tek renk dolu şekiller;
// renk üstteki yazının rengini (currentColor) izler.
import type { ReactNode } from 'react';

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

// İçinde kalp olan konuşma balonu: beğeni ve yorum alan notlar öne çıkar
export function PopularNotesIcon() {
  return (
    <Icon>
      <path
        fillRule="evenodd"
        d="M3 3h18a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-9l-5 4v-4H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm9 12.5c.2 0 .4-.1.6-.2 2.6-2 4.4-3.6 4.4-5.8 0-1.5-1.1-2.7-2.5-2.7-.9 0-1.8.5-2.5 1.3-.7-.8-1.6-1.3-2.5-1.3C8.1 6.8 7 8 7 9.5c0 2.2 1.8 3.8 4.4 5.8.2.1.4.2.6.2Z"
      />
    </Icon>
  );
}

// Açık kitap
export function CoursesIcon() {
  return (
    <Icon>
      <path d="M2 4.6C4.9 3.4 8 3.6 11 5.2V21c-3-1.6-6.1-1.8-9-.6V4.6Z" />
      <path d="M13 5.2c3-1.6 6.1-1.8 9-.6v15.8c-2.9-1.2-6-1-9 .6V5.2Z" />
    </Icon>
  );
}

// Tek kişi
export function StudentsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="7" r="4.5" />
      <path d="M3 21c0-4.4 4-7.5 9-7.5s9 3.1 9 7.5v1H3v-1Z" />
    </Icon>
  );
}

// Üç kişi
export function GroupsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="6.5" r="3.5" />
      <circle cx="4.8" cy="9" r="2.5" />
      <circle cx="19.2" cy="9" r="2.5" />
      <path d="M5.5 20c0-3.7 2.9-6.5 6.5-6.5s6.5 2.8 6.5 6.5v1h-13v-1Z" />
      <path d="M0 20c0-2.6 1.9-4.6 4.6-4.6.6 0 1.2.1 1.7.3A8.3 8.3 0 0 0 4 20v1H0v-1Zm24 0c0-2.6-1.9-4.6-4.6-4.6-.6 0-1.2.1-1.7.3A8.3 8.3 0 0 1 20 20v1h4v-1Z" />
    </Icon>
  );
}

// Üstünde yıldız olan quiz kartı: AI ile quiz / flashcard çalışma
export function PracticeIcon() {
  return (
    <Icon>
      <path
        fillRule="evenodd"
        d="M5 4h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1.3 5.6 1.4-1.4 1 1 2.3-2.3 1.4 1.4-3.7 3.7-2.4-2.4Zm0 6 1.4-1.4 1 1 2.3-2.3 1.4 1.4-3.7 3.7-2.4-2.4Z"
      />
      <path d="M20 1l.9 2.1L23 4l-2.1.9L20 7l-.9-2.1L17 4l2.1-.9L20 1Z" />
    </Icon>
  );
}

// Birbirine bağlı düğümler: konuların bilgi haritası
export function KnowledgeIcon() {
  return (
    <Icon>
      <circle cx="12" cy="4.5" r="3.5" />
      <circle cx="4.5" cy="18.5" r="3.5" />
      <circle cx="19.5" cy="18.5" r="3.5" />
      <path d="M11 7.5h2v4.2l5.6 4.4-1.2 1.6L12 13.4l-5.4 4.3-1.2-1.6 5.6-4.4V7.5Z" />
    </Icon>
  );
}

// İçinde soru işareti olan konuşma balonu: notların içinde soru sorma (Ask)
export function AskIcon() {
  return (
    <Icon>
      <path
        fillRule="evenodd"
        d="M12 2C6.5 2 2 5.9 2 10.7c0 2.6 1.3 4.9 3.4 6.5L4.5 22l5-2.6c.8.2 1.6.3 2.5.3 5.5 0 10-3.9 10-8.9S17.5 2 12 2Zm-.1 4.3c-1.6 0-2.8.9-3.1 2.4l1.8.4c.1-.6.6-1 1.3-1 .7 0 1.2.4 1.2 1 0 .5-.3.8-1 1.2-.9.5-1.3 1.1-1.3 2.1v.4h1.8v-.3c0-.4.2-.6.8-1 .9-.5 1.6-1.2 1.6-2.4 0-1.7-1.3-2.8-3.1-2.8Zm-1.2 8.2a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z"
      />
    </Icon>
  );
}
