import Link from 'next/link'
import { Activity, ChevronLeft, CheckCircle2 } from 'lucide-react'
import UploadCSV from '@/components/UploadCSV'

export default function UploadPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#080808]">
      {/* Header */}
      <header className="bg-[#080808]/80 backdrop-blur-xl border-b border-white/[0.06] px-4 py-3 flex items-center gap-4">
        <Link
          href="/"
          className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-500" />
          <h1 className="text-lg font-black tracking-widest text-white uppercase">PULSE</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">Importera transaktioner</h2>
            <p className="text-zinc-500 text-sm">
              Ladda upp din Swedbank CSV-export så analyserar Pulse dina utgifter.
            </p>
          </div>

          <UploadCSV />

          <div className="mt-8 bg-[#0f0f0f] border border-white/[0.08] rounded-2xl p-5">
            <h3 className="text-[11px] font-semibold tracking-[0.1em] uppercase text-zinc-500 mb-4">
              Hur exporterar jag från Swedbank?
            </h3>
            <ol className="text-sm text-zinc-400 space-y-3">
              {[
                'Logga in på Swedbank Internet Banking',
                'Gå till ditt konto → Transaktioner',
                'Välj period och klicka "Exportera"',
                'Välj format: CSV (semikolonavgränsat)',
                'Ladda upp filen här',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500/60 mt-0.5 shrink-0" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  )
}
