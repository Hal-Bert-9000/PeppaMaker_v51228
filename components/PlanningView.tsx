
import React, { useState, useMemo } from 'react';
import { TournamentData, TableScore, HandAssignment } from '../types';
import { RefreshCcw, Zap, Target, Lock, BarChart3, X, Coffee, PlayCircle, TrendingUp, ChevronUp, ChevronDown, Activity, Download, ArrowUpDown, Trophy } from 'lucide-react';

interface PlanningViewProps {
  data: TournamentData;
  showScores?: boolean;
  currentHandScores?: Record<number, TableScore>;
  onUpdateData?: (data: TournamentData) => void;
  forceStats?: boolean;
}

type SortKey = 'name' | 'score' | 'playCount' | 'restCount' | 'avg' | 'max' | 'min' | 'positiveCount' | 'maxStreak' | 'cappottiCount';

const PlanningView: React.FC<PlanningViewProps> = ({ data, showScores = false, currentHandScores = {}, onUpdateData, forceStats = false }) => {
  const [localShowStats, setLocalShowStats] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, dir: 'asc' | 'desc' }>({ key: 'score', dir: 'desc' });
  const rotationPattern = data.rotationPattern || 'DS-C';
  
  const showStats = forceStats || localShowStats;

  const maxTavoli = data.planningCompleto.length > 0 
    ? Math.max(...data.planningCompleto.map(m => m.fase === 'top' ? Math.floor(data.giocatori.filter(p => !p.isEliminated).length / 4) : m.tavoli.length), Math.floor(data.config.numGiocatori / 4)) 
    : Math.floor(data.config.numGiocatori / 4);

  const checkIsRealCapStatic = (pid: string, manoNum: number, currentData: TournamentData): boolean => {
    const manoData = currentData.planningCompleto[manoNum - 1];
    if (!manoData) return false;
    const tableIdx = manoData.tavoli.findIndex(t => t.includes(pid));
    if (tableIdx === -1) return false;
    const table = manoData.tavoli[tableIdx];

    let scores: Record<string, number> = {};
    table.forEach(pId => {
      const history = currentData.storicoPunteggi[pId];
      if (history && history[manoNum] !== undefined) {
        scores[pId] = history[manoNum] - (history[manoNum - 1] ?? 0);
      }
    });

    if (scores[pid] !== 45) return false;
    return table.every(id => id === pid || scores[id] === -15);
  };

  const baseStats = useMemo(() => {
    return data.giocatori.map(p => {
      let restConclusi = 0;
      let playConclusi = 0;
      let handScores: number[] = [];
      let cappottiCount = 0;
      
      data.planningCompleto.forEach((mano, idx) => {
        const manoNum = idx + 1;
        const isConcluded = manoNum < data.manoAttuale || data.status === 'finished';

        if (mano.riposanti.includes(p.id)) {
          if (isConcluded) restConclusi++;
        } else if (mano.tavoli.some(table => table.includes(p.id))) {
          if (isConcluded) {
            playConclusi++;
            const history = data.storicoPunteggi[p.id];
            if (history && history[manoNum] !== undefined) {
              const score = history[manoNum] - (history[manoNum - 1] ?? 0);
              handScores.push(score);
              if (checkIsRealCapStatic(p.id, manoNum, data)) {
                cappottiCount++;
              }
            }
          }
        }
      });

      const score = data.punteggi[p.id] || 0;
      const realAvg = handScores.length > 0 ? handScores.reduce((a, b) => a + (isNaN(b) ? 0 : b), 0) / handScores.length : 0;
      const max = handScores.length > 0 ? Math.max(...handScores) : 0;
      const min = handScores.length > 0 ? Math.min(...handScores) : 0;
      const positiveCount = handScores.filter(s => s > 0).length;
      
      let maxStreak = 0;
      let currentStreak = 0;
      handScores.forEach(s => {
        if (s > 0) {
          currentStreak++;
          maxStreak = Math.max(maxStreak, currentStreak);
        } else {
          currentStreak = 0;
        }
      });

      return { 
        id: p.id,
        name: p.name,
        score,
        restConclusi,
        playConclusi,
        playedHandsCount: handScores.length,
        avg: realAvg,
        max,
        min,
        positiveCount,
        maxStreak,
        cappottiCount,
        isEliminated: p.isEliminated
      };
    });
  }, [data.giocatori, data.planningCompleto, data.manoAttuale, data.status, data.storicoPunteggi, data.punteggi]);

  const tournamentStats = useMemo(() => {
    return [...baseStats].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return a.name.localeCompare(b.name);
      return sortConfig.dir === 'asc' 
        ? (Number(aVal) < Number(bVal) ? -1 : 1)
        : (Number(aVal) > Number(bVal) ? -1 : 1);
    });
  }, [baseStats, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc'
    }));
  };

  const exportToExcel = () => {
    const sortedByName = [...baseStats].sort((a, b) => a.name.localeCompare(b.name));
    
    const headers = ["Giocatore", "Punteggio", "Media Punti", "Max", "Min", "Mani Pos.", "Streak", "Cappotti", "Mani Totali", "Riposi Totali"];
    const rows = sortedByName.map(s => [
      s.name,
      s.score,
      s.playedHandsCount > 0 ? s.avg.toFixed(2) : "-",
      s.playedHandsCount > 0 ? s.max : "-",
      s.playedHandsCount > 0 ? s.min : "-",
      s.positiveCount,
      s.maxStreak,
      s.cappottiCount,
      s.playConclusi,
      s.restConclusi
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Statistiche_Torneo_Peppa.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSeatLabel = (tIdx: number, sIdx: number) => {
    const tableNum = tIdx + 1;
    const seatChar = String.fromCharCode(65 + (tIdx * 4) + sIdx);
    return `${tableNum}${seatChar}`;
  };

  const getRotationChar = (manoIdx: number) => {
    const chars = rotationPattern === 'DS-C' ? ['D', 'S', '-', 'C'] : ['D', 'S', 'C', '-'];
    return chars[manoIdx % 4];
  };

  const toggleRotationPattern = () => {
    if (!onUpdateData || data.status !== 'planning') return;
    const newPattern = rotationPattern === 'DS-C' ? 'DSC-' : 'DS-C';
    onUpdateData({ ...data, rotationPattern: newPattern });
  };

  const truncateName = (name: string | undefined) => {
    if (!name) return "";
    return name.length > 10 ? name.substring(0, 10) : name;
  };

  const checkIsRealCap = (pid: string, manoNum: number, tableIdx: number): boolean => {
    const manoData = data.planningCompleto[manoNum - 1];
    if (!manoData) return false;
    const table = manoData.tavoli[tableIdx];
    if (!table || !table.includes(pid)) return false;

    let scores: Record<string, number> = {};
    const isCurrent = manoNum === data.manoAttuale && data.status !== 'finished';

    if (isCurrent) {
      scores = currentHandScores[tableIdx] || {};
    } else {
      table.forEach(pId => {
        const history = data.storicoPunteggi[pId];
        if (history && history[manoNum] !== undefined) {
          scores[pId] = history[manoNum] - (history[manoNum - 1] ?? 0);
        }
      });
    }

    if (scores[pid] !== 45) return false;
    return table.every(id => id === pid || scores[id] === -15);
  };

  const renderPlayer = (playerId: string | undefined, manoNum: number, tableIdx: number, isInactiveTable: boolean = false) => {
    const cellWidth = "w-[76px]";
    
    if (isInactiveTable) {
      return (
        <div className={`flex items-center justify-center min-h-[48px] ${cellWidth} bg-slate-950/60 border-r border-slate-800/50 opacity-40`}>
          <Lock className="w-2.5 h-2.5 text-slate-600" />
        </div>
      );
    }

    if (!playerId) {
      return (
        <div className={`flex items-center justify-center min-h-[48px] ${cellWidth} border-r border-slate-800/30`}>
          <span className="text-slate-800 text-[9px] font-black opacity-30 italic tracking-tighter uppercase">DA DEF.</span>
        </div>
      );
    }

    const player = data.giocatori.find(p => p.id === playerId);
    let scoreAtHand: number | null = null;
    let totalScoreAtHand: number | null = null;
    let isCurrent = manoNum === data.manoAttuale && data.status !== 'finished';

    if (manoNum < data.manoAttuale || data.status === 'finished') {
      const playerHistory = data.storicoPunteggi[playerId];
      if (playerHistory && playerHistory[manoNum] !== undefined) {
        scoreAtHand = playerHistory[manoNum] - (playerHistory[manoNum - 1] ?? 0);
      }
    } else if (isCurrent) {
      const scoreInState = currentHandScores[tableIdx]?.[playerId];
      const handContribution = (scoreInState !== undefined && !isNaN(scoreInState)) ? scoreInState : 0;
      scoreAtHand = (scoreInState !== undefined && !isNaN(scoreInState)) ? scoreInState : null;
      totalScoreAtHand = (data.punteggi[playerId] || 0) + handContribution;
    }
    
    const isCappotto = checkIsRealCap(playerId, manoNum, tableIdx);
    
    return (
      <div className={`flex flex-col items-center py-1 px-0.5 min-h-[48px] ${cellWidth} justify-center transition-colors border-r border-slate-800/30 last:border-r-0 ${isCappotto ? 'bg-rose-900/40' : ''}`}>
        <span className={`text-[11px] font-narrow truncate w-full text-center leading-none ${player?.isEliminated ? 'line-through text-rose-500/50' : isCappotto ? 'text-rose-100' : 'text-slate-200'}`}>
          {truncateName(player?.name)}
        </span>
        {showScores && (
          <div className="flex flex-col items-center justify-center h-5">
            {isCurrent ? (
              <span className="text-[12px] font-black text-yellow-400">
                {totalScoreAtHand}
              </span>
            ) : scoreAtHand !== null ? (
              <span className={`text-[12px] px-0.5 rounded font-mono ${
                scoreAtHand === 45 ? 'font-[900] text-[#34d399]' :
                isCappotto ? 'text-rose-400' :
                scoreAtHand > 0 ? 'text-emerald-400' : 
                scoreAtHand < 0 ? 'text-rose-400' : 'text-slate-500'
              }`}>
                {scoreAtHand > 0 ? `+${scoreAtHand}` : scoreAtHand}
              </span>
            ) : null}
          </div>
        )}
      </div>
    );
  };

  const finalPlayersCount = data.config.numGiocatori - data.config.numEliminatiDopoFase1;
  const eliminatedNames = data.giocatori.filter(p => p.isEliminated).map(p => p.name).join(', ');

  return (
    <div className={`flex flex-col items-center w-full mx-auto py-1 relative ${forceStats ? 'animate-in fade-in duration-500' : ''}`}>
      {showStats && (
        <div className={forceStats ? "w-full flex justify-center" : "fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4"}>
          <div className={`bg-slate-900 border border-slate-700 rounded-[32px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col ${forceStats ? 'w-full max-w-7xl' : 'w-[95vw] h-[90vh] animate-in zoom-in duration-200'}`}>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Statistiche Avanzate Torneo</h3>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={exportToExcel}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                >
                  <Download className="w-4 h-4" /> Esporta XLS
                </button>
                {!forceStats && (
                  <button onClick={() => setLocalShowStats(false)} className="p-2 hover:bg-slate-700 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="sticky top-0 bg-slate-800 z-10">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-4 border-b border-slate-700 cursor-pointer hover:text-white transition-colors w-1/5" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Giocatore <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('score')}>
                      <div className="flex items-center justify-center gap-1">Punti <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center bg-slate-800/40 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('avg')}>
                      <div className="flex items-center justify-center gap-1">Media <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('max')}>
                      <div className="flex items-center justify-center gap-1">Max <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('min')}>
                      <div className="flex items-center justify-center gap-1">Min <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('positiveCount')}>
                      <div className="flex items-center justify-center gap-1">Mani + <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('maxStreak')}>
                      <div className="flex items-center justify-center gap-1">Streak <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('cappottiCount')}>
                      <div className="flex items-center justify-center gap-1">Cappotti <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('playCount')}>
                      <div className="flex items-center justify-center gap-1">Mani <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                    <th className="p-4 border-b border-slate-700 text-center cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('restCount')}>
                      <div className="flex items-center justify-center gap-1">Riposi <ArrowUpDown className="w-3 h-3 opacity-30" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {tournamentStats.map((stat) => (
                    <tr key={stat.id} className={`hover:bg-slate-800/30 transition-colors ${stat.isEliminated ? 'opacity-40' : ''}`}>
                      <td className="p-4 overflow-hidden text-ellipsis whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className={`font-bold text-sm ${stat.isEliminated ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {stat.name}
                          </span>
                          {stat.isEliminated && <span className="text-[8px] text-rose-500 font-black uppercase">Eliminato</span>}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-emerald-400">{stat.score}</span>
                      </td>
                      <td className="p-4 text-center bg-slate-800/20">
                        <div className="inline-flex items-center gap-1">
                          <Activity className="w-3 h-3 text-emerald-500 opacity-50" />
                          <span className={`text-sm font-black ${stat.avg > 0 ? 'text-emerald-400' : stat.avg < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {stat.playedHandsCount > 0 ? stat.avg.toFixed(1) : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <ChevronUp className="w-3 h-3 text-emerald-500" />
                          <span className="text-sm font-black text-emerald-400">{stat.playedHandsCount > 0 ? `+${stat.max}` : '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1">
                          <ChevronDown className="w-3 h-3 text-rose-500" />
                          <span className="text-sm font-black text-rose-400">{stat.playedHandsCount > 0 ? stat.min : '-'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-emerald-400">{stat.positiveCount}</span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-sm font-black text-emerald-400">{stat.maxStreak}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          <Trophy className="w-3 h-3 text-rose-400" />
                          <span className="text-sm font-black text-rose-400">{stat.cappottiCount}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-slate-300">{stat.playConclusi}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className="text-sm font-black text-slate-500">{stat.restConclusi}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-950/80 border-t border-slate-800 text-center shrink-0">
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Le statistiche considerano solo le mani effettivamente concluse</p>
            </div>
          </div>
        </div>
      )}

      {!forceStats && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-2 sm:p-4 shadow-2xl overflow-hidden w-full max-w-[1800px]">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 px-2">
            <h2 className="text-lg font-black text-white tracking-tight uppercase">Planning Torneo</h2>
          </div>
          
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            <table className="border-separate border-spacing-0 w-full">
              <thead>
                <tr className="bg-slate-800 text-slate-400">
                  <th rowSpan={2} className="p-0 border-b border-r border-slate-600 text-center sticky left-0 bg-slate-800 z-40 font-black uppercase text-[13px] min-w-[36px] w-[36px]">N..</th>
                  <th rowSpan={2} className="p-0 border-b border-r border-slate-700 text-center sticky left-[36px] bg-slate-950 z-40 min-w-[32px] w-[32px]">
                    {data.status === 'planning' ? (
                      <button 
                          onClick={toggleRotationPattern}
                          className="flex flex-col items-center justify-center w-full h-full hover:bg-slate-800 transition-colors py-1"
                      >
                        <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter leading-none mb-0.5">Pat.</span>
                        <RefreshCcw className="w-2.5 h-2.5 text-emerald-500" />
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter mt-0.5 leading-none">{rotationPattern}</span>
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">R</span>
                    )}
                  </th>
                  {Array.from({ length: maxTavoli }).map((_, i) => (
                    <th key={i} colSpan={4} className={`p-1.5 border-b border-r-2 border-slate-700 text-center text-[12px] font-black uppercase tracking-widest ${i % 2 === 0 ? 'bg-slate-900 text-emerald-400' : 'bg-slate-800/60 text-emerald-500/60'}`}>Tavolo {i + 1}</th>
                  ))}
                  <th rowSpan={2} className="p-1 border-b border-slate-600 text-center font-black uppercase text-[9px] min-w-[100px]">Riposo</th>
                </tr>
                <tr className="bg-slate-800/50 text-[11px] text-emerald-400">
                  {Array.from({ length: maxTavoli }).map((_, tIdx) => (
                    <React.Fragment key={tIdx}>
                      <th className="p-1 border-b border-r border-slate-700 font-black w-[76px] uppercase tracking-widest">{getSeatLabel(tIdx, 0)}</th>
                      <th className="p-1 border-b border-r border-slate-700 font-black w-[76px] uppercase tracking-widest">{getSeatLabel(tIdx, 1)}</th>
                      <th className="p-1 border-b border-r border-slate-700 font-black w-[76px] uppercase tracking-widest">{getSeatLabel(tIdx, 2)}</th>
                      <th className="p-1 border-b border-r-2 border-slate-700 font-black w-[76px] uppercase tracking-widest">{getSeatLabel(tIdx, 3)}</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.planningCompleto.map((mano, idx) => {
                  const isFirstRecupero = mano.fase === 'recupero' && (idx === 0 || data.planningCompleto[idx-1].fase !== 'recupero');
                  const isFirstTop = mano.fase === 'top' && (idx === 0 || data.planningCompleto[idx-1].fase !== 'top');
                  const isCurrentMano = data.manoAttuale === mano.mano && data.status !== 'finished';
                  
                  return (
                    <React.Fragment key={idx}>
                      {isFirstRecupero && (
                        <tr className="bg-amber-600/30">
                          <td colSpan={2 + maxTavoli * 4 + 1} className="p-2 text-center border-y border-amber-500/50">
                            <div className="flex items-center justify-center gap-3">
                              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                              <span className="text-[12px] font-black uppercase tracking-[0.3em] text-white drop-shadow-md">FASE LEA</span>
                              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                            </div>
                          </td>
                        </tr>
                      )}
                      {isFirstTop && (
                        <tr className="bg-emerald-900/40">
                          <td colSpan={2 + maxTavoli * 4 + 1} className="p-3 text-center border-y border-emerald-500/40">
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="w-5 h-5 text-emerald-400" />
                                <span className="text-[14px] font-black uppercase tracking-[0.2em] text-emerald-400">FASE TOP ({finalPlayersCount} GIOCATORI)</span>
                              </div>
                              {eliminatedNames && <span className="text-[10px] text-rose-400/90 font-medium tracking-tight">Eliminati: {eliminatedNames}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      <tr className={`group transition-colors ${isCurrentMano ? 'bg-yellow-500/10' : 'hover:bg-slate-800/20'} ${mano.fase === 'recupero' ? 'bg-amber-900/5' : ''}`}>
                        <td className={`p-0 font-black text-center border-b border-r border-slate-600 sticky left-0 z-30 transition-colors text-[13px] ${isCurrentMano ? 'text-yellow-400 bg-slate-800' : 'text-slate-400 bg-slate-900 group-hover:bg-slate-800/90'}`}>
                          {mano.mano}
                        </td>
                        <td className={`p-0 border-b border-r border-slate-800 text-center sticky left-[36px] z-30 ${isCurrentMano ? 'bg-slate-800/80' : 'bg-slate-950/80'}`}>
                          <span className="text-[14px] font-black text-yellow-500 drop-shadow-sm select-none">
                            {getRotationChar(idx)}
                          </span>
                        </td>
                        {Array.from({ length: maxTavoli }).map((_, tIdx) => {
                          const tavolo = mano.tavoli[tIdx];
                          const hasTable = tIdx < mano.tavoli.length;
                          const cellBg = tIdx % 2 === 0 ? 'bg-slate-950/20' : '';
                          
                          const isInactive = !hasTable && (mano.fase === 'recupero' || (mano.fase === 'top' && mano.tavoli.length === 0));

                          return (
                            <React.Fragment key={tIdx}>
                              <td className={`p-0 border-b border-slate-800/40 w-[76px] ${cellBg}`}>{hasTable ? renderPlayer(tavolo?.[0], mano.mano, tIdx) : renderPlayer(undefined, mano.mano, tIdx, isInactive)}</td>
                              <td className={`p-0 border-b border-slate-800/40 w-[76px] ${cellBg}`}>{hasTable ? renderPlayer(tavolo?.[1], mano.mano, tIdx) : renderPlayer(undefined, mano.mano, tIdx, isInactive)}</td>
                              <td className={`p-0 border-b border-slate-800/40 w-[76px] ${cellBg}`}>{hasTable ? renderPlayer(tavolo?.[2], mano.mano, tIdx) : renderPlayer(undefined, mano.mano, tIdx, isInactive)}</td>
                              <td className={`p-0 border-b border-r-2 border-slate-700 w-[76px] ${cellBg}`}>{hasTable ? renderPlayer(tavolo?.[3], mano.mano, tIdx) : renderPlayer(undefined, mano.mano, tIdx, isInactive)}</td>
                            </React.Fragment>
                          );
                        })}
                        <td className={`p-1 border-b border-slate-800 text-[11px] font-narrow text-slate-400 text-center min-w-[100px] leading-tight group-hover:text-slate-200 transition-colors ${mano.fase === 'recupero' ? 'text-amber-500 font-normal' : ''}`}>
                          {mano.riposanti.length > 0 ? mano.riposanti.map(pid => data.giocatori.find(g => g.id === pid)?.name).filter(Boolean).map(n => n.substring(0,10)).join(', ') : (mano.fase === 'top' ? '-' : 'NESSUNO')}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanningView;
