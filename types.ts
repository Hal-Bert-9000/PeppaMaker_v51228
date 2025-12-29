
export interface Player {
  id: string;
  name: string;
  isEliminated: boolean;
}

export type TableScore = Record<string, number>;

export interface HandAssignment {
  mano: number;
  tavoli: string[][]; // Array di 4 IDs
  riposanti: string[]; 
  fase: 'social' | 'recupero' | 'top';
}

export interface TournamentConfig {
  numGiocatori: number;
  maniFase1: number;
  maniFase2: number;
  numEliminatiDopoFase1: number;
  testMode: boolean;
  recoveryPosition: 'start' | 'end';
}

export interface TournamentData {
  tournamentName: string;
  config: TournamentConfig;
  giocatori: Player[];
  punteggi: Record<string, number>;
  storicoPunteggi: Record<string, number[]>;
  manoAttuale: number;
  planningCompleto: HandAssignment[];
  status: 'setup' | 'planning' | 'live' | 'finished';
  storicoRelazioni: Record<string, number[]>;
  cappotti: string[];
  rotationPattern?: 'DS-C' | 'DSC-'; 
}
