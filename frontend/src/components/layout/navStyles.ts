// Üst çubuk öğeleri: md'de sadece ikon (40px kare), lg'de ikonun altında küçük etiket (LinkedIn gibi).
export const NAV_ITEM =
  'relative inline-flex h-10 w-10 flex-col items-center justify-center rounded-lg hover:bg-white/10 hover:text-white transition-colors lg:h-16 lg:w-auto lg:min-w-[64px] lg:gap-1 lg:rounded-none lg:px-1 lg:hover:bg-transparent';
export const NAV_LABEL = 'hidden lg:block text-[11px] font-medium leading-none';
// Aktif sayfa çizgisi: md'de çubuğun alt kenarına iner, lg'de öğe zaten çubuk boyunda.
export const NAV_INDICATOR = 'absolute -bottom-3 left-1 right-1 h-[3px] rounded-full bg-white lg:bottom-0';
// Okunmamış sayısı rozeti (ikonun sağ üstü).
export const NAV_BADGE =
  'absolute top-1 left-1/2 ml-0.5 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-navy-800 lg:top-2';
