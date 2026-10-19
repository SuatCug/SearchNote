import { Link } from 'react-router-dom';
import logoIcon from '@/assets/logo.png';

// Uygulama simgesi mobil uygulamayla aynı dosya (proje5 mobil-app/assets/images/logo.png).
// light: koyu (lacivert) arka plan üzerinde; simge kaybolmasın diye ince açık çerçeve, yazı beyaz.
// onClick: karşılama sayfasında logoya basınca en üste kaydırmak için (GuestNavbar).
// iconOnly: sadece simge, "SearchNote" yazısı olmadan (giriş ekranının fotoğraflı sol paneli).
// size: simgenin piksel boyu (varsayılan 36).
export default function Logo({
  light = false,
  iconOnly = false,
  size = 36,
  onClick,
}: {
  light?: boolean;
  iconOnly?: boolean;
  size?: number;
  onClick?: () => void;
}) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2 min-w-0" aria-label="SearchNote home">
      <img
        src={logoIcon}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: light ? size * 0.25 : undefined }}
        className={`shrink-0 ${light ? 'ring-1 ring-white/25' : ''}`}
      />
      {!iconOnly && (
        <span className={`text-lg font-extrabold tracking-tight truncate ${light ? 'text-white' : 'text-gray-900'}`}>
          Search<span className={light ? 'text-sky-300' : 'text-navy-600'}>Note</span>
        </span>
      )}
    </Link>
  );
}
