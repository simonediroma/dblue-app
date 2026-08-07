import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { ChevronLeft, CheckCircle2, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { checkDblueOfficeCompliance } from '../services/api';
import type { DblueOfficeComplianceResult } from '../services/api';

interface DblueOfficeComplianceCheckProps {
  onBack: () => void;
}

type State =
  | { status: 'loading' }
  | { status: 'done'; results: DblueOfficeComplianceResult[] }
  | { status: 'error'; message: string };

export default function DblueOfficeComplianceCheck({ onBack }: DblueOfficeComplianceCheckProps) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const runCheck = () => {
    setState({ status: 'loading' });
    checkDblueOfficeCompliance()
      .then((results) => setState({ status: 'done', results }))
      .catch((err) => setState({ status: 'error', message: (err as Error).message }));
  };

  useEffect(() => {
    runCheck();
  }, []);

  return createPortal(
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="fixed inset-0 bg-surface z-[200] flex flex-col font-sans">
      <header className="px-6 py-4 bg-surface-container-lowest border-b border-outline-variant/10 flex items-center gap-4 shadow-sm">
        <button onClick={onBack} aria-label="Back" className="p-2 hover:bg-surface-container rounded-full transition-colors shrink-0">
          <ChevronLeft className="w-5 h-5 text-on-surface" />
        </button>
        <div className="flex-grow">
          <h1 className="font-headline text-lg font-bold text-on-surface">Compliance account dblue-office</h1>
          <p className="text-xs text-on-surface-variant">
            Chiama /booking-app/session per i 6 account di test — confronta il ruolo ricevuto con quello atteso e controlla la coerenza di stanze/categorie/chiusure
          </p>
        </div>
        <button
          onClick={runCheck}
          disabled={state.status === 'loading'}
          aria-label="Verifica di nuovo"
          className="p-2 bg-primary/10 hover:bg-primary/20 disabled:opacity-50 rounded-full transition-colors text-primary"
        >
          <RefreshCw className={`w-5 h-5 ${state.status === 'loading' ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-grow overflow-y-auto p-6 space-y-3 max-w-2xl mx-auto w-full pb-24">
        {state.status === 'loading' && (
          <p className="text-sm text-on-surface-variant">Verifica in corso...</p>
        )}

        {state.status === 'error' && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl">
            <p className="text-xs font-medium text-red-700">{state.message}</p>
          </div>
        )}

        {state.status === 'done' && (() => {
          const totalIssues = state.results.reduce((sum, r) => sum + r.sanityIssues.length, 0);
          if (totalIssues === 0) return null;
          return (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-amber-800">
                {totalIssues} problema/i di coerenza dati rilevati — vedi il dettaglio per account qui sotto.
              </p>
            </div>
          );
        })()}

        {state.status === 'done' &&
          state.results.map((r) => (
            <div
              key={r.email}
              className={`bg-surface-container-lowest rounded-2xl p-4 border flex items-start gap-3 ${
                r.compliant ? 'border-green-500/30' : 'border-red-500/30'
              }`}
            >
              {r.compliant ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              )}
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="font-bold text-sm text-on-surface truncate">{r.email}</span>
                <span className="text-xs text-on-surface-variant">
                  Atteso: <span className="font-mono">{r.expectedRole}</span>
                  {' · '}
                  Ricevuto: <span className="font-mono">{r.actualRole ?? '—'}</span>
                </span>
                {r.error && <span className="text-xs text-red-600">{r.error}</span>}

                {r.url && (
                  <span className="text-[11px] text-on-surface-variant/70 break-all">
                    <span className="font-bold">URL:</span> <span className="font-mono">{r.url}</span>
                  </span>
                )}
                {r.requestHeaders.length > 0 && (
                  <span className="text-[11px] text-on-surface-variant/70">
                    <span className="font-bold">Header inviati:</span>{' '}
                    <span className="font-mono">{r.requestHeaders.join(', ')}</span>{' '}
                    <span className="italic">(solo nome, mai il valore)</span>
                  </span>
                )}

                {r.sanityIssues.length > 0 && (
                  <div className="mt-1 bg-amber-50 border border-amber-200 rounded-lg p-2 flex flex-col gap-1">
                    <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {r.sanityIssues.length} problema/i nei dati stanze/categorie/chiusure
                    </span>
                    <ul className="list-disc list-inside">
                      {r.sanityIssues.map((issue, idx) => (
                        <li key={idx} className="text-[11px] text-amber-800">
                          <span className="font-mono">{issue.field}</span>: {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.rawResponse != null && (
                  <details className="mt-1">
                    <summary className="text-[11px] font-bold text-primary cursor-pointer select-none">
                      Mostra risposta completa
                    </summary>
                    <pre className="mt-1 text-[10px] leading-snug bg-surface-container rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(r.rawResponse, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
      </main>
    </motion.div>,
    document.body
  );
}
