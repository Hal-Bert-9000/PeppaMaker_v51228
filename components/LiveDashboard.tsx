
import React, { useState, useMemo, useCallback, useRef } from 'react';
import { TournamentData, TableScore, Player, HandAssignment } from '../types';
import { Table as TableIcon, ListOrdered, CalendarDays, LineChart, AlertCircle, TrendingUp, PartyPopper, Camera, Coffee, ShieldCheck, Skull, X, Trophy, BarChart3 } from 'lucide-react';
import { generateNextTopHand, updateRelazioni } from '../utils/tournamentLogic';
import PlanningView from './PlanningView';

interface LiveDashboardProps {
  data: TournamentData;
  setData: (data: TournamentData | null) => void;
}

const PerformanceChart: React.FC<{ data: TournamentData }> = ({ data }) => {
  const allPlayers = [...data.giocatori].sort((a, b) => (data.punteggi[b.id] || 0) - (data.punteggi[a.id] || 0));
  const svgRef = useRef<SVGSVGElement>(null);

  const allHistoryPoints = Object.values(data.storicoPunteggi).flat() as number[];
  const maxPoints = Math.max(...allHistoryPoints, 10);
  const minPoints = Math.min(...allHistoryPoints, -10);
  
  const range = maxPoints - minPoints;
  const steps = data.manoAttuale;
  
  const width = 850; 
  const height = 380; 
  const paddingLeft = 40;
  const paddingRight = 140; 
  const paddingTop = 30;
  const paddingBottom = 40;

  const getX = (hand: number) => paddingLeft + (hand * (width - paddingLeft - paddingRight) / (steps || 1));
  const getY = (points: number) => height - paddingBottom - ((points - minPoints) * (height - paddingTop - paddingBottom) / (range || 1));

  const colors = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
    '#84cc16', '#eab308', '#d946ef', '#0ea5e9', '#a855f7'
  ];

  const downloadChart = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement("canvas");
    const svgSize = svgRef.current.viewBox.baseVal;
    canvas.width = svgSize.width * 2; 
    canvas.height = svgSize.height * 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#0f172a"; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `Torneo_Grafico_Mano_${data.manoAttuale}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const isRealCappotto = (playerId: string, handIdx: number) => {
    if (handIdx === 0) return false;
    const history = data.storicoPunteggi[playerId];
    if (!history || history[handIdx] === undefined) return false;
    
    const handScore = history[handIdx] - history[handIdx - 1];
    if (handScore !== 45) return false;

    const handPlanning = data.planningCompleto[handIdx - 1];
    if (!handPlanning) return false;

    const table = handPlanning.tavoli.find(t => t.includes(playerId));
    if (!table) return false;

    return table.every(pid => {
      if (pid === playerId) return true;
      const otherHistory = data.storicoPunteggi[pid];
      if (!otherHistory || otherHistory[handIdx] === undefined) return false;
      const otherScore = otherHistory[handIdx] - otherHistory[handIdx - 1];
      return otherScore === -15;
    });
  };

  return (
    <div className="bg-slate-900 p-5 rounded-[24px] border border-slate-800 shadow-2xl space-y-3 w-full">
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] font-black flex items-center gap-2 uppercase tracking-[0.2em] text-slate-500">
          <TrendingUp className="text-emerald-500 w-3.5 h-3.5" /> Trend Punteggi
        </h3>
        <button 
          onClick={downloadChart}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border border-slate-700 transition"
        >
          <Camera className="w-3.5 h-3.5" /> Esporta
        </button>
      </div>
      <div className="relative w-full overflow-hidden">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto bg-slate-900">
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <line key={`h-${v}`} x1={paddingLeft} y1={getY(minPoints + range * v)} y2={getY(minPoints + range * v)} stroke="#1e293b" strokeDasharray="4" />
          ))}

          {Array.from({ length: steps + 1 }).map((_, m) => (
            <g key={`v-${m}`}>
              <line x1={getX(m)} y1={paddingTop} x2={getX(m)} y2={height - paddingBottom} stroke="#1e293b" strokeWidth="1" />
              <text x={getX(m)} y={height - paddingBottom + 20} fill="#64748b" fontSize="10" textAnchor="middle" fontWeight="800" style={{ fontFamily: 'sans-serif' }}>M{m}</text>
            </g>
          ))}

          {allPlayers.map((p, idx) => {
            const history = data.storicoPunteggi[p.id] || [];
            const pointsStr = history.map((pt, h) => `${getX(h)},${getY(pt)}`).join(' ');
            const lastPoint = history[history.length - 1];
            const color = colors[idx % colors.length];

            return (
              <g key={p.id}>
                <polyline fill="none" stroke={color} strokeWidth={idx < 5 ? "2.5" : "1.2"} strokeOpacity={idx < 10 ? "0.9" : "0.3"} points={pointsStr} className="transition-all duration-1000" />
                
                {history.map((pt, h) => {
                  if (h === 0) return null;
                  if (isRealCappotto(p.id, h)) {
                    return (
                      <circle 
                        key={`${p.id}-cap-${h}`}
                        cx={getX(h)} 
                        cy={getY(pt)} 
                        r="5" 
                        fill={color} 
                        stroke="#ef4444" 
                        strokeWidth="2.5" 
                      />
                    );
                  }
                  return null;
                })}

                <text 
                  x={getX(history.length - 1) + 8} 
                  y={getY(lastPoint) + 4} 
                  fill={color} 
                  fontSize="10" 
                  fontWeight="900" 
                  opacity={idx < 10 ? 1 : 0.5}
                  style={{ fontFamily: 'sans-serif' }}
                >
                  {p.name.substring(0, 8)} {lastPoint}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const PodiumModal: React.FC<{ data: TournamentData; onClose: () => void }> = ({ data, onClose }) => {
  const getGenderedKing = (name: string) => {
    const n = name.toLowerCase().trim();
    if (n.endsWith('a') || n === 'manuela' || n === 'beatrice' || n === 'rebecca' || n === 'lea') return "REGINA";
    return "RE";
  };

  const groupedByScore = useMemo(() => {
    const scores = [...data.giocatori].map(p => ({ p, s: data.punteggi[p.id] || 0 }));
    scores.sort((a, b) => b.s - a.s);

    const groups: { score: number, players: Player[] }[] = [];
    scores.forEach(({ p, s }) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.score === s) {
        lastGroup.players.push(p);
      } else {
        groups.push({ score: s, players: [p] });
      }
    });
    return groups;
  }, [data.giocatori, data.punteggi]);

  const kings = groupedByScore[0]?.players || [];
  const viceKings = groupedByScore[1]?.players || [];
  const consoles = groupedByScore[2]?.players || [];
  
  const topGroupsIds = new Set([...kings, ...viceKings, ...consoles].map(p => p.id));
  const senators = data.giocatori.filter(p => !topGroupsIds.has(p.id) && (data.punteggi[p.id] || 0) >= 0);
  const plebs = data.giocatori.filter(p => !topGroupsIds.has(p.id) && (data.punteggi[p.id] || 0) < 0);

  const renderGroup = (title: string, players: Player[], colorClass: string, icon?: React.ReactNode) => {
    if (players.length === 0) return null;
    return (
      <div className="mb-4">
        <div className={`text-lg font-black uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2 ${colorClass}`}>
          {icon} {title} {icon}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {players.map(p => (
            <div key={p.id} className="bg-slate-800/40 rounded-2xl p-3 border border-slate-700/50 flex items-center gap-4 min-w-[180px] justify-between transition-transform hover:scale-105 shadow-md">
              <span className="text-sm font-black text-white">{p.name}</span>
              <span className={`text-lg font-black ${colorClass}`}>{data.punteggi[p.id]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/98 backdrop-blur-3xl p-4 overflow-y-auto">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-700 rounded-[40px] p-8 text-center shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in duration-300 relative my-4">
        <div className="absolute top-6 right-8">
            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                <X className="w-6 h-6" />
            </button>
        </div>

        <PartyPopper className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-8">LA CORTE DELLA PEPPA</h2>
        
        <div className="space-y-6">
          {renderGroup(kings.length === 1 ? `${getGenderedKing(kings[0].name)} DELLA PEPPA` : "RE DELLA PEPPA", kings, "text-amber-400", <Trophy className="w-5 h-5" />)}
          {renderGroup("VICE RE", viceKings, "text-slate-300", <ShieldCheck className="w-5 h-5" />)}
          {renderGroup("CONSOLE", consoles, "text-orange-500", <CalendarDays className="w-5 h-5" />)}

          {senators.length > 0 && (
             <div className="pt-4 border-t border-slate-800/50">
               <div className="text-lg font-black uppercase tracking-[0.2em] mb-3 text-emerald-500">SENATORI</div>
               <div className="flex flex-wrap justify-center gap-2">
                 {senators.sort((a,b) => (data.punteggi[b.id]||0) - (data.punteggi[a.id]||0)).map(p => (
                   <div key={p.id} className="bg-slate-800/20 px-4 py-1.5 rounded-xl border border-slate-800 text-slate-300 text-sm font-bold flex gap-3 shadow-sm">
                     {p.name} <span className="text-emerald-500">{data.punteggi[p.id]}</span>
                   </div>
                 ))}
               </div>
             </div>
          )}

          {plebs.length > 0 && (
             <div className="pt-4 border-t border-slate-800/50">
               <div className="text-lg font-black uppercase tracking-[0.2em] mb-3 text-rose-600 flex items-center justify-center gap-2">
                 <Skull className="w-4 h-4" /> LURIDA PLEBAGLIA <Skull className="w-4 h-4" />
               </div>
               <div className="flex flex-wrap justify-center gap-2">
                 {plebs.sort((a,b) => (data.punteggi[a.id]||0) - (data.punteggi[b.id]||0)).map(p => (
                   <div key={p.id} className="bg-rose-950/10 px-4 py-1.5 rounded-xl border border-rose-900/10 text-rose-500/60 text-xs font-medium flex gap-3 shadow-sm">
                     {p.name} <span>{data.punteggi[p.id]}</span>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </div>

        <button onClick={onClose} className="mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-10 rounded-2xl uppercase tracking-[0.2em] text-xs transition-all border border-emerald-500/20 shadow-xl active:scale-95">
          Torna al Torneo
        </button>
      </div>
    </div>
  );
};

const LiveDashboard: React.FC<LiveDashboardProps> = ({ data, setData }) => {
  const [activeTab, setActiveTab] = useState<'scoring' | 'ranking' | 'planning' | 'stats' | 'advancedStats'>('scoring');
  const [currentHandScores, setCurrentHandScores] = useState<Record<number, TableScore>>({});
  const [focusedPlayer, setFocusedPlayer] = useState<{tableIdx: number, playerId: string} | null>(null);
  const [showEliminationModal, setShowEliminationModal] = useState(false);
  const [showPodium, setShowPodium] = useState(data.status === 'finished');
  const [eliminatedPlayersInfo, setEliminatedPlayersInfo] = useState<{name: string, score: number}[]>([]);
  
  const currentHandInfo = data.planningCompleto[data.manoAttuale - 1];

  const handleTabClick = (tabId: 'scoring' | 'ranking' | 'planning' | 'stats' | 'advancedStats') => {
    if (data.status === 'finished' && tabId === 'scoring') {
      setShowPodium(true);
      return;
    }
    setActiveTab(tabId);
  };

  const handleScoreChange = useCallback((tavoloIdx: number, playerId: string, value: string) => {
    const numValue = parseInt(value);
    setCurrentHandScores(prev => ({ ...prev, [tavoloIdx]: { ...prev[tavoloIdx], [playerId]: isNaN(numValue) ? undefined as any : numValue } }));
  }, []);

  const handleCappotto = (tIdx: number, winnerId: string) => {
    if (!currentHandInfo) return;
    const players = currentHandInfo.tavoli[tIdx];
    const newScores: TableScore = {};
    players.forEach(pid => {
      newScores[pid] = pid === winnerId ? 45 : -15;
    });
    setCurrentHandScores(prev => ({ ...prev, [tIdx]: newScores }));
  };

  const generateRandomScores = (tIdx: number) => {
    if (!currentHandInfo) return;
    const players = currentHandInfo.tavoli[tIdx];
    let vals = [0, 0, 0, 0];
    vals[0] = Math.floor(Math.random() * 31) - 15;
    vals[1] = Math.floor(Math.random() * 31) - 15;
    vals[2] = Math.floor(Math.random() * 31) - 15;
    vals[3] = -(vals[0] + vals[1] + vals[2]);

    const newScores: TableScore = {};
    players.forEach((pid, i) => {
      newScores[pid] = vals[i];
    });
    setCurrentHandScores(prev => ({ ...prev, [tIdx]: newScores }));
  };

  const autoBalance = (tIdx: number) => {
    if (!currentHandInfo || !currentHandInfo.tavoli[tIdx]) return;
    const t = currentHandInfo.tavoli[tIdx];
    const s = currentHandScores[tIdx] || {};
    let targetPlayerId = focusedPlayer?.tableIdx === tIdx ? focusedPlayer.playerId : (t.find(p => s[p] === undefined || isNaN(s[p])) || t[3]);
    const otherPlayers = t.filter(p => p !== targetPlayerId);
    const sumOthers = otherPlayers.reduce((acc, p) => acc + (Number(s[p]) || 0), 0);
    handleScoreChange(tIdx, targetPlayerId, String(-sumOthers));
  };

  const saveHand = () => {
    const newPunteggi = { ...data.punteggi };
    const newStorico = { ...data.storicoPunteggi };
    let nextGiocatori = [...data.giocatori];
    let nextPlanning = [...data.planningCompleto];
    let nextRelazioni = { ...data.storicoRelazioni };

    currentHandInfo.tavoli.forEach(table => updateRelazioni(table, nextRelazioni));
    data.giocatori.forEach(p => {
      let handScore = 0;
      currentHandInfo.tavoli.forEach((t, i) => { if (t.includes(p.id)) handScore = Number(currentHandScores[i]?.[p.id]) || 0; });
      newPunteggi[p.id] = (newPunteggi[p.id] || 0) + handScore;
      newStorico[p.id] = [...(newStorico[p.id] || [0]), newPunteggi[p.id]];
    });

    const isEndOfSocialOrRecupero = currentHandInfo.fase !== 'top' && (nextPlanning[data.manoAttuale]?.fase === 'top' || data.manoAttuale === nextPlanning.length);

    if (isEndOfSocialOrRecupero) {
      // FIX: Use config.numEliminatiDopoFase1 instead of remainder to respect user setup
      const numToEliminate = data.config.numEliminatiDopoFase1;
      const sorted = [...nextGiocatori].filter(p => !p.isEliminated).sort((a, b) => newPunteggi[b.id] - newPunteggi[a.id]);
      const toEliminateIds = sorted.slice(sorted.length - numToEliminate).map(p => p.id);
      
      nextGiocatori = nextGiocatori.map(p => toEliminateIds.includes(p.id) ? {...p, isEliminated: true} : p);
      setEliminatedPlayersInfo(toEliminateIds.map(id => ({ name: data.giocatori.find(p => p.id === id)?.name || id, score: newPunteggi[id] })));
      setShowEliminationModal(true);
    }

    const isFinished = data.manoAttuale === nextPlanning.length;
    if (!isFinished && nextPlanning[data.manoAttuale]?.fase === 'top' && nextPlanning[data.manoAttuale]?.tavoli.length === 0) {
      const nextHand = generateNextTopHand({ ...data, giocatori: nextGiocatori, punteggi: newPunteggi, storicoRelazioni: nextRelazioni, planningCompleto: nextPlanning }, data.manoAttuale + 1);
      nextPlanning = nextPlanning.map((h, i) => i === data.manoAttuale ? nextHand : h);
    }

    setData({ ...data, punteggi: newPunteggi, storicoPunteggi: newStorico, giocatori: nextGiocatori, manoAttuale: isFinished ? data.manoAttuale : data.manoAttuale + 1, planningCompleto: nextPlanning, status: isFinished ? 'finished' : 'live', storicoRelazioni: nextRelazioni });
    if (isFinished) setShowPodium(true);
    setCurrentHandScores({});
    setFocusedPlayer(null);
    setActiveTab('ranking');
  };

  const ranking = useMemo(() => [...data.giocatori].sort((a, b) => (data.punteggi[b.id] || 0) - (data.punteggi[a.id] || 0)), [data.giocatori, data.punteggi]);
  const isCurrentHandComplete = () => currentHandInfo?.tavoli.every((table, tIdx) => {
    const scores = currentHandScores[tIdx] || {};
    return table.every(p => scores[p] !== undefined && !isNaN(scores[p])) && table.reduce((acc, p) => acc + (Number(scores[p]) || 0), 0) === 0;
  });

  const getRankBadgeStyle = (idx: number, isEliminated: boolean) => {
    if (idx === 0) return 'bg-amber-400 text-slate-950 ring-2 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.5)]';
    if (idx === 1) return 'bg-slate-300 text-slate-950 ring-2 ring-slate-100/30 shadow-[0_0_12px_rgba(203,213,225,0.4)]';
    if (idx === 2) return 'bg-orange-600 text-white ring-2 ring-orange-400/30 shadow-[0_0_12px_rgba(234,88,12,0.4)]';
    if (isEliminated) return 'bg-rose-950 text-rose-500 opacity-50';
    return 'bg-slate-800 text-slate-400';
  };

  const getSeatLabel = (tIdx: number, sIdx: number) => {
    const tableNum = tIdx + 1;
    const seatChar = String.fromCharCode(65 + (tIdx * 4) + sIdx);
    return `${tableNum}${seatChar}`;
  };

  const truncateName = (name: string | undefined) => {
    if (!name) return "";
    return name.length > 12 ? name.substring(0, 11) + '…' : name;
  };

  const renderRankingTable = (subset: Player[], startIdx: number) => (
    <div className="bg-slate-900 rounded-[20px] border border-slate-800 overflow-hidden shadow-2xl w-full">
      <table className="w-full text-left border-separate border-spacing-0">
        <thead className="bg-slate-800/60 text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">
          <tr><th className="p-2.5 px-4 border-b border-slate-700/50 w-20 text-center">Pos</th><th className="p-2.5 border-b border-slate-700/50">Giocatore</th><th className="p-2.5 px-6 text-right border-b border-slate-700/50">Punti</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-800/40 text-base">
          {subset.map((p, i) => {
            const globalIdx = startIdx + i;
            const isEliminated = p.isEliminated;
            return (
              <tr key={p.id} className={`transition-all hover:bg-slate-800/30 ${isEliminated ? 'bg-rose-950/10' : ''}`}>
                <td className="p-1.5 text-center">
                  <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center font-[400] text-sm px-4 ${getRankBadgeStyle(globalIdx, isEliminated)}`}>
                    #{globalIdx + 1}
                  </div>
                </td>
                <td className={`p-1.5 font-narrow text-xl ${isEliminated ? 'text-rose-500 line-through opacity-60' : 'text-slate-100'}`}>
                  {p.name}
                </td>
                <td className={`p-1.5 px-6 text-right font-black font-mono text-2xl ${isEliminated ? 'text-rose-600' : globalIdx < 3 ? 'text-emerald-400' : 'text-emerald-500'}`}>
                  {data.punteggi[p.id]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-2 max-w-[1800px] mx-auto flex flex-col items-center">
      {showPodium && <PodiumModal data={data} onClose={() => setShowPodium(false)} />}
      
      {showEliminationModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-3xl">
          <div className="bg-slate-900 p-10 rounded-[40px] border border-rose-500/30 shadow-[0_0_80px_rgba(244,63,94,0.15)] text-center max-w-sm w-full animate-in">
            <AlertCircle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black text-white uppercase mb-4">Eliminati</h2>
            <div className="my-6 space-y-2 text-rose-400 text-xl font-narrow font-bold">
              {eliminatedPlayersInfo.map(info => <div key={info.name} className="bg-rose-950/20 py-1.5 px-4 rounded-xl">{info.name} {info.score}pt</div>)}
            </div>
            <button onClick={() => setShowEliminationModal(false)} className="bg-rose-600 text-white font-black py-4 px-8 rounded-xl w-full uppercase text-xs tracking-widest">
              Prosegui
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between w-full max-w-7xl glass-nav p-1.5 rounded-2xl border border-slate-800/50 mt-1 shadow-2xl">
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800">
            {[
              {id: 'scoring', icon: TableIcon, label: 'Tavoli'},
              {id: 'ranking', icon: ListOrdered, label: 'Classifica'},
              {id: 'advancedStats', icon: BarChart3, label: 'Statistiche'},
              {id: 'stats', icon: LineChart, label: 'Grafico'},
              {id: 'planning', icon: CalendarDays, label: 'Planning'}
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => handleTabClick(tab.id as any)} 
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-[0.1em] ${activeTab === tab.id ? 'bg-slate-800 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <tab.icon className="w-3.5 h-3.5"/> {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 pr-1">
          <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl shadow-inner flex items-center gap-2">
             <span className="text-xl font-black text-emerald-400 tracking-tighter">
                {currentHandInfo?.fase === 'recupero' ? 'RECUPERO' : 'Mano'} {data.manoAttuale} <span className="text-slate-600 text-xs font-normal">/ {data.planningCompleto.length}</span>
             </span>
          </div>
          <div className="min-w-[160px] flex justify-end">
            {activeTab === 'scoring' && data.status !== 'finished' ? (
              <button 
                onClick={saveHand} 
                disabled={!isCurrentHandComplete()} 
                className={`px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-[0.1em] transition-all shadow-xl ${isCurrentHandComplete() ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-slate-800 text-slate-600 opacity-40'}`}
              >
                Conferma mano
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="animate-in w-full flex flex-col items-center">
        {activeTab === 'scoring' && currentHandInfo && data.status !== 'finished' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full px-4 max-w-[1700px] items-stretch">
            {currentHandInfo.tavoli.map((t, tIdx) => {
              const sum = t.reduce((acc, pid) => acc + (Number(currentHandScores[tIdx]?.[pid]) || 0), 0);
              return (
                <div key={tIdx} className="bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden shadow-2xl flex flex-col transition-all">
                  <div className="bg-slate-800/40 p-3 px-5 flex justify-between items-center border-b border-slate-800/50">
                    <span className="font-black text-[10px] text-slate-500 tracking-[0.2em] uppercase">TAVOLO {tIdx + 1}</span>
                    <div className="flex gap-1.5">
                      {data.config.testMode && (
                        <button tabIndex={-1} onClick={() => generateRandomScores(tIdx)} className="text-[8px] bg-amber-900/20 text-amber-500 px-2.5 py-1 rounded-lg font-black border border-amber-900/30 uppercase tracking-tighter">RND</button>
                      )}
                      <button tabIndex={-1} onClick={() => autoBalance(tIdx)} className="text-[8px] bg-emerald-900/20 text-emerald-500 px-3 py-1 rounded-lg font-black border border-emerald-900/30 uppercase tracking-tighter">BAL.</button>
                    </div>
                  </div>
                  <div className="p-4 px-6 flex-1 flex flex-col justify-between">
                    <div className="divide-y divide-slate-800/40">
                      {t.map((pid, sIdx) => {
                        const p = data.giocatori.find(g => g.id === pid);
                        const playerRankIdx = ranking.findIndex(rk => rk.id === pid);
                        return (
                          <div key={pid} className="flex items-center gap-2 py-2">
                            <span className="text-[13px] font-black text-emerald-400 w-7 shrink-0 tracking-tight">{getSeatLabel(tIdx, sIdx)}</span>
                            
                            <div className={`shrink-0 rounded flex items-center justify-center font-[400] text-[9px] px-4 py-1 ${getRankBadgeStyle(playerRankIdx, p?.isEliminated || false)}`}>
                              #{playerRankIdx + 1}
                            </div>

                            <span className="text-[14px] font-[400] text-slate-400 font-mono w-10 text-center shrink-0">
                                {data.punteggi[pid]}
                            </span>

                            <span className="font-narrow text-slate-100 text-2xl truncate flex-1 leading-tight tracking-tight">{truncateName(p?.name)}</span>
                            <button tabIndex={-1} onClick={() => handleCappotto(tIdx, pid)} className="text-[8px] bg-rose-950/30 text-rose-500 px-2.5 py-1.5 rounded-lg font-black border border-rose-900/20 uppercase tracking-tighter">CAP</button>
                            <input 
                              type="number" 
                              onFocus={() => setFocusedPlayer({tableIdx: tIdx, playerId: pid})} 
                              className={`w-20 h-12 bg-slate-950 border-2 rounded-[14px] p-1 text-center font-black text-emerald-400 outline-none text-2xl transition-all ${focusedPlayer?.playerId === pid ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-800'}`} 
                              value={currentHandScores[tIdx]?.[pid] ?? ''} 
                              onChange={e => handleScoreChange(tIdx, pid, e.target.value)} 
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className={`text-right text-[11px] font-light pt-3 border-t border-slate-800/30 mt-3 ${sum === 0 ? 'text-emerald-500/50' : 'text-rose-500'}`}>
                      somma: {sum}
                    </div>
                  </div>
                </div>
              );
            })}
            {currentHandInfo.riposanti.length > 0 && (
              <div className="bg-slate-900/20 border-2 border-slate-800/50 rounded-[28px] border-dashed flex flex-col items-center justify-center p-6 w-full flex-1">
                <Coffee className="w-12 h-12 text-yellow-500 mb-4 opacity-100" />
                <span className="font-black text-[10px] text-slate-600 tracking-[0.2em] uppercase mb-4">IN RIPOSO</span>
                <div className="flex flex-wrap justify-center gap-2 w-full">
                  {currentHandInfo.riposanti.map((pid) => (
                    <div key={pid} className="font-narrow text-slate-500 text-xl py-2 px-6 bg-slate-800/20 rounded-xl border border-slate-800/30 text-center uppercase tracking-widest">
                      {truncateName(data.giocatori.find(g => g.id === pid)?.name)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ranking' && (
          <div className="w-full max-w-[1450px] px-4 mx-auto pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {renderRankingTable(ranking.slice(0, Math.ceil(ranking.length / 2)), 0)}
                {renderRankingTable(ranking.slice(Math.ceil(ranking.length / 2)), Math.ceil(ranking.length / 2))}
            </div>
          </div>
        )}

        {activeTab === 'advancedStats' && (
          <div className="w-full flex justify-center pb-4">
            <div className="w-full max-w-7xl mx-auto flex justify-center">
              <PlanningView 
                data={data} 
                showScores={true} 
                currentHandScores={currentHandScores} 
                onUpdateData={(newData) => setData(newData)} 
                forceStats={true} 
              />
            </div>
          </div>
        )}
        {activeTab === 'stats' && <div className="w-full px-4 max-w-[1400px] pb-4"><PerformanceChart data={data} /></div>}
        {activeTab === 'planning' && <div className="w-full flex justify-center pb-4"><PlanningView data={data} showScores={true} currentHandScores={currentHandScores} onUpdateData={(newData) => setData(newData)} /></div>}
      </div>
    </div>
  );
};

export default LiveDashboard;
