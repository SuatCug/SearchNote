import { Link } from 'react-router-dom';
import logoIcon from '@/assets/logo.png';

// Uygulama simgesi mobil uygulamayla aynı dosya (proje5 mobil-app/assets/images/logo.png).
// light: koyu (lacivert) arka plan üzerinde; simge kaybolmasın diye ince açık çerçeve, yazı beyaz.
// onClick: karşılama sayfasında logoya basınca en üste kaydırmak için (GuestNavbar).
export default function Logo({ light = false, onClick }: { light?: boolean; onClick?: () => void }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2 min-w-0" aria-label="SearchNote home">
      <img
        src={logoIcon}
        alt=""
        width={36}
        height={36}
        className={`w-9 h-9 shrink-0 ${light ? 'rounded-[9px] ring-1 ring-white/25' : ''}`}
      />
      <span className={`text-lg font-extrabold tracking-tight truncate ${light ? 'text-white' : 'text-gray-900'}`}>
        Search<span className={light ? 'text-sky-300' : 'text-navy-600'}>Note</span>
      </span>
    </Link>
  );
}
