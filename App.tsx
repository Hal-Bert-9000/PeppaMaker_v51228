
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TournamentData, TournamentConfig, Player } from './types';
import { NOMI_DEFAULT } from './constants';
import { generatePlanning, shuffle } from './utils/tournamentLogic';
import SetupView from './components/SetupView';
import PlanningView from './components/PlanningView';
import LiveDashboard from './components/LiveDashboard';
import { Trophy, RefreshCw, Play, PlusCircle, Download, Upload } from 'lucide-react';

const STORAGE_KEY = 'torneo_carte_advanced_v2';

const App: React.FC = () => {
  const [data, setData] = useState<TournamentData | null>(null);
  const [isReshuffling, setIsReshuffling] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Stati per il Long Press
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const res = await fetch('api.php');
        if (!res.ok) throw new Error("API non raggiungibile");
        const serverData = await res.json();
        if (serverData && serverData.status !== 'error') {
          setData(serverData);
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) setData(JSON.parse(saved));
        }
      } catch (e) {
        console.warn("API non disponibile, uso LocalStorage");
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) setData(JSON.parse(saved));
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const saveData = useCallback(async (newData: TournamentData | null) => {
    setData(newData);
    
    if (!newData) {
      localStorage.removeItem(STORAGE_KEY);
      try { 
        await fetch('api.php', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(null) 
        }); 
      } catch(e){
        console.error("Errore reset server", e);
      }
      return;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    try {
      await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
    } catch (e) {
      console.error("Sync error", e);
    }
  }, []);

  const handleStartTournament = (config: TournamentConfig, customNames: string[], tournamentName: string) => {
    const basePlayers: Player[] = Array.from({ length: config.numGiocatori }).map((_, i) => ({
      id: `p${i}`,
      name: customNames[i] || NOMI_DEFAULT[i] || `Giocatore ${i + 1}`,
      isEliminated: false
    }));

    const players = shuffle(basePlayers);
    const { planning, relazioni } = generatePlanning(config, players);

    const initialData: TournamentData = {
      tournamentName,
      config,
      giocatori: players,
      punteggi: Object.fromEntries(players.map(p => [p.id, 0])),
      storicoPunteggi: Object.fromEntries(players.map(p => [p.id, [0]])),
      manoAttuale: 1,
      planningCompleto: planning,
      status: 'planning',
      storicoRelazioni: relazioni,
      cappotti: [],
      rotationPattern: 'DS-C'
    };
    saveData(initialData);
  };

  const reshufflePlanning = () => {
    if (!data) return;
    setIsReshuffling(true);
    setTimeout(() => {
      const players: Player[] = shuffle(data.giocatori);
      const { planning, relazioni } = generatePlanning(data.config, players);
      saveData({ ...data, giocatori: players, planningCompleto: planning, storicoRelazioni: relazioni });
      setIsReshuffling(false);
    }, 400);
  };

  const handleResetTournament = () => {
    setData(null);
    localStorage.removeItem(STORAGE_KEY);
    fetch('api.php', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null) 
    }).catch(console.error);
  };

  const exportTournament = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    a.href = url;
    a.download = `Torneo_Peppa_Export_${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (importedData && importedData.config && importedData.giocatori) {
          saveData(importedData);
        } else {
          alert("File non valido: mancano dati strutturali del torneo.");
        }
      } catch (err) {
        alert("Errore nella lettura del file JSON.");
      }
    };
    reader.readAsText(file);
    if (e.target) e.target.value = ''; // Reset input
  };

  const startHold = () => {
    const startTime = Date.now();
    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / 3000) * 100, 100);
      setHoldProgress(progress);
      if (progress >= 100) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        handleResetTournament();
        setHoldProgress(0);
      }
    }, 50);
  };

  const stopHold = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    holdTimerRef.current = null;
    setHoldProgress(0);
  };

  const handleShortClickReset = () => {
    if (window.confirm("Vuoi iniziare un nuovo torneo? Tutti i dati correnti saranno persi.")) {
      handleResetTournament();
    }
  };

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" /></div>;

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
        <header className="mb-8 text-center animate-in">
          <div className="flex justify-center mb-4">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-800 transition shadow-lg"
            >
              <Upload className="w-3.5 h-3.5" /> Importa Torneo Salvato
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
          </div>
          <Trophy className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
          <h1 className="text-6xl font-light text-white mb-1 tracking-tight">PeppaMaker</h1>
          <p className="text-slate-400 font-medium tracking-widest text-xs uppercase">LA PRECISIONE IN OGNI MANO</p>
          <p className="text-slate-100 font-small tracking-widest text-xs uppercase">V.51229</p>
        </header>
        <main className="max-w-4xl mx-auto"><SetupView onStart={handleStartTournament} /></main>
      </div>
    );
  }

  // Calcola quante mani di recupero ci sono nel planning
  const recoveryHandsCount = data.planningCompleto.filter(h => h.fase === 'recupero').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-1.5 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-emerald-500 w-4 h-4" />
            <span className="font-bold tracking-tight text-xs sm:text-sm text-white whitespace-nowrap">{data.tournamentName}</span>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-[9px] text-slate-500 font-black uppercase tracking-wider">
            <span className="bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">{data.config.numGiocatori} Giocatori</span>
            <span className="bg-rose-900/30 px-2 py-0.5 rounded border border-rose-800/50 text-rose-400">
              {data.config.numEliminatiDopoFase1} Eliminati
            </span>
            <span className="bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700/50">
                {data.config.maniFase1}
                {recoveryHandsCount > 0 ? `+${recoveryHandsCount}` : ''}
                +{data.config.maniFase2} Mani
            </span>
          </div>
        </div>
        
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1 rounded-full font-bold transition text-[9px] border border-slate-700"
            title="Importa Torneo (.json)"
          >
            <Upload className="w-2.5 h-2.5" /> Importa
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImportFile} className="hidden" accept=".json" />
          
          <button 
            onClick={exportTournament}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1 rounded-full font-bold transition text-[9px] border border-slate-700"
            title="Esporta Torneo (.json)"
          >
            <Download className="w-2.5 h-2.5" /> Esporta
          </button>

          <button 
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={startHold}
            onTouchEnd={stopHold}
            onClick={handleShortClickReset}
            className="relative overflow-hidden flex items-center gap-1.5 bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 px-4 py-1 rounded-full font-bold transition text-[9px] border border-rose-900/30"
          >
            <div 
              className="absolute left-0 top-0 h-full bg-rose-500/30 pointer-events-none transition-all duration-75"
              style={{ width: `${holdProgress}%` }}
            />
            <span className="relative z-10 flex items-center gap-1.5">
              <PlusCircle className="w-2.5 h-2.5" /> 
              Nuovo Torneo
            </span>
          </button>

          {data.status === 'planning' && (
            <button 
              onClick={reshufflePlanning} 
              disabled={isReshuffling}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-full font-bold transition text-[9px] border border-slate-700"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${isReshuffling ? 'animate-spin' : ''}`} /> 
              Rimescola
            </button>
          )}
          {data.status === 'planning' && (
            <button 
              onClick={() => saveData({...data, status: 'live'})} 
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-full font-bold transition shadow-lg text-[9px]"
            >
              <Play className="w-2.5 h-2.5 fill-current" /> Inizia
            </button>
          )}
        </div>
      </nav>
      <main className="max-w-[1800px] mx-auto px-4 py-2 sm:px-6">
        {data.status === 'planning' ? <PlanningView data={data} onUpdateData={saveData} /> : <LiveDashboard data={data} setData={saveData} />}
      </main>
    </div>
  );
};

export default App;
