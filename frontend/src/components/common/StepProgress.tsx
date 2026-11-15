import { useEffect, useState, type ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface ProgressStep {
  label: string;
  // Adımın başladığı an (ms, bekleme başladıktan sonra).
  at: number;
}

// Bitişte kalan her adım bu kadar arayla tamamlandı işaretlenir; hepsi bitince bu kadar bekleyip onDone çağrılır.
const FINISH_STEP_MS = 220;
const FINISH_HOLD_MS = 300;

// Yapay zekâ beklemelerinde (Ask cevabı, quiz / flashcard üretimi) dönen çubuk yerine adım listesi.
// İstekler tek parça olduğu için adımlar arası geçiş gerçek ilerlemeye değil tahmini sürelere göre değişir;
// son adım iş bitene kadar açık kalır. children: adımların altında gelecek içeriğin iskeleti.
// finished + onDone verilirse: iş tahminden önce biterse ekran ilk adımlardayken birden içeriğe atlamaz; kalan
// adımlar hızlıca tek tek tamamlanır, sonra onDone çağrılır (çağıran o zaman içeriği gösterir).
// Her yeni beklemede sayaç sıfırlansın diye çağıran taraf key vermeli.
export default function StepProgress({
  steps,
  slowAfterMs,
  slowText = 'This is taking a little longer than usual. Hang on…',
  note,
  children,
  className = '',
  finished = false,
  onDone,
}: {
  steps: ProgressStep[];
  slowAfterMs?: number;
  slowText?: string;
  // Adımların altında küçük açıklama (ör. "The first time takes about 15 seconds.").
  note?: ReactNode;
  children?: ReactNode;
  className?: string;
  finished?: boolean;
  onDone?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 100);
    return () => window.clearInterval(id);
  }, []);

  const timedStep = steps.reduce((last, step, i) => (elapsed >= step.at ? i : last), 0);
  // İş bittiği an: o anki adım ve süre (kalan adımlar buradan itibaren hızlıca tamamlanır).
  const [finish, setFinish] = useState<{ at: number; from: number } | null>(null);
  if (finished && !finish) setFinish({ at: elapsed, from: timedStep });
  // current === steps.length: hepsi tamamlandı.
  const current = finish
    ? Math.min(steps.length, finish.from + 1 + Math.floor((elapsed - finish.at) / FINISH_STEP_MS))
    : timedStep;
  const allDone = current >= steps.length;
  useEffect(() => {
    if (!allDone || !onDone) return;
    const id = window.setTimeout(onDone, FINISH_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [allDone, onDone]);

  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{steps[current]?.label}…</span>
      <div aria-hidden="true">
        <ol className="space-y-2.5">
          {steps.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <li
                key={step.label}
                className={`flex items-center gap-2.5 text-sm transition-colors ${
                  done ? 'text-gray-500' : active ? 'font-semibold text-gray-900' : 'text-gray-400'
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  {done ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check size={13} strokeWidth={3} />
                    </span>
                  ) : active ? (
                    <Loader2 size={17} className="animate-spin text-navy-600" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />
                  )}
                </span>
                {step.label}
                {active && '…'}
              </li>
            );
          })}
        </ol>
        {note && <p className="mt-3 text-xs text-gray-400">{note}</p>}
        {children}
      </div>
      {slowAfterMs !== undefined && elapsed >= slowAfterMs && (
        <p className="mt-4 text-center text-sm text-gray-500">{slowText}</p>
      )}
    </div>
  );
}
