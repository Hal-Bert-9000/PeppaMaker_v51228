
let state = {
    config: { total: 22, elim: 2, socialMani: 11, topMani: 4 },
    players: [], // {id, name, isEliminated}
    punteggi: {},
    storicoPunteggi: {},
    planning: [], // {mano, tavoli, riposanti, fase}
    manoAttuale: 1,
    status: 'setup'
};

const UI = {
    setup: document.getElementById('view-setup'),
    dashboard: document.getElementById('view-dashboard'),
    info: document.getElementById('tournament-info'),
    tavoli: document.getElementById('content-tavoli'),
    classifica: document.getElementById('content-classifica'),
    planning: document.getElementById('content-planning'),
    btnSave: document.getElementById('btn-save-hand')
};

// --- API ---
async function fetchState() {
    const res = await fetch('api.php');
    const data = await res.json();
    if (data) {
        state = data;
        render();
    }
}

async function pushState() {
    await fetch('api.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
    });
}

// --- LOGICA TORNEO ---
function startTournament() {
    const nameInput = document.getElementById('setup-names').value.trim();
    const total = parseInt(document.getElementById('setup-total').value);
    const elim = parseInt(document.getElementById('setup-elim').value);
    
    let names = nameInput.split('\n').map(n => n.trim()).filter(n => n);
    if (names.length === 0) {
        for(let i=1; i<=total; i++) names.push(`Giocatore ${i}`);
    } else if (names.length !== total) {
        alert(`Inserisci esattamente ${total} nomi.`);
        return;
    }

    state.players = names.map((n, i) => ({ id: `p${i}`, name: n, isEliminated: false }));
    state.punteggi = Object.fromEntries(state.players.map(p => [p.id, 0]));
    state.storicoPunteggi = Object.fromEntries(state.players.map(p => [p.id, [0]]));
    state.config = { total, elim, socialMani: 11, topMani: 4 };
    state.status = 'live';
    state.manoAttuale = 1;
    
    generateInitialPlanning();
    pushState();
    render();
}

function generateInitialPlanning() {
    // Generazione Fase Social (Mani 1-11) per 22 giocatori
    // 5 Tavoli da 4 + 2 Riposanti
    state.planning = [];
    const ids = state.players.map(p => p.id);
    const restCounts = Object.fromEntries(ids.map(id => [id, 0]));

    for (let m = 1; m <= state.config.socialMani; m++) {
        let pool = [...ids];
        // Bilanciamento riposi semplice per l'esempio
        pool.sort((a, b) => restCounts[b] - restCounts[a]);
        
        let inGame = pool.slice(0, 20);
        let riposanti = pool.slice(20);
        riposanti.forEach(id => restCounts[id]++);

        let tavoli = [];
        for (let t = 0; t < 5; t++) {
            tavoli.push(inGame.splice(0, 4));
        }
        state.planning.push({ mano: m, tavoli, riposanti, fase: 'social' });
    }
}

function generateTopHand(manoIdx) {
    const survivors = state.players.filter(p => !p.isEliminated);
    survivors.sort((a, b) => state.punteggi[b.id] - state.punteggi[a.id]);
    
    // 20 giocatori -> 5 tavoli, 0 riposanti
    const ids = survivors.map(p => p.id);
    let tavoli = [];
    for (let t = 0; t < 5; t++) {
        tavoli.push(ids.splice(0, 4));
    }
    return { mano: manoIdx, tavoli, riposanti: [], fase: 'top' };
}

function saveHand() {
    const currentMano = state.planning[state.manoAttuale - 1];
    const inputs = document.querySelectorAll('.score-input');
    const tableScores = {};

    // Verifica somme
    for (let t = 0; t < currentMano.tavoli.length; t++) {
        let sum = 0;
        currentMano.tavoli[t].forEach(pid => {
            const val = parseInt(document.getElementById(`score-${t}-${pid}`).value) || 0;
            sum += val;
        });
        if (sum !== 0) {
            alert(`Errore Tavolo ${t+1}: la somma deve essere 0 (attuale: ${sum})`);
            return;
        }
    }

    // Aggiornamento punteggi
    currentMano.tavoli.forEach((table, tIdx) => {
        table.forEach(pid => {
            const val = parseInt(document.getElementById(`score-${tIdx}-${pid}`).value) || 0;
            state.punteggi[pid] += val;
            state.storicoPunteggi[pid].push(state.punteggi[pid]);
        });
    });

    // Gestione Riposanti per lo storico
    currentMano.riposanti.forEach(pid => {
        state.storicoPunteggi[pid].push(state.punteggi[pid]);
    });

    // Check Fine Fase Social
    if (state.manoAttuale === state.config.socialMani) {
        const sorted = [...state.players].sort((a, b) => state.punteggi[b.id] - state.punteggi[a.id]);
        const losers = sorted.slice(sorted.length - state.config.elim);
        losers.forEach(p => p.isEliminated = true);
        
        document.getElementById('elim-list').innerHTML = losers.map(p => `<div class="bg-rose-500/10 border border-rose-500/20 py-4 px-6 rounded-2xl text-rose-400 font-black text-xl">${p.name}</div>`).join('');
        document.getElementById('modal-elim').classList.remove('hidden');
    }

    // Genera prossima mano se fase TOP
    if (state.manoAttuale >= state.config.socialMani && state.manoAttuale < (state.config.socialMani + state.config.topMani)) {
        state.planning.push(generateTopHand(state.manoAttuale + 1));
    }

    if (state.manoAttuale === (state.config.socialMani + state.config.topMani)) {
        state.status = 'finished';
    } else {
        state.manoAttuale++;
    }

    pushState();
    render();
    switchTab('classifica');
}

// --- RENDERING ---
function render() {
    if (state.status === 'setup') {
        UI.setup.classList.remove('hidden');
        UI.dashboard.classList.add('hidden');
        return;
    }

    UI.setup.classList.add('hidden');
    UI.dashboard.classList.remove('hidden');
    UI.info.innerText = `Mano ${state.manoAttuale} / ${state.config.socialMani + state.config.topMani} • ${state.status.toUpperCase()}`;
    
    lucide.createIcons();
    renderTavoli();
    renderClassifica();
    renderPlanning();
}

function renderTavoli() {
    const mano = state.planning[state.manoAttuale - 1];
    if (!mano || state.status === 'finished') {
        UI.tavoli.innerHTML = `<div class="col-span-full text-center py-20 text-emerald-400 font-black text-4xl">TORNEO CONCLUSO</div>`;
        UI.btnSave.classList.add('hidden');
        return;
    }

    UI.tavoli.innerHTML = mano.tavoli.map((table, tIdx) => `
        <div class="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div class="bg-slate-800/50 p-4 border-b border-slate-800 flex justify-between">
                <span class="font-black text-xs text-slate-500 uppercase tracking-widest">TAVOLO ${tIdx + 1}</span>
                <button onclick="autoBalance(${tIdx})" class="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-lg border border-emerald-500/20 font-bold">BILANCIA</button>
            </div>
            <div class="p-6 space-y-4">
                ${table.map(pid => {
                    const p = state.players.find(x => x.id === pid);
                    return `
                    <div class="flex items-center justify-between gap-4">
                        <div class="min-w-0 flex-1">
                            <div class="font-bold text-white truncate">${p.name}</div>
                            <div class="text-[10px] text-slate-500 font-mono">Tot: ${state.punteggi[pid]}</div>
                        </div>
                        <input type="number" id="score-${tIdx}-${pid}" class="score-input w-20 bg-slate-950 border border-slate-700 rounded-xl p-2 text-center font-black text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0">
                    </div>
                    `;
                }).join('')}
            </div>
        </div>
    `).join('');
}

function renderClassifica() {
    const sorted = [...state.players].sort((a, b) => state.punteggi[b.id] - state.punteggi[a.id]);
    UI.classifica.innerHTML = `
        <table class="w-full">
            <thead class="bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <tr>
                    <th class="p-4 text-left">Pos</th>
                    <th class="p-4 text-left">Giocatore</th>
                    <th class="p-4 text-right">Punti</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
                ${sorted.map((p, i) => `
                    <tr class="${p.isEliminated ? 'opacity-30' : ''}">
                        <td class="p-4"><span class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-xs">${i+1}</span></td>
                        <td class="p-4 font-bold text-slate-200">${p.name} ${p.isEliminated ? '<span class="text-[8px] bg-rose-500/20 text-rose-500 px-1.5 py-0.5 rounded ml-2">ELIM</span>' : ''}</td>
                        <td class="p-4 text-right font-black text-emerald-400 text-xl font-mono">${state.punteggi[p.id]}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderPlanning() {
    UI.planning.innerHTML = `
        <table class="w-full text-[10px] border-collapse">
            <thead>
                <tr class="bg-slate-800">
                    <th class="p-2 border border-slate-700">Mano</th>
                    <th class="p-2 border border-slate-700">T1</th>
                    <th class="p-2 border border-slate-700">T2</th>
                    <th class="p-2 border border-slate-700">T3</th>
                    <th class="p-2 border border-slate-700">T4</th>
                    <th class="p-2 border border-slate-700">T5</th>
                    <th class="p-2 border border-slate-700">Riposo</th>
                </tr>
            </thead>
            <tbody>
                ${state.planning.map(m => `
                    <tr class="${m.mano === state.manoAttuale ? 'bg-emerald-500/10' : ''}">
                        <td class="p-2 border border-slate-800 font-bold text-center">${m.mano}</td>
                        ${[0,1,2,3,4].map(tIdx => `
                            <td class="p-1 border border-slate-800 text-center">
                                ${m.tavoli[tIdx] ? m.tavoli[tIdx].map(pid => state.players.find(x => x.id === pid).name.substring(0,6)).join('<br>') : '-'}
                            </td>
                        `).join('')}
                        <td class="p-1 border border-slate-800 italic text-slate-500">
                            ${m.riposanti.map(pid => state.players.find(x => x.id === pid).name).join(', ')}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// --- UTILS ---
function switchTab(tab) {
    ['tavoli', 'classifica', 'planning'].forEach(t => {
        document.getElementById(`content-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('tab-active');
    });
    document.getElementById(`content-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('tab-active');
}

function autoBalance(tIdx) {
    const mano = state.planning[state.manoAttuale-1];
    const table = mano.tavoli[tIdx];
    let sum = 0;
    let emptyId = null;

    table.forEach(pid => {
        const val = parseInt(document.getElementById(`score-${tIdx}-${pid}`).value);
        if (isNaN(val)) emptyId = pid;
        else sum += val;
    });

    if (emptyId) {
        document.getElementById(`score-${tIdx}-${emptyId}`).value = -sum;
    }
}

function closeModal() {
    document.getElementById('modal-elim').classList.add('hidden');
}

function resetTournament() {
    if(confirm("Vuoi davvero resettare tutto?")) {
        state.status = 'setup';
        pushState();
        render();
    }
}

// Init
fetchState();
lucide.createIcons();
