import { useId, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Loader2, Search, X } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import UserAvatar from '@/components/users/UserAvatar';
import { useSearchUsersQuery } from '@/services/usersApi';
import { useGetNotesQuery } from '@/services/notesApi';
import { useDebounce } from '@/hooks/useDebounce';
import { FILE_TYPES } from '@/lib/constants';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  recentKey,
  removeRecentSearch,
  type RecentSearch,
} from '@/lib/recentSearches';
import type { NoteCard } from '@/types/api';

const MIN_QUERY = 2;
const PEOPLE_LIMIT = 4;
const NOTES_LIMIT = 5;
const COURSES_LIMIT = 3;

// Açılır listedeki satırlar: klavyeyle gezinmek için tek düz listede tutulur.
type Option =
  | { kind: 'search'; q: string }
  | { kind: 'recent'; item: RecentSearch }
  | { kind: 'user'; id: string; fullName: string; avatarUrl?: string; subtitle: string }
  | { kind: 'course'; code: string; name: string }
  | { kind: 'note'; id: string; title: string; subtitle: string; fileType: NoteCard['fileType'] };

interface SearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  // Metin araması (Enter / "Search for ..." satırı / son aramalardan bir kelime).
  onSearch: (q: string) => void;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

// Üst çubuktaki arama kutusu: odaklanınca son aramalar, yazarken kişi / ders / not önerileri açılır
// (LinkedIn, Facebook, Reddit gibi). Ok tuşlarıyla gezilir, Enter seçer, Esc kapatır.
export default function SearchBox({ value, onChange, onSearch, placeholder, inputRef }: SearchBoxProps) {
  const navigate = useNavigate();
  const userId = useAppSelector((state) => state.auth.user?.id) ?? '';
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  const trimmed = value.trim();
  const debounced = useDebounce(trimmed, 250);
  const searching = debounced.length >= MIN_QUERY;
  const skip = !open || !searching;
  const people = useSearchUsersQuery({ q: debounced, limit: PEOPLE_LIMIT }, { skip });
  const notes = useGetNotesQuery({ q: debounced, limit: NOTES_LIMIT }, { skip });
  const loading = searching && (people.isFetching || notes.isFetching);

  const noteItems = notes.data?.data?.items ?? [];
  // Bulunan notların dersleri (tekrarsız): bu ders koduyla filtrelenmiş akışa gider.
  const courses = [...new Map(noteItems.flatMap((n) => (n.courseCode ? [[n.courseCode, n.courseName] as const] : []))).entries()]
    .slice(0, COURSES_LIMIT)
    .map(([code, name]) => ({ code, name }));

  const options: Option[] =
    trimmed.length >= MIN_QUERY
      ? [
          { kind: 'search', q: trimmed },
          ...(searching
            ? [
                ...(people.data?.data?.users ?? []).map(
                  (u): Option => ({
                    kind: 'user',
                    id: u._id,
                    fullName: u.fullName,
                    avatarUrl: u.avatarUrl,
                    subtitle: [u.university, u.department].filter(Boolean).join(' · '),
                  })
                ),
                ...courses.map((c): Option => ({ kind: 'course', ...c })),
                ...noteItems.map(
                  (n): Option => ({
                    kind: 'note',
                    id: n._id,
                    title: n.title,
                    subtitle: [n.courseCode, n.author?.fullName].filter(Boolean).join(' · '),
                    fileType: n.fileType,
                  })
                ),
              ]
            : []),
        ]
      : recent.map((item): Option => ({ kind: 'recent', item }));

  const openList = () => {
    setRecent(loadRecentSearches(userId));
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const finish = () => {
    close();
    inputRef?.current?.blur();
  };

  const runQuery = (q: string) => {
    if (q) addRecentSearch(userId, { type: 'query', q });
    onChange(q);
    onSearch(q);
    finish();
  };

  const choose = (option: Option) => {
    switch (option.kind) {
      case 'search':
        return runQuery(option.q);
      case 'recent': {
        const { item } = option;
        addRecentSearch(userId, item);
        if (item.type === 'query') return runQuery(item.q);
        navigate(item.type === 'user' ? `/users/${item.id}` : `/notes/${item.id}`);
        return finish();
      }
      case 'user':
        addRecentSearch(userId, { type: 'user', id: option.id, fullName: option.fullName, avatarUrl: option.avatarUrl, subtitle: option.subtitle });
        navigate(`/users/${option.id}`);
        onChange('');
        return finish();
      case 'course':
        addRecentSearch(userId, { type: 'query', q: option.code });
        navigate(`/?courseCode=${encodeURIComponent(option.code)}`);
        onChange('');
        return finish();
      case 'note':
        addRecentSearch(userId, { type: 'note', id: option.id, title: option.title, subtitle: option.subtitle });
        navigate(`/notes/${option.id}`);
        onChange('');
        return finish();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finish();
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      openList();
      return;
    }
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      const option = options[active];
      if (open && option) choose(option);
      else runQuery(trimmed);
    }
  };

  const showPanel = open && (options.length > 0 || trimmed.length < MIN_QUERY);
  const sectionStart = (i: number) => options[i - 1]?.kind !== options[i].kind;

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) close();
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search notes and people</span>
        <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          maxLength={100}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setActive(-1);
            if (!open) openList();
          }}
          onFocus={openList}
          onClick={() => !open && openList()}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-white/10 pl-10 pr-10 py-2.5 [&::-webkit-search-cancel-button]:appearance-none text-sm text-white placeholder-white/60 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
        />
        {loading ? (
          <Loader2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-white/60" />
        ) : (
          // Tarayıcının mavi "×"i yerine koyu zemine uyan temizleme düğmesi.
          value && (
            <button
              type="button"
              aria-label="Clear search"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange('');
                setActive(-1);
                inputRef?.current?.focus();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
            </button>
          )
        )}
      </label>

      {showPanel && (
        // Satıra basınca odak kutudan gitmesin (yoksa liste tıklama işlenmeden kapanır).
        <div
          className="absolute inset-x-0 top-full z-[56] mt-1.5 max-h-[min(60vh,380px)] overflow-y-auto overscroll-contain rounded-lg border border-gray-100 bg-white py-1.5 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {trimmed.length < MIN_QUERY && (
            <div className="flex items-center justify-between px-3 pb-0.5 pt-0.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Recent</p>
              {recent.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    clearRecentSearches(userId);
                    setRecent([]);
                  }}
                  className="text-xs font-semibold text-navy-600 hover:text-navy-800"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
          {trimmed.length < MIN_QUERY && recent.length === 0 && (
            <p className="px-3 py-1.5 text-[13px] text-gray-500">Your recent searches will show up here.</p>
          )}

          <ul id={listId} role="listbox" aria-label="Search suggestions">
            {options.map((option, i) => (
              <li key={optionKey(option)} role="presentation">
                {option.kind !== 'search' && option.kind !== 'recent' && sectionStart(i) && (
                  <p className="px-3 pb-0.5 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">{SECTION_TITLES[option.kind]}</p>
                )}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onClick={() => choose(option)}
                  onMouseMove={() => active !== i && setActive(i)}
                  className={`group flex cursor-pointer items-center gap-2.5 px-3 ${option.kind === 'recent' ? 'py-1' : 'py-1.5'} ${
                    active === i ? 'bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <OptionContent option={option} />
                  {option.kind === 'recent' && (
                    <button
                      type="button"
                      aria-label="Remove from recent searches"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecent(removeRecentSearch(userId, recentKey(option.item)));
                        setActive(-1);
                      }}
                      className="ml-auto shrink-0 rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {searching && !loading && options.length === 1 && (
            <p className="px-3 py-2 text-[13px] text-gray-500">No people or notes match "{debounced}".</p>
          )}
        </div>
      )}
    </div>
  );
}

const SECTION_TITLES = { user: 'People', course: 'Courses', note: 'Notes' } as const;

function optionKey(option: Option) {
  switch (option.kind) {
    case 'search':
      return 'search';
    case 'recent':
      return `recent-${recentKey(option.item)}`;
    case 'course':
      return `course-${option.code}`;
    default:
      return `${option.kind}-${option.id}`;
  }
}

function Row({ icon, title, subtitle }: { icon: ReactNode; title: ReactNode; subtitle?: string }) {
  return (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-gray-900">{title}</span>
        {subtitle && <span className="block truncate text-[11px] text-gray-500">{subtitle}</span>}
      </span>
    </>
  );
}

const roundIcon = 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full';

function OptionContent({ option }: { option: Option }) {
  switch (option.kind) {
    case 'search':
      return (
        <Row
          icon={
            <span className={`${roundIcon} bg-navy-50 text-navy-600`}>
              <Search size={14} />
            </span>
          }
          title={
            <>
              Search for <span className="text-navy-700">"{option.q}"</span>
            </>
          }
        />
      );
    case 'user':
      return <Row icon={<UserAvatar user={{ fullName: option.fullName, avatarUrl: option.avatarUrl }} className="!h-7 !w-7 !text-[10px]" size="sm" />} title={option.fullName} subtitle={option.subtitle} />;
    case 'course':
      return (
        <Row
          icon={
            <span className={`${roundIcon} bg-navy-50 text-navy-600`}>
              <BookOpen size={14} />
            </span>
          }
          title={option.code}
          subtitle={option.name !== option.code ? option.name : undefined}
        />
      );
    case 'note': {
      const { icon: Icon, badge } = FILE_TYPES[option.fileType] ?? FILE_TYPES.pdf;
      return (
        <Row
          icon={
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${badge}`}>
              <Icon size={14} />
            </span>
          }
          title={option.title}
          subtitle={option.subtitle}
        />
      );
    }
    // Son aramalar sade tek satır: küçük ikon + metin (alt satır yok).
    case 'recent': {
      const { item } = option;
      const icon =
        item.type === 'user' ? (
          <UserAvatar user={{ fullName: item.fullName, avatarUrl: item.avatarUrl }} size="xs" />
        ) : item.type === 'note' ? (
          <BookOpen size={15} className="mx-[5px] shrink-0 text-gray-400" />
        ) : (
          <Clock size={15} className="mx-[5px] shrink-0 text-gray-400" />
        );
      return (
        <>
          {icon}
          <span className="min-w-0 flex-1 truncate text-[13px] text-gray-700">
            {item.type === 'user' ? item.fullName : item.type === 'note' ? item.title : item.q}
          </span>
        </>
      );
    }
  }
}
