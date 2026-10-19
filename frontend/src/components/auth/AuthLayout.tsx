import type { ReactNode } from 'react';
import { Download, GraduationCap, Heart, Search } from 'lucide-react';
import Logo from '@/components/layout/Logo';
import { REQUIRE_EDU_EMAIL } from '@/lib/constants';

const FEATURES = [
  {
    icon: GraduationCap,
    text: REQUIRE_EDU_EMAIL ? 'Only students with .edu.tr accounts' : 'Note sharing for university students',
  },
  { icon: Download, text: 'No credits, no points — unlimited free downloads' },
  { icon: Search, text: 'Search by university, department, course and instructor' },
  { icon: Heart, text: 'Like, comment and follow your classmates' },
];

// Auth ekranları (Login/Register/Verify) için ortak iki panelli yerleşim.
// Solda tanıtım paneli, sağda form paneli.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen lg:h-screen grid lg:grid-cols-2 bg-white">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-navy-800 via-navy-800 to-navy-900 p-12 text-white">
        <div>
          <Logo light />
        </div>
        <div>
          <h2 className="text-4xl font-bold leading-tight">
            Search any note,
            <br />
            share your own.
          </h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-navy-50">
                <span className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-navy-200">By students, for students. Free.</p>
      </div>

      <div className="flex items-center justify-center px-6 py-8 overflow-y-auto">
        {/* 400px: Google butonu en fazla bu genişlikte çizilir; form alanları ve butonlar onunla aynı boyda olsun. */}
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
