import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Camera, Loader2 } from 'lucide-react';
import { useAppSelector } from '@/app/hooks';
import AuthStep from '@/components/auth/AuthStep';
import Alert from '@/components/common/Alert';
import UserAvatar from '@/components/users/UserAvatar';
import FollowButton from '@/components/users/FollowButton';
import { useGetPeopleToFollowQuery, useUpdateAvatarMutation } from '@/services/usersApi';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { suggestionReason } from '@/lib/suggestionReason';
import type { SuggestedUser } from '@/types/api';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

// Kayıttan sonraki karşılama adımları (mobil uygulamayla aynı, Instagram gibi):
// 1) profil fotoğrafı ekle ya da atla, 2) sınıf arkadaşlarını takip et → ana sayfa.
// Hesap zaten oluştuğu için geri dönülecek form yok (geri butonu yok); adımlar sayfa içinde değişir.
export default function WelcomePage() {
  const [step, setStep] = useState<'photo' | 'people'>('photo');
  return step === 'photo' ? <PhotoStep onNext={() => setStep('people')} /> : <PeopleStep onBack={() => setStep('photo')} />;
}

function PhotoStep({ onNext }: { onNext: () => void }) {
  const user = useAppSelector((state) => state.auth.user);
  const [updateAvatar, { isLoading }] = useUpdateAvatarMutation();
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPhoto = Boolean(user?.avatarUrl);
  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Profile photo can be at most 2 MB.');
      return;
    }
    const formData = new FormData();
    formData.append('avatar', file);
    try {
      await updateAvatar(formData).unwrap();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthStep title="Add a profile photo" subtitle="Add a photo so classmates can recognize you. You can change it anytime.">
      <button
        type="button"
        onClick={pick}
        disabled={isLoading}
        aria-label="Choose a profile photo"
        className="relative mx-auto block rounded-full"
      >
        <UserAvatar user={user} className="!h-40 !w-40 !text-5xl" />
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
            <Loader2 size={32} className="animate-spin text-white" />
          </span>
        )}
        <span className="absolute bottom-1.5 right-1.5 flex h-11 w-11 items-center justify-center rounded-full border-4 border-white bg-navy-800 text-white">
          <Camera size={18} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div className="mt-8 space-y-3">
        <Alert>{error}</Alert>
        {hasPhoto ? (
          <button type="button" onClick={onNext} disabled={isLoading} className="btn-primary w-full py-2.5 text-[15px]">
            Next
          </button>
        ) : (
          <button type="button" onClick={pick} disabled={isLoading} className="btn-primary w-full py-2.5 text-[15px]">
            {isLoading ? 'Uploading...' : 'Add photo'}
          </button>
        )}
        <button
          type="button"
          onClick={hasPhoto ? pick : onNext}
          disabled={isLoading}
          className="mx-auto block py-2 text-[15px] font-semibold text-navy-700 hover:text-navy-800 disabled:opacity-50"
        >
          {hasPhoto ? 'Change photo' : 'Skip'}
        </button>
      </div>
    </AuthStep>
  );
}

// Önce kayıtta seçilen üniversitedeki kişiler (aynı bölümdekiler önde), sonra "Who to follow" önerileri (aynı bölüm, diğer okullar).
// Kimseyi seçmeden de devam edilebilir.
function PeopleStep({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const university = user?.university?.trim() ?? '';
  const classmates = useGetPeopleToFollowQuery({ scope: 'university', limit: 30 }, { skip: !university });
  // "Who to follow" ile aynı öneriler: aynı okul veya aynı bölüm (okuldakiler yukarıda zaten var, kalanlar diğer okullardaki bölüm arkadaşları).
  const suggestions = useGetPeopleToFollowQuery({ scope: 'school', limit: 20 });
  // Liste sunucudan yenilenmez: takip durumu burada tutulur (takip edilen kişi listeden kaybolmasın).
  const [following, setFollowing] = useState<Set<string>>(() => new Set());

  const classmateList = classmates.data?.data?.users ?? [];
  const taken = new Set(classmateList.map((u) => u._id));
  const suggested = (suggestions.data?.data?.users ?? []).filter((u) => u._id !== user?.id && !taken.has(u._id));
  const sections = [
    { key: 'classmates', title: university ? `From ${university}` : 'From your university', users: classmateList },
    { key: 'suggested', title: 'Suggested for you', users: suggested },
  ].filter((s) => s.users.length > 0);
  const loading = classmates.isLoading || suggestions.isLoading;
  const failed = classmates.isError && suggestions.isError;

  const setFollow = (id: string, isFollowing: boolean) =>
    setFollowing((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <AuthStep onBack={onBack} title="Follow your classmates" subtitle="Their notes will show up in your Following feed.">
      <div className="-mx-2 max-h-[min(52vh,460px)] overflow-y-auto overscroll-contain px-2">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-navy-600" />
          </div>
        ) : sections.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-gray-500">
            {failed ? "Couldn't load suggestions." : 'No suggestions yet.'} You can find people later from Search.
          </p>
        ) : (
          sections.map((section) => (
            <section key={section.key} className="mb-3">
              <h2 className="mb-1 mt-2 truncate text-[13px] font-bold uppercase tracking-wide text-gray-500">{section.title}</h2>
              <ul>
                {section.users.map((u) => (
                  <PersonRow
                    key={u._id}
                    user={u}
                    // Okul başlıkta yazdığı için sınıf arkadaşlarında sadece bölüm görünür
                    subtitle={section.key === 'classmates' ? u.department : suggestionReason(u)}
                    isFollowing={following.has(u._id)}
                    onChange={(f) => setFollow(u._id, f)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <button type="button" onClick={() => navigate('/', { replace: true })} className="btn-primary w-full py-2.5 text-[15px]">
          Continue
        </button>
      </div>
    </AuthStep>
  );
}

function PersonRow({
  user,
  subtitle,
  isFollowing,
  onChange,
}: {
  user: SuggestedUser;
  subtitle?: string;
  isFollowing: boolean;
  onChange: (isFollowing: boolean) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2">
      {/* Profil yeni sekmede: karşılama adımı yarıda kalmasın */}
      <Link to={`/users/${user._id}`} target="_blank" className="flex min-w-0 flex-1 items-center gap-3">
        <UserAvatar user={user} size="md" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-gray-900">{user.fullName}</span>
          {subtitle && <span className="block truncate text-xs text-gray-500">{subtitle}</span>}
        </span>
      </Link>
      <FollowButton userId={user._id} name={user.fullName} isFollowing={isFollowing} onChange={onChange} compact />
    </li>
  );
}
