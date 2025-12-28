
import { HandAssignment, Player, TournamentConfig } from '../types';

export const shuffle = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

// Calcola la posizione relativa tra due giocatori al tavolo (0-3)
const getRelativePos = (i: number, j: number): number => (j - i + 4) % 4;
const getRelKey = (id1: string, id2: string) => `${id1}:${id2}`;

export function optimizeTableSeating(
  table: string[], 
  relazioni: Record<string, number[]>, 
  nextManoIdx: number,
  config: TournamentConfig,
  isTopTable: boolean = false
): string[] {
  const permutations = [
    [0, 1, 2, 3], [0, 1, 3, 2], [0, 2, 1, 3], [0, 2, 3, 1], [0, 3, 1, 2], [0, 3, 2, 1],
    [1, 0, 2, 3], [1, 0, 3, 2], [1, 2, 0, 3], [1, 2, 3, 0], [1, 3, 0, 2], [1, 3, 2, 0]
  ];

  let bestPerm = permutations[0];
  let minConflicts = Infinity;

  for (const permIdx of permutations) {
    const testTable = permIdx.map(i => table[i]);
    let conflicts = 0;
    
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        if (i === j) continue;
        const p1 = testTable[i];
        const p2 = testTable[j];
        const pos = getRelativePos(i, j);
        const history = relazioni[getRelKey(p1, p2)] || [];
        // Penalità massiccia se hanno già occupato quelle posizioni relative
        if (history.includes(pos)) conflicts += 50000;
        conflicts += history.length * 100;
      }
    }
    
    if (conflicts < minConflicts) {
      minConflicts = conflicts;
      bestPerm = permIdx;
    }
  }
  return bestPerm.map(i => table[i]);
}

export function updateRelazioni(table: string[], relazioni: Record<string, number[]>) {
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      const key = getRelKey(table[i], table[j]);
      if (!relazioni[key]) relazioni[key] = [];
      relazioni[key].push(getRelativePos(i, j));
    }
  }
}

export function generatePlanning(config: TournamentConfig, players: Player[]): { planning: HandAssignment[], relazioni: Record<string, number[]> } {
  const planning: HandAssignment[] = [];
  const relazioni: Record<string, number[]> = {};
  const playerIds = players.map(p => p.id);
  const restCounts: Record<string, number> = Object.fromEntries(playerIds.map(id => [id, 0]));
  const encounterCounts: Record<string, number> = {};
  const getPairKey = (id1: string, id2: string) => id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;

  const numTavoliMax = Math.floor(playerIds.length / 4);

  const generateSingleHand = (manoIdx: number, fase: 'social' | 'recupero', forcedNumTavoli?: number): HandAssignment => {
    const currentNumTavoli = forcedNumTavoli !== undefined ? forcedNumTavoli : numTavoliMax;
    
    const sortedForPlay = [...playerIds].sort((a, b) => {
      if (restCounts[b] !== restCounts[a]) return restCounts[b] - restCounts[a];
      return Math.random() - 0.5;
    });

    const currentManoTavoli: string[][] = [];
    const inGameIds: string[] = [];
    
    for (let t = 0; t < currentNumTavoli; t++) {
      if (sortedForPlay.length < 4) break;
      
      let table: string[] = [];
      table.push(sortedForPlay.shift()!);
      
      for (let slot = 1; slot < 4; slot++) {
        sortedForPlay.sort((a, b) => {
          if (restCounts[b] !== restCounts[a]) return restCounts[b] - restCounts[a];
          let scoreA = 0;
          let scoreB = 0;
          table.forEach(pInTable => {
            scoreA += (encounterCounts[getPairKey(pInTable, a)] || 0);
            scoreB += (encounterCounts[getPairKey(pInTable, b)] || 0);
          });
          return scoreA - scoreB;
        });
        table.push(sortedForPlay.shift()!);
      }

      const optimizedTable = optimizeTableSeating(table, relazioni, manoIdx, config);
      updateRelazioni(optimizedTable, relazioni);
      
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const pk = getPairKey(optimizedTable[i], optimizedTable[j]);
          encounterCounts[pk] = (encounterCounts[pk] || 0) + 1;
        }
      }
      
      currentManoTavoli.push(optimizedTable);
      inGameIds.push(...optimizedTable);
    }

    const riposanti = playerIds.filter(id => !inGameIds.includes(id));
    riposanti.forEach(id => restCounts[id]++);

    return { mano: manoIdx, tavoli: currentManoTavoli, riposanti, fase };
  };

  for (let m = 1; m <= config.maniFase1; m++) {
    planning.push(generateSingleHand(m, 'social'));
  }

  let currentManoIdx = config.maniFase1 + 1;
  const areRestsEqual = () => {
    const counts = Object.values(restCounts);
    return Math.max(...counts) === Math.min(...counts);
  };

  while (!areRestsEqual()) {
    const maxR = Math.max(...Object.values(restCounts));
    const luckyOnes = playerIds.filter(id => restCounts[id] >= maxR);
    const tablesInRecupero = Math.max(1, Math.min(numTavoliMax, Math.floor(luckyOnes.length / 4)));
    
    planning.push(generateSingleHand(currentManoIdx, 'recupero', tablesInRecupero));
    currentManoIdx++;
    if (currentManoIdx > config.maniFase1 + 20) break;
  }

  for (let m = 0; m < config.maniFase2; m++) {
    planning.push({
      mano: currentManoIdx + m,
      tavoli: [], 
      riposanti: [],
      fase: 'top'
    });
  }

  return { planning, relazioni };
}

export function generateNextTopHand(data: {
  config: TournamentConfig,
  giocatori: Player[],
  punteggi: Record<string, number>,
  storicoRelazioni: Record<string, number[]>,
  planningCompleto: HandAssignment[]
}, nextManoIdx: number): HandAssignment {
  const activePlayers = data.giocatori.filter(p => p.isEliminated !== true);
  const numTavoli = Math.floor(activePlayers.length / 4);
  const sortedPlayers = [...activePlayers].sort((a, b) => (data.punteggi[b.id] || 0) - (data.punteggi[a.id] || 0));
  const playerIdsByRank = sortedPlayers.map(p => p.id);

  const topHands = data.planningCompleto.filter(h => h.fase === 'top');
  const topHandStartIdx = data.planningCompleto.findIndex(h => h.fase === 'top');
  const currentTopHandIndex = nextManoIdx - topHandStartIdx; 
  const totalTopHands = topHands.length;

  let currentManoTavoli: string[][] = [];
  let availableToPlay = [...playerIdsByRank];

  // CASO 1: Prima mano della fase TOP (Ranking dei tavoli 1 4 2 3)
  if (currentTopHandIndex === 1) {
    while (currentManoTavoli.length < numTavoli && availableToPlay.length >= 4) {
      const tableSource = availableToPlay.splice(0, 4);
      // Ordine richiesto: 1-4-2-3 (indici 0, 3, 1, 2)
      const table = [tableSource[0], tableSource[3], tableSource[1], tableSource[2]];
      
      // Ottimizziamo le posizioni se hanno già occupato quel posto specifico nel tavolo (stessa pos relative)
      const optimized = optimizeTableSeating(table, data.storicoRelazioni, nextManoIdx, data.config, currentManoTavoli.length === 0);
      currentManoTavoli.push(optimized); 
    }
  } 
  // CASO 2: Ultime 3 mani della fase TOP
  else if (currentTopHandIndex > (totalTopHands - 3)) {
    const handFromEnd = totalTopHands - currentTopHandIndex; // 2, 1, 0
    
    // Tavolo 1: Schemi fissi
    let t1: string[] = [];
    const r1 = playerIdsByRank[0], r2 = playerIdsByRank[1], r3 = playerIdsByRank[2], r4 = playerIdsByRank[3];
    
    if (handFromEnd === 2) t1 = [r1, r3, r4, r2];      // Terzultima: 1 3 4 2
    else if (handFromEnd === 1) t1 = [r1, r2, r3, r4]; // Penultima: 1 2 3 4
    else t1 = [r1, r4, r2, r3];                        // Ultima: 1 4 2 3
    
    currentManoTavoli.push(t1);
    
    const remainingIds = playerIdsByRank.slice(4);
    const otherTablesCount = numTavoli - 1;
    if (otherTablesCount > 0) {
      const otherTables: string[][] = Array.from({ length: otherTablesCount }, () => []);
      remainingIds.forEach((pid, idx) => {
        const targetTableIdx = idx % otherTablesCount;
        if (otherTables[targetTableIdx].length < 4) {
          otherTables[targetTableIdx].push(pid);
        }
      });
      currentManoTavoli.push(...otherTables.filter(t => t.length === 4));
    }
    
    availableToPlay = remainingIds.filter(id => !currentManoTavoli.flat().includes(id));
  }
  // CASO 3: Mani centrali (Social)
  else {
    // Regola: i primi 4 del ranking NON si incontrano se ci sono 4 o più tavoli
    if (numTavoli >= 4) {
      const top4 = availableToPlay.splice(0, 4); // R1, R2, R3, R4
      const otherTables: string[][] = Array.from({ length: numTavoli }, () => []);
      
      // Mettiamo i primi 4 in tavoli diversi (T1, T2, T3, T4)
      otherTables[0].push(top4[0]);
      otherTables[1].push(top4[1]);
      otherTables[2].push(top4[2]);
      otherTables[3].push(top4[3]);

      // Riempiamo i tavoli con i restanti privilegiando incontri nuovi
      for (let tIdx = 0; tIdx < numTavoli; tIdx++) {
        while (otherTables[tIdx].length < 4 && availableToPlay.length > 0) {
          availableToPlay.sort((a, b) => {
            let conflictsA = 0;
            let conflictsB = 0;
            otherTables[tIdx].forEach(pInTable => {
              const keyA = a < pInTable ? `${a}:${pInTable}` : `${pInTable}:${a}`;
              const keyB = b < pInTable ? `${b}:${pInTable}` : `${pInTable}:${b}`;
              conflictsA += (data.storicoRelazioni[keyA]?.length || 0);
              conflictsB += (data.storicoRelazioni[keyB]?.length || 0);
            });
            return conflictsA - conflictsB;
          });
          otherTables[tIdx].push(availableToPlay.shift()!);
        }
      }

      // Ottimizziamo le sedute di ogni tavolo
      currentManoTavoli = otherTables.map(t => optimizeTableSeating(t, data.storicoRelazioni, nextManoIdx, data.config, false));
    } else {
      // Meno di 4 tavoli: social standard basata sul rank
      while (currentManoTavoli.length < numTavoli && availableToPlay.length >= 4) {
        let table: string[] = [];
        table.push(availableToPlay.shift()!);
        
        for (let slot = 1; slot < 4; slot++) {
          availableToPlay.sort((a, b) => {
            let conflictsA = 0;
            let conflictsB = 0;
            table.forEach(pInTable => {
              const keyA = a < pInTable ? `${a}:${pInTable}` : `${pInTable}:${a}`;
              const keyB = b < pInTable ? `${b}:${pInTable}` : `${pInTable}:${b}`;
              conflictsA += (data.storicoRelazioni[keyA]?.length || 0);
              conflictsB += (data.storicoRelazioni[keyB]?.length || 0);
            });
            return conflictsA - conflictsB;
          });
          table.push(availableToPlay.shift()!);
        }
        
        const optimizedTable = optimizeTableSeating(table, data.storicoRelazioni, nextManoIdx, data.config, currentManoTavoli.length === 0);
        currentManoTavoli.push(optimizedTable);
      }
    }
  }

  return {
    mano: nextManoIdx,
    tavoli: currentManoTavoli,
    riposanti: availableToPlay,
    fase: 'top'
  };
}
