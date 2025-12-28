
import React, { useState, useEffect } from 'react';
import { TournamentConfig } from '../types';
import { AlertTriangle, CheckCircle2, UserPlus, FlaskConical, Dices, Info, Zap } from 'lucide-react';

interface SetupViewProps {
  onStart: (config: TournamentConfig, customNames: string[]) => void;
}

const SetupView: React.FC<SetupViewProps> = ({ onStart }) => {
  const [numGiocatori, setNumGiocatori] = useState(21);
  const [maniFase1, setManiFase1] = useState(8);
  const [maniFase2, setManiFase2] = useState(4);
  const [numEliminati, setNumEliminati] = useState(1);
  const [nomiGiocatori, setNomiGiocatori] = useState('');
  const [testMode, setTestMode] = useState(false);

  const calcolaManiSocialConsigliate = (n: number) => {
    const r = n % 4;
    if (r === 0) return 8; 

    let bestH = 10;
    let minCost = 999;

    for (let h = 5; h <= 16; h++) {
      const s = (h * r) % n; 
      
      let cost = 0;
      if (s === 0) {
        cost = 0; 
      } else if (s % 4 === 0) {
        cost = 1; 
      } else {
        cost = 2; 
      }

      if (cost < minCost) {
        minCost = cost;
        bestH = h;
      } else if (cost === minCost) {
        if (Math.abs(h - 10) < Math.abs(bestH - 10)) {
          bestH = h;
        }
      }
    }
    return bestH;
  };

  // Only set initial default for numEliminati when numGiocatori is first loaded or changed if user hasn't touched it, 
  // but let's just make it a soft suggestion rather than a hard effect that overrides user choice.
  useEffect(() => {
    const consigliate = calcolaManiSocialConsigliate(numGiocatori);
    setManiFase1(consigliate);
  }, [numGiocatori]);

  useEffect(() => {
    const rimanenti = numGiocatori - numEliminati;
    if (rimanenti > 0) {
      setManiFase2(Math.max(3, Math.floor(rimanenti / 2)));
    }
  }, [numGiocatori, numEliminati]);

  const riposantiFase1 = numGiocatori % 4;
  const s = (maniFase1 * riposantiFase1) % numGiocatori;
  const isSocialBalanced = s === 0;
  
  let recoveryHandsEstimate = 0;
  if (s !== 0) {
    recoveryHandsEstimate = (s % 4 === 0) ? 1 : 2;
  }
  const serveRecupero = recoveryHandsEstimate > 0;
  const totalMani = maniFase1 + recoveryHandsEstimate + maniFase2;

  const rimanenti = numGiocatori - numEliminati;

  const generaNomiCasuali = () => {
    const nomiEsempio = ["Tommaso", "Alberto", "Marcello", "Gattoni", "Matteo", "Stefano", "Diego", "Manuela", "Rebecca", "Janik", "Mariluz", "Lea", "Luigi", "Karl", "Mara", "Sofia", "Ilai", "Mirella", "Carolina", "Sebba", "Dibba", "Elena", "André", "Dario", "Sara", "Claudio", "Cate Lev", "BIC", "Barbara", "Arianna", "Sergio", "Silvia"];
    let nuoviNomi = [];
    for (let i = 0; i < numGiocatori; i++) {
      nuoviNomi.push(nomiEsempio[i] || `Giocatore ${i+1}`);
    }
    nuoviNomi.sort(() => Math.random() - 0.5);
    setNomiGiocatori(nuoviNomi.join('\n'));
  };

  const handleStart = () => {
    const names = nomiGiocatori.split('\n').map(s => s.trim()).filter(s => s);
    if (names.length > 0 && names.length !== numGiocatori) {
      alert(`Hai inserito ${names.length} nomi, ma il numero di giocatori impostato è ${numGiocatori}.`);
      return;
    }
    if (rimanenti < 4) {
      alert("Devono rimanere almeno 4 giocatori per la fase finale.");
      return;
    }
    
    onStart({
      numGiocatori,
      maniFase1,
      maniFase2,
      numEliminatiDopoFase1: numEliminati,
      testMode
    }, names);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in duration-300">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2 uppercase tracking-tight">
          <UserPlus className="text-emerald-500" /> Setup Torneo
        </h2>
        <div className="flex items-center gap-3 bg-slate-900/50 px-4 py-2 rounded-xl border border-slate-700">
          <FlaskConical className={`w-5 h-5 ${testMode ? 'text-yellow-400' : 'text-slate-600'}`} />
          <span className="text-xs font-bold text-slate-400 uppercase">Test Mode</span>
          <button 
            onClick={() => setTestMode(!testMode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${testMode ? 'bg-yellow-500' : 'bg-slate-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${testMode ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLONNA SINISTRA: Impostazioni */}
        <div className="flex flex-col gap-4">
          <div className="bg-slate-900/50 p-5 rounded-xl border border-slate-700 space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Giocatori</label>
                  <input type="number" max="40" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-black text-lg focus:border-emerald-500 outline-none" value={numGiocatori} onChange={e => setNumGiocatori(Number(e.target.value))}/>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Eliminati</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-black text-lg focus:border-emerald-500 outline-none" value={numEliminati} onChange={e => setNumEliminati(Number(e.target.value))}/>
                </div>
            </div>

            <div className="pt-2">
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Mani Fase Social (Consigliate: {calcolaManiSocialConsigliate(numGiocatori)})</label>
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-black text-lg focus:border-emerald-500 outline-none" value={maniFase1} onChange={e => setManiFase1(Number(e.target.value))}/>
              <div className="mt-2 flex items-center justify-between">
                {isSocialBalanced ? (
                  <span className="text-[10px] text-emerald-500 flex items-center gap-1 font-black uppercase"><CheckCircle2 className="w-3 h-3"/> Riposi Bilanciati</span>
                ) : (
                  <span className="text-[10px] text-amber-500 flex items-center gap-1 font-black uppercase">
                    <AlertTriangle className="w-3 h-3"/> {recoveryHandsEstimate === 1 ? '1 mano recupero' : 'Recupero complesso'}
                  </span>
                )}
                <span className="text-[10px] text-slate-500 uppercase font-black">Passano: <span className="text-emerald-500">{rimanenti}</span></span>
              </div>
            </div>

            {serveRecupero && (
              <div className="bg-amber-900/20 border border-amber-900/30 p-3 rounded-xl animate-pulse">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Recupero stimato: {recoveryHandsEstimate} {recoveryHandsEstimate === 1 ? 'mano' : 'mani'}</span>
                </div>
                <p className="text-[9px] text-amber-200/60 leading-tight uppercase font-medium">
                  Pareggio automatico dei riposi prima della Fase Top.
                </p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase mb-1">Mani Fase Finale (TOP)</label>
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-black text-lg focus:border-emerald-500 outline-none" value={maniFase2} onChange={e => setManiFase2(Number(e.target.value))}/>
              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500 font-black uppercase">
                <Info className="w-3 h-3" /> 
                Gareggeranno {rimanenti} giocatori ({Math.floor(rimanenti/4)} tavoli)
              </div>
            </div>
          </div>
        </div>

        {/* COLONNA DESTRA: Lista Giocatori */}
        <div className="space-y-4">
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Lista Giocatori</label>
            <button 
              onClick={generaNomiCasuali}
              className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-500 hover:text-emerald-400 transition"
            >
              <Dices className="w-3.5 h-3.5" /> Genera Nomi
            </button>
          </div>
          <textarea 
            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-100 h-64 focus:ring-1 focus:ring-emerald-500 outline-none transition scrollbar-thin scrollbar-thumb-slate-700"
            placeholder="Uno per riga..."
            value={nomiGiocatori}
            onChange={(e) => setNomiGiocatori(e.target.value)}
          />
        </div>
      </div>

      <button onClick={handleStart} className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-2">
        Crea Torneo ({totalMani} Mani)
      </button>
    </div>
  );
};

export default SetupView;
