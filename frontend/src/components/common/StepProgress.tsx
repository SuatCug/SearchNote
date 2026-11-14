import { useEffect, useState, type ReactNode } from 'react';
import { Check, Loader2 } from 'lucide-react';

export interface ProgressStep {
  label: string;
  // Adımın başladığı an (ms, bekleme başladıktan sonra).
  at: number;
}

// Yapay zekâ beklemelerinde (Ask cevabı, quiz / flashcard üretimi) dönen çubuk yerine adım listesi.
// İstekler tek parça olduğu için adımlar arası geçiş gerçek ilerlemeye değil tahmini sürelere göre değişir;
// son adım iş bitene kadar açık kalır. children: adımların altında gelecek içeriğin iskeleti.
// Her yeni beklemede sayaç sıfırlansın diye çağıran taraf key vermeli.
export default function StepProgress({
  steps,
  slowAfterMs,
  slowText = 'This is taking a little longer than usual. Hang on…',
  note,
  children,
  className = '',
}: {
  steps: ProgressStep[];
  slowAfterMs?: number;
  slowText?: string;
  // Adımların altında küçük açıklama (ör. "The first time takes about 15 seconds.").
  note?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setElapsed(Date.now() - start), 250);
    return () => window.clearInterval(id);
  }, []);

  const current = steps.reduce((last, step, i) => (elapsed >= step.at ? i : last), 0);

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
