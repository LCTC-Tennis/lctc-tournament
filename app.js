// ==========================================================================
// CONSTANTS & CONFIGURATION
// ==========================================================================

const RANK_VALUES = {
    "NC": 0,
    "40": 1,
    "30/5": 2,
    "30/4": 3,
    "30/3": 4,
    "30/2": 5,
    "30/1": 6,
    "30": 7,
    "15/5": 8,
    "15/4": 9,
    "15/3": 10,
    "15/2": 11,
    "15/1": 12,
    "15": 13,
    "5/6": 14,
    "4/6": 15,
    "3/6": 16,
    "2/6": 17,
    "1/6": 18,
    "0": 19,
    "-2/6": 20,
    "-4/6": 21,
    "-15": 22
};

const DEMO_PLAYERS_12 = [
    { lastname: "Giraldi", firstname: "David", rank: "15/2" },
    { lastname: "Martinet", firstname: "Etienne", rank: "15/3" },
    { lastname: "Aubert", firstname: "Julien", rank: "15/5" },
    { lastname: "Rousseau", firstname: "Nicolas", rank: "30" },
    { lastname: "Blanc", firstname: "Sébastien", rank: "30/1" },
    { lastname: "Mathieu", firstname: "Lucas", rank: "30/2" },
    { lastname: "Guerin", firstname: "Thomas", rank: "30/3" },
    { lastname: "Caron", firstname: "Pierre", rank: "30/4" },
    { lastname: "Chevalier", firstname: "Hugo", rank: "30/5" },
    { lastname: "Fontaine", firstname: "Marc", rank: "40" },
    { lastname: "Vidal", firstname: "Thierry", rank: "NC" },
    { lastname: "Gerard", firstname: "Olivier", rank: "NC" }
];

const DEMO_PLAYERS_16 = [
    { lastname: "Giraldi", firstname: "David", rank: "15" },
    { lastname: "Martinet", firstname: "Etienne", rank: "15/1" },
    { lastname: "Dubois", firstname: "Jérôme", rank: "15/2" },
    { lastname: "Aubert", firstname: "Julien", rank: "15/3" },
    { lastname: "Rousseau", firstname: "Nicolas", rank: "15/5" },
    { lastname: "Blanc", firstname: "Sébastien", rank: "30" },
    { lastname: "Mathieu", firstname: "Lucas", rank: "30/1" },
    { lastname: "Guerin", firstname: "Thomas", rank: "30/2" },
    { lastname: "Caron", firstname: "Pierre", rank: "30/3" },
    { lastname: "Chevalier", firstname: "Hugo", rank: "30/4" },
    { lastname: "Fontaine", firstname: "Marc", rank: "30/5" },
    { lastname: "Vidal", firstname: "Thierry", rank: "40" },
    { lastname: "Gerard", firstname: "Olivier", rank: "NC" },
    { lastname: "Leroy", firstname: "Alexandre", rank: "NC" },
    { lastname: "Moreau", firstname: "Damien", rank: "NC" },
    { lastname: "Lefevre", firstname: "Stéphane", rank: "NC" }
];

// ==========================================================================
// STATE MANAGEMENT
// ==========================================================================

let appState = {
    activeTournamentId: "",
    tournaments: []
};

let state = null; // will reference the active tournament
let supabase = null;
let supabaseConfig = null; // { url, key }

// Load Supabase configuration
function loadSupabaseConfig() {
    // Check URL parameters for one-click setup
    const urlParams = new URLSearchParams(window.location.search);
    const paramUrl = urlParams.get('sb_url');
    const paramKey = urlParams.get('sb_key');
    
    if (paramUrl && paramKey) {
        const config = { url: decodeURIComponent(paramUrl), key: decodeURIComponent(paramKey) };
        localStorage.setItem("tc_la_ciotat_supabase_config", JSON.stringify(config));
        // Clear URL parameters to keep it clean in the address bar
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const saved = localStorage.getItem("tc_la_ciotat_supabase_config");
    if (saved) {
        try {
            supabaseConfig = JSON.parse(saved);
            if (supabaseConfig && supabaseConfig.url && supabaseConfig.key) {
                if (window.supabase) {
                    supabase = window.supabase.createClient(supabaseConfig.url, supabaseConfig.key);
                } else {
                    console.error("Le SDK Supabase n'a pas pu être chargé (window.supabase est indéfini).");
                }
            }
        } catch (e) {
            console.error("Erreur lors de la lecture de la configuration Supabase :", e);
        }
    }
}

// Update the Supabase status indicator badge in the UI
async function updateSupabaseStatus() {
    const badge = document.getElementById("supabase-status-badge");
    const dot = document.getElementById("supabase-status-dot");
    const text = document.getElementById("supabase-status-text");
    
    if (!badge || !dot || !text) return;
    
    if (!supabase) {
        dot.style.color = "#94a3b8"; // grey
        text.textContent = "Local";
        badge.style.borderColor = "rgba(255,255,255,0.1)";
        badge.style.color = "#94a3b8";
        return;
    }
    
    try {
        const { data, error } = await supabase.from('tournaments').select('id').limit(1);
        if (error) throw error;
        
        dot.style.color = "#22c55e"; // green
        text.textContent = "Cloud";
        badge.style.borderColor = "rgba(34,197,94,0.3)";
        badge.style.color = "#22c55e";
    } catch (err) {
        console.error("Erreur de connexion Supabase :", err);
        dot.style.color = "#ef4444"; // red
        text.textContent = "Erreur";
        badge.style.borderColor = "rgba(239,68,68,0.3)";
        badge.style.color = "#ef4444";
    }
}

// Upload/Sync a single tournament to Supabase
async function syncTournamentToSupabase(t) {
    if (!supabase) return;
    try {
        const { error } = await supabase.from('tournaments').upsert({
            id: t.id,
            name: t.name,
            data: t,
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
    } catch (e) {
        console.error(`Erreur d'upsert pour le tournoi ${t.id} :`, e);
    }
}

// Fetch and sync tournaments from Supabase
async function syncFromSupabase() {
    if (!supabase) return;
    try {
        const { data, error } = await supabase.from('tournaments').select('*');
        if (error) throw error;
        
        if (data && data.length > 0) {
            appState.tournaments = data.map(item => item.data);
            const exists = appState.tournaments.some(t => t.id === appState.activeTournamentId);
            if (!exists && appState.tournaments.length > 0) {
                appState.activeTournamentId = appState.tournaments[0].id;
            }
            localStorage.setItem("tc_la_ciotat_app_state", JSON.stringify(appState));
            state = appState.tournaments.find(t => t.id === appState.activeTournamentId);
        } else {
            // Push local state if remote is empty
            for (const t of appState.tournaments) {
                await syncTournamentToSupabase(t);
            }
        }
    } catch (e) {
        console.error("Erreur lors de la synchronisation depuis Supabase :", e);
    }
}

// Generate UUID for players & matches
function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

// Save state to LocalStorage (and Supabase if connected)
function saveState() {
    localStorage.setItem("tc_la_ciotat_app_state", JSON.stringify(appState));
    if (supabase && state) {
        syncTournamentToSupabase(state).catch(err => {
            console.error("Erreur sync auto Supabase :", err);
        });
    }
}

// Load state from LocalStorage
function loadState() {
    const saved = localStorage.getItem("tc_la_ciotat_app_state");
    if (saved) {
        try {
            appState = JSON.parse(saved);
        } catch (e) {
            console.error("Erreur lors de la lecture de la sauvegarde :", e);
        }
    }

    if (!appState || !appState.tournaments || appState.tournaments.length === 0) {
        const defaultId = "t_" + generateId();
        appState = {
            activeTournamentId: defaultId,
            tournaments: [
                {
                    id: defaultId,
                    name: "Tournoi d'Été 2026",
                    type: "pools", // "pools" | "progressive"
                    algorithm: "homogeneous",
                    qualifiersPerPool: 2,
                    matchFormat: "classic",
                    bracketConfig: null,
                    players: [],
                    pools: [],
                    matches: {},
                    bracket: null,
                    stage: "config"
                }
            ]
        };
    }

    state = appState.tournaments.find(t => t.id === appState.activeTournamentId);
    if (!state) {
        state = appState.tournaments[0];
        appState.activeTournamentId = state.id;
    }
    return true;
}

// ==========================================================================
// INITIALIZATION & DOM CACHING
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    // Cache DOM Elements
    const dom = {
        tournamentSelector: document.getElementById("tournament-selector"),
        btnNewTournament: document.getElementById("btn-new-tournament"),
        btnDeleteTournament: document.getElementById("btn-delete-tournament"),
        tournamentName: document.getElementById("tournament-name"),
        tournamentType: document.getElementById("tournament-type"),
        poolAlgorithm: document.getElementById("pool-algorithm"),
        poolAlgorithmGroup: document.getElementById("pool-algorithm-group"),
        qualifiersPerPool: document.getElementById("qualifiers-per-pool"),
        qualifiersGroup: document.getElementById("qualifiers-group"),
        matchFormat: document.getElementById("match-format"),
        addPlayerForm: document.getElementById("add-player-form"),
        playerLastname: document.getElementById("player-lastname"),
        playerFirstname: document.getElementById("player-firstname"),
        playerRank: document.getElementById("player-rank"),
        playerCount: document.getElementById("player-count"),
        playersTbody: document.getElementById("players-tbody"),
        playersEmptyState: document.getElementById("players-empty-state"),
        poolInfoBadge: document.getElementById("pool-info-badge"),
        btnGeneratePools: document.getElementById("btn-generate-pools"),
        
        btnDemo12: document.getElementById("btn-demo-12"),
        btnDemo16: document.getElementById("btn-demo-16"),
        btnExport: document.getElementById("btn-export"),
        btnImportTrigger: document.getElementById("btn-import-trigger"),
        btnImport: document.getElementById("btn-import"),
        btnReset: document.getElementById("btn-reset"),

        // Tabs
        tabBtns: document.querySelectorAll(".tab-btn"),
        tabPanes: document.querySelectorAll(".tab-pane"),
        btnTabPools: document.getElementById("btn-tab-pools"),
        btnTabBracket: document.getElementById("btn-tab-bracket"),

        // Stage Buttons
        btnBackToConfig: document.getElementById("btn-back-to-config"),
        btnGenerateBracket: document.getElementById("btn-generate-bracket"),
        btnBackToPools: document.getElementById("btn-back-to-pools"),
        btnPrint: document.getElementById("btn-print"),
        btnToggleBracketConfig: document.getElementById("btn-toggle-bracket-config"),

        // Containers
        poolsContainer: document.getElementById("pools-container"),
        bracketContainer: document.getElementById("bracket-container"),
        bracketConfigPanel: document.getElementById("bracket-config-panel"),
        bracketConfigMatchesContainer: document.getElementById("bracket-config-matches-container"),

        // Score Modal
        scoreModal: document.getElementById("score-modal"),
        modalMatchTitle: document.getElementById("modal-match-title"),
        modalMatchFormatBadge: document.getElementById("modal-match-format-badge"),
        modalP1Name: document.getElementById("modal-p1-name"),
        modalP2Name: document.getElementById("modal-p2-name"),
        scoreP1S1: document.getElementById("score-p1-s1"),
        scoreP1S2: document.getElementById("score-p1-s2"),
        scoreP1S3: document.getElementById("score-p1-s3"),
        scoreP2S1: document.getElementById("score-p2-s1"),
        scoreP2S2: document.getElementById("score-p2-s2"),
        scoreP2S3: document.getElementById("score-p2-s3"),
        woP1: document.getElementById("wo-p1"),
        woP2: document.getElementById("wo-p2"),
        btnSaveScore: document.getElementById("btn-save-score"),
        btnClearScore: document.getElementById("btn-clear-score"),
        btnCloseModal: document.getElementById("btn-close-modal"),

        // Winner Modal
        winnerModal: document.getElementById("winner-modal"),
        winnerFullname: document.getElementById("winner-fullname"),
        winnerStatsDetails: document.getElementById("winner-stats-details"),
        btnCloseWinner: document.getElementById("btn-close-winner"),

        // Supabase Configuration
        btnSupabaseConfig: document.getElementById("btn-supabase-config"),
        supabaseStatusBadge: document.getElementById("supabase-status-badge"),
        supabaseStatusDot: document.getElementById("supabase-status-dot"),
        supabaseStatusText: document.getElementById("supabase-status-text"),
        supabaseModal: document.getElementById("supabase-modal"),
        btnCloseSupabase: document.getElementById("btn-close-supabase"),
        supabaseUrl: document.getElementById("supabase-url"),
        supabaseKey: document.getElementById("supabase-key"),
        btnClearSupabase: document.getElementById("btn-clear-supabase"),
        btnSaveSupabase: document.getElementById("btn-save-supabase")
    };

    // Load Initial State
    loadState();
    loadSupabaseConfig();
    initUIFromActiveTournament();

    if (supabase) {
        updateSupabaseStatus();
        syncFromSupabase().then(() => {
            initUIFromActiveTournament();
            updateSupabaseStatus();
        });
    }

    // ----------------------------------------------------------------------
    // EVENT LISTENERS: Configuration
    // ----------------------------------------------------------------------

    function initUIFromActiveTournament() {
        if (!state) return;
        
        dom.tournamentName.value = state.name || "";
        dom.tournamentType.value = state.type || "pools";
        dom.poolAlgorithm.value = state.algorithm || "homogeneous";
        dom.qualifiersPerPool.value = (state.qualifiersPerPool || 2).toString();
        dom.matchFormat.value = state.matchFormat || "classic";

        // Show/hide based on tournament type
        if (state.type === "progressive") {
            dom.poolAlgorithmGroup.style.display = "none";
            dom.qualifiersGroup.style.display = "none";
            dom.btnTabPools.style.display = "none";
            dom.btnTabBracket.querySelector("span").textContent = "Tableau Progressif";
            dom.btnGeneratePools.querySelector("span").textContent = "Générer le Tableau Direct";
        } else {
            dom.poolAlgorithmGroup.style.display = "block";
            dom.qualifiersGroup.style.display = "block";
            dom.btnTabPools.style.display = "inline-flex";
            dom.btnTabBracket.querySelector("span").textContent = "3. Tableau Final";
            dom.btnGeneratePools.querySelector("span").textContent = "Générer les Poules";
        }

        renderTournamentSelector();
        renderPlayersList();
        updateNavigationButtons();

        // Switch to active stage
        if (state.stage === "pools" && state.type !== "progressive") {
            switchTab("tab-pools");
            renderPoolsStage();
        } else if (state.stage === "bracket") {
            switchTab("tab-bracket");
            if (state.type !== "progressive") {
                renderPoolsStage();
            }
            renderBracketStage();
        } else {
            switchTab("tab-config");
        }
    }

    function renderTournamentSelector() {
        dom.tournamentSelector.innerHTML = "";
        appState.tournaments.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = t.name + (t.type === 'progressive' ? ' (Ten\'Up)' : ' (Poules)');
            if (t.id === appState.activeTournamentId) {
                opt.selected = true;
            }
            dom.tournamentSelector.appendChild(opt);
        });
    }

    // Switch tournament
    dom.tournamentSelector.addEventListener("change", (e) => {
        appState.activeTournamentId = e.target.value;
        state = appState.tournaments.find(t => t.id === appState.activeTournamentId);
        saveState();
        initUIFromActiveTournament();
    });

    // New tournament
    dom.btnNewTournament.addEventListener("click", () => {
        const name = prompt("Nom du nouveau tournoi :", "Nouveau Tournoi");
        if (!name) return;
        
        const type = confirm("Créer en mode 'Élimination Directe Progressive (Ten\'Up)' ?\n(Annuler pour le mode standard 'Poules + Tableau Final')") ? "progressive" : "pools";
        
        const newId = "t_" + generateId();
        const newT = {
            id: newId,
            name: name,
            type: type,
            algorithm: "homogeneous",
            qualifiersPerPool: 2,
            matchFormat: "classic",
            bracketConfig: null,
            players: [],
            pools: [],
            matches: {},
            bracket: null,
            stage: "config"
        };
        appState.tournaments.push(newT);
        appState.activeTournamentId = newId;
        state = newT;
        saveState();
        
        initUIFromActiveTournament();
    });

    // Delete tournament
    dom.btnDeleteTournament.addEventListener("click", () => {
        if (appState.tournaments.length <= 1) {
            alert("Impossible de supprimer le seul tournoi restant. Créez-en un autre d'abord.");
            return;
        }
        if (confirm(`Êtes-vous sûr de vouloir supprimer le tournoi "${state.name}" ? Toutes les données seront perdues définitivement.`)) {
            const idToDelete = state.id;
            appState.tournaments = appState.tournaments.filter(t => t.id !== state.id);
            appState.activeTournamentId = appState.tournaments[0].id;
            state = appState.tournaments[0];
            saveState();
            
            if (supabase) {
                supabase.from('tournaments').delete().eq('id', idToDelete).catch(err => {
                    console.error("Erreur de suppression du tournoi distant :", err);
                });
            }
            
            initUIFromActiveTournament();
        }
    });

    // Tournament Name Edit
    dom.tournamentName.addEventListener("input", (e) => {
        state.name = e.target.value.trim() || "Tournoi d'Été 2026";
        saveState();
        renderTournamentSelector();
    });

    // Tournament Type Change
    dom.tournamentType.addEventListener("change", (e) => {
        state.type = e.target.value;
        if (state.type === "progressive") {
            dom.poolAlgorithmGroup.style.display = "none";
            dom.qualifiersGroup.style.display = "none";
            dom.btnTabPools.style.display = "none";
            dom.btnTabBracket.querySelector("span").textContent = "Tableau Progressif";
            dom.btnGeneratePools.querySelector("span").textContent = "Générer le Tableau Direct";
        } else {
            dom.poolAlgorithmGroup.style.display = "block";
            dom.qualifiersGroup.style.display = "block";
            dom.btnTabPools.style.display = "inline-flex";
            dom.btnTabBracket.querySelector("span").textContent = "3. Tableau Final";
            dom.btnGeneratePools.querySelector("span").textContent = "Générer les Poules";
        }
        saveState();
        renderTournamentSelector();
        updateNavigationButtons();
    });

    // Options changes
    dom.poolAlgorithm.addEventListener("change", (e) => {
        state.algorithm = e.target.value;
        saveState();
    });

    dom.qualifiersPerPool.addEventListener("change", (e) => {
        state.qualifiersPerPool = parseInt(e.target.value);
        saveState();
    });

    dom.matchFormat.addEventListener("change", (e) => {
        state.matchFormat = e.target.value;
        saveState();
    });

    dom.btnToggleBracketConfig.addEventListener("click", () => {
        const isHidden = dom.bracketConfigPanel.style.display === "none";
        dom.bracketConfigPanel.style.display = isHidden ? "block" : "none";
    });

    // Add Player Form
    dom.addPlayerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        
        const lastname = dom.playerLastname.value.trim().toUpperCase();
        const firstname = dom.playerFirstname.value.trim();
        const rank = dom.playerRank.value;

        if (lastname && firstname) {
            state.players.push({
                id: generateId(),
                lastname,
                firstname,
                rank,
                rankValue: RANK_VALUES[rank] || 0
            });

            dom.playerLastname.value = "";
            dom.playerFirstname.value = "";
            dom.playerRank.selectedIndex = 0;
            dom.playerLastname.focus();

            renderPlayersList();
            saveState();
        }
    });

    // Action Buttons: Demo
    dom.btnDemo12.addEventListener("click", () => {
        loadDemoPlayers(DEMO_PLAYERS_12);
    });

    dom.btnDemo16.addEventListener("click", () => {
        loadDemoPlayers(DEMO_PLAYERS_16);
    });

    // Reset Tournament
    dom.btnReset.addEventListener("click", () => {
        if (confirm("Êtes-vous sûr de vouloir réinitialiser tout le tournoi ? Toutes les données et scores saisis seront perdus !")) {
            const newT = {
                id: state.id,
                name: "Tournoi d'Été 2026",
                type: "pools",
                algorithm: "homogeneous",
                qualifiersPerPool: 2,
                matchFormat: "classic",
                bracketConfig: null,
                players: [],
                pools: [],
                matches: {},
                bracket: null,
                stage: "config"
            };
            const idx = appState.tournaments.findIndex(t => t.id === state.id);
            if (idx !== -1) {
                appState.tournaments[idx] = newT;
            }
            state = newT;
            saveState();
            initUIFromActiveTournament();
        }
    });

    // Export JSON
    dom.btnExport.addEventListener("click", () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        const nameClean = (state.name || "tournoi").toLowerCase().replace(/[^a-z0-9]/g, "_");
        const fileName = `${nameClean}_sauvegarde.json`;
        downloadAnchor.setAttribute("download", fileName);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // Import JSON
    dom.btnImportTrigger.addEventListener("click", () => {
        dom.btnImport.click();
    });

    dom.btnImport.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const importedState = JSON.parse(evt.target.result);
                if (importedState && Array.isArray(importedState.players)) {
                    importedState.id = state.id; // Keep current ID
                    const idx = appState.tournaments.findIndex(t => t.id === state.id);
                    if (idx !== -1) {
                        appState.tournaments[idx] = importedState;
                    }
                    state = importedState;
                    saveState();
                    initUIFromActiveTournament();
                    alert("Importation réussie avec succès !");
                } else {
                    alert("Le fichier JSON fourni ne semble pas être une sauvegarde de tournoi valide.");
                }
            } catch (err) {
                alert("Erreur de lecture du fichier JSON.");
            }
        };
        reader.readAsText(file);
        dom.btnImport.value = "";
    });

    // Generate Pools or Progressive Bracket
    dom.btnGeneratePools.addEventListener("click", () => {
        if (state.type === "progressive") {
            if (state.players.length < 2) {
                alert("Minimum 2 joueurs requis pour générer le tableau.");
                return;
            }
            if (confirm("Générer le tableau direct ? Cette action écrasera tout tableau ou match existant dans ce tournoi.")) {
                generateProgressiveBracket();
            }
        } else {
            const count = state.players.length;
            if (count < 3) {
                alert("Minimum 3 joueurs requis pour générer les poules.");
                return;
            }
            if (confirm("Générer les poules ? Cette action écrasera toutes les poules ou matchs existants dans ce tournoi.")) {
                generatePools();
                state.stage = "pools";
                saveState();
                switchTab("tab-pools");
                renderPoolsStage();
                updateNavigationButtons();
            }
        }
    });

    // ----------------------------------------------------------------------
    // EVENT LISTENERS: Navigation / Stages
    // ----------------------------------------------------------------------

    dom.tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabId = btn.getAttribute("data-tab");
            switchTab(tabId);
        });
    });

    dom.btnBackToConfig.addEventListener("click", () => {
        const stageDesc = state.type === "progressive" ? "le tableau" : "les poules";
        if (confirm(`Retourner à la configuration des joueurs supprimera ${stageDesc} et scores déjà saisis. Continuer ?`)) {
            state.pools = [];
            state.matches = {};
            state.bracket = null;
            state.stage = "config";
            saveState();
            initUIFromActiveTournament();
        }
    });

    dom.btnGenerateBracket.addEventListener("click", () => {
        const unplayedMatches = Object.values(state.matches).filter(m => !m.played);
        if (unplayedMatches.length > 0) {
            if (!confirm(`Attention, il reste ${unplayedMatches.length} match(s) non joué(s) dans la phase de poules. Souhaitez-vous quand même lancer le Tableau Final ? (Les classements actuels seront utilisés)`)) {
                return;
            }
        }

        generateBracket();
        state.stage = "bracket";
        saveState();

        switchTab("tab-bracket");
        renderBracketStage();
        updateNavigationButtons();
    });

    dom.btnBackToPools.addEventListener("click", () => {
        if (state.type === "progressive") {
            state.stage = "config";
            saveState();
            initUIFromActiveTournament();
        } else {
            if (confirm("Retourner à la phase de poules ? Les résultats déjà saisis dans le Tableau Final seront conservés, mais si vous modifiez des scores de poules, le tableau ne sera pas mis à jour automatiquement sans régénération.")) {
                state.stage = "pools";
                saveState();
                switchTab("tab-pools");
                updateNavigationButtons();
            }
        }
    });

    dom.btnPrint.addEventListener("click", () => {
        window.print();
    });

    // ----------------------------------------------------------------------
    // EVENT LISTENERS: Score Entry Modal
    // ----------------------------------------------------------------------

    dom.btnCloseModal.addEventListener("click", closeScoreModal);
    dom.scoreModal.addEventListener("click", (e) => {
        if (e.target === dom.scoreModal) closeScoreModal();
    });

    // Supabase Configuration Event Listeners
    if (dom.btnSupabaseConfig && dom.supabaseModal) {
        dom.btnSupabaseConfig.addEventListener("click", () => {
            dom.supabaseModal.classList.add("active");
            dom.supabaseUrl.value = (supabaseConfig && supabaseConfig.url) ? supabaseConfig.url : "https://dhnlbczcwovvlpgsjbxb.supabase.co";
            dom.supabaseKey.value = (supabaseConfig && supabaseConfig.key) ? supabaseConfig.key : "";
        });
    }

    if (dom.btnCloseSupabase && dom.supabaseModal) {
        dom.btnCloseSupabase.addEventListener("click", () => {
            dom.supabaseModal.classList.remove("active");
        });
    }

    if (dom.supabaseModal) {
        dom.supabaseModal.addEventListener("click", (e) => {
            if (e.target === dom.supabaseModal) {
                dom.supabaseModal.classList.remove("active");
            }
        });
    }

    if (dom.btnSaveSupabase && dom.supabaseModal) {
        dom.btnSaveSupabase.addEventListener("click", () => {
            const url = dom.supabaseUrl.value.trim();
            const key = dom.supabaseKey.value.trim();
            if (!url || !key) {
                alert("Veuillez renseigner l'URL et la Anon Key de votre projet Supabase.");
                return;
            }
            const config = { url, key };
            localStorage.setItem("tc_la_ciotat_supabase_config", JSON.stringify(config));
            supabaseConfig = config;
            if (window.supabase) {
                supabase = window.supabase.createClient(config.url, config.key);
                updateSupabaseStatus().then(() => {
                    syncFromSupabase().then(() => {
                        initUIFromActiveTournament();
                        updateSupabaseStatus();
                        alert("Connexion Supabase établie et synchronisée avec succès !");
                    });
                });
            } else {
                alert("Erreur : Le SDK Supabase n'a pas pu être chargé. Veuillez recharger la page ou désactiver vos bloqueurs de publicité.");
            }
            dom.supabaseModal.classList.remove("active");
        });
    }

    if (dom.btnClearSupabase && dom.supabaseModal) {
        dom.btnClearSupabase.addEventListener("click", () => {
            if (confirm("Voulez-vous déconnecter Supabase ? Les données ne seront plus synchronisées dans le Cloud.")) {
                localStorage.removeItem("tc_la_ciotat_supabase_config");
                supabaseConfig = null;
                supabase = null;
                updateSupabaseStatus();
                dom.supabaseModal.classList.remove("active");
                alert("Supabase déconnecté. Mode local uniquement.");
                initUIFromActiveTournament();
            }
        });
    }

    // WO Checkboxes logic (mutual exclusivity and auto score)
    dom.woP1.addEventListener("change", () => {
        if (dom.woP1.checked) {
            dom.woP2.checked = false;
            setScoreInputsEnabled(false);
        } else {
            setScoreInputsEnabled(true);
        }
    });

    dom.woP2.addEventListener("change", () => {
        if (dom.woP2.checked) {
            dom.woP1.checked = false;
            setScoreInputsEnabled(false);
        } else {
            setScoreInputsEnabled(true);
        }
    });

    function setScoreInputsEnabled(enabled) {
        const inputs = [dom.scoreP1S1, dom.scoreP1S2, dom.scoreP1S3, dom.scoreP2S1, dom.scoreP2S2, dom.scoreP2S3];
        inputs.forEach(input => {
            input.disabled = !enabled;
            if (!enabled) input.value = "";
        });
    }

    dom.btnClearScore.addEventListener("click", () => {
        if (confirm("Voulez-vous effacer le score de ce match ?")) {
            clearMatchScore(state.activeMatchId);
            closeScoreModal();
        }
    });

    dom.btnSaveScore.addEventListener("click", () => {
        saveMatchScore();
    });

    // Winner Modal close
    dom.btnCloseWinner.addEventListener("click", () => {
        dom.winnerModal.classList.remove("active");
        stopConfetti();
    });

    // ----------------------------------------------------------------------
    // FUNCTIONALITY: Switch Tabs & UI updates
    // ----------------------------------------------------------------------

    function switchTab(tabId) {
        dom.tabBtns.forEach(btn => {
            if (btn.getAttribute("data-tab") === tabId) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        dom.tabPanes.forEach(pane => {
            if (pane.id === tabId) {
                pane.classList.add("active");
            } else {
                pane.classList.remove("active");
            }
        });
    }

    function updateNavigationButtons() {
        const hasPools = state.pools.length > 0;
        const hasBracket = state.bracket !== null;

        if (state.type === "progressive") {
            dom.btnTabPools.disabled = true;
            dom.btnTabPools.style.display = "none";
            dom.btnTabBracket.disabled = !hasBracket;
            dom.btnTabBracket.style.display = "inline-flex";
        } else {
            dom.btnTabPools.style.display = "inline-flex";
            dom.btnTabPools.disabled = !hasPools;
            dom.btnTabBracket.style.display = "inline-flex";
            dom.btnTabBracket.disabled = !hasPools;
        }

        // Toggle configuration panel button display
        if (state.type === "progressive") {
            dom.btnToggleBracketConfig.style.display = "none";
            dom.bracketConfigPanel.style.display = "none";
        } else {
            dom.btnToggleBracketConfig.style.display = "inline-flex";
        }
    }

    // ----------------------------------------------------------------------
    // FUNCTIONALITY: Player List Management
    // ----------------------------------------------------------------------

    function loadDemoPlayers(list) {
        state.players = list.map(p => ({
            id: generateId(),
            lastname: p.lastname.toUpperCase(),
            firstname: p.firstname,
            rank: p.rank,
            rankValue: RANK_VALUES[p.rank] || 0
        }));
        renderPlayersList();
        saveState();
    }

    function renderPlayersList() {
        // Sort players by rank value descending (strongest first)
        const sortedPlayers = [...state.players].sort((a, b) => b.rankValue - a.rankValue);
        
        dom.playersTbody.innerHTML = "";
        dom.playerCount.textContent = state.players.length;

        const minPlayers = state.type === "progressive" ? 2 : 3;

        if (sortedPlayers.length === 0) {
            dom.playersEmptyState.style.display = "flex";
            dom.btnGeneratePools.disabled = true;
            dom.poolInfoBadge.className = "badge info-badge";
            dom.poolInfoBadge.textContent = `Minimum ${minPlayers} joueurs requis`;
            return;
        }

        dom.playersEmptyState.style.display = "none";

        sortedPlayers.forEach((player, index) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><span class="cell-badge">${index + 1}</span></td>
                <td><strong>${player.lastname}</strong> ${player.firstname}</td>
                <td><span class="badge info-badge">${player.rank}</span></td>
                <td>
                    <button class="btn btn-danger btn-icon-only btn-delete-player" data-id="${player.id}">
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                </td>
            `;
            dom.playersTbody.appendChild(tr);
        });

        // Set delete button events
        document.querySelectorAll(".btn-delete-player").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const playerId = btn.getAttribute("data-id");
                deletePlayer(playerId);
            });
        });

        const count = state.players.length;
        if (state.type === "progressive") {
            if (count >= 2) {
                dom.btnGeneratePools.disabled = false;
                dom.poolInfoBadge.className = "badge info-badge bg-success";
                dom.poolInfoBadge.style.backgroundColor = "rgba(34, 197, 94, 0.15)";
                dom.poolInfoBadge.style.color = "var(--success)";
                dom.poolInfoBadge.style.border = "1px solid rgba(34, 197, 94, 0.3)";
                dom.poolInfoBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> Prêt ! Un tableau d'élimination directe progressive sera généré pour les ${count} joueurs.`;
            } else {
                dom.btnGeneratePools.disabled = true;
                dom.poolInfoBadge.className = "badge info-badge";
                dom.poolInfoBadge.style.backgroundColor = "";
                dom.poolInfoBadge.style.color = "";
                dom.poolInfoBadge.style.border = "";
                dom.poolInfoBadge.textContent = `Minimum 2 joueurs requis. Actuel : ${count} joueur(s)`;
            }
        } else {
            if (count >= 3) {
                dom.btnGeneratePools.disabled = false;
                dom.poolInfoBadge.className = "badge info-badge bg-success";
                dom.poolInfoBadge.style.backgroundColor = "rgba(34, 197, 94, 0.15)";
                dom.poolInfoBadge.style.color = "var(--success)";
                dom.poolInfoBadge.style.border = "1px solid rgba(34, 197, 94, 0.3)";
                
                const sizes = getPoolSizes(count);
                const p4 = sizes.filter(s => s === 4).length;
                const p5 = sizes.filter(s => s === 5).length;
                const p3 = sizes.filter(s => s === 3).length;
                
                let msg = `<i class="fa-solid fa-circle-check"></i> Prêt ! `;
                const parts = [];
                if (p5 > 0) parts.push(`${p5} poule(s) de 5`);
                if (p4 > 0) parts.push(`${p4} poule(s) de 4`);
                if (p3 > 0) parts.push(`${p3} poule(s) de 3`);
                msg += parts.join(" et ");
                dom.poolInfoBadge.innerHTML = msg + " seront générées.";
            } else {
                dom.btnGeneratePools.disabled = true;
                dom.poolInfoBadge.className = "badge info-badge";
                dom.poolInfoBadge.style.backgroundColor = "";
                dom.poolInfoBadge.style.color = "";
                dom.poolInfoBadge.style.border = "";
                dom.poolInfoBadge.textContent = `Minimum 3 joueurs requis. Actuel : ${count} joueur(s)`;
            }
        }
    }

    function deletePlayer(id) {
        state.players = state.players.filter(p => p.id !== id);
        renderPlayersList();
        saveState();
    }

    // ==========================================================================
    // ALGORITHMS: POOL GENERATION
    // ==========================================================================

    function getPoolSizes(numPlayers) {
        if (numPlayers < 3) return [];
        
        let best = null;
        for (let p3 = 0; p3 <= numPlayers; p3++) {
            for (let p5 = 0; p5 <= numPlayers; p5++) {
                const rem = numPlayers - (3 * p3 + 5 * p5);
                if (rem >= 0 && rem % 4 === 0) {
                    const p4 = rem / 4;
                    const totalPools = p3 + p4 + p5;
                    
                    if (best === null || 
                        p3 < best.p3 || 
                        (p3 === best.p3 && p5 < best.p5)) {
                        best = { p4, p5, p3, totalPools };
                    }
                }
            }
        }
        
        if (!best) {
            if (numPlayers === 6) return [3, 3];
            if (numPlayers === 7) return [4, 3];
            return [];
        }
        
        const sizes = [];
        for (let i = 0; i < best.p4; i++) sizes.push(4);
        for (let i = 0; i < best.p5; i++) sizes.push(5);
        for (let i = 0; i < best.p3; i++) sizes.push(3);
        return sizes.sort((a, b) => b - a);
    }

    function generatePools() {
        const sorted = [...state.players].sort((a, b) => b.rankValue - a.rankValue);
        const poolSizes = getPoolSizes(sorted.length);
        const numPools = poolSizes.length;
        
        state.pools = [];
        state.matches = {};
        
        // Initialize pool objects
        for (let i = 0; i < numPools; i++) {
            state.pools.push({
                id: `pool_${i}`,
                name: `Poule ${String.fromCharCode(65 + i)}`,
                playerIds: [],
                matches: [],
                standings: []
            });
        }

        if (state.algorithm === "homogeneous") {
            let playerIdx = 0;
            for (let i = 0; i < numPools; i++) {
                const size = poolSizes[i];
                for (let j = 0; j < size; j++) {
                    state.pools[i].playerIds.push(sorted[playerIdx++].id);
                }
            }
        } else {
            let poolIndex = 0;
            let direction = 1;
            
            for (let i = 0; i < sorted.length; i++) {
                let attempts = 0;
                while (state.pools[poolIndex].playerIds.length >= poolSizes[poolIndex] && attempts < numPools) {
                    poolIndex += direction;
                    if (poolIndex >= numPools) {
                        poolIndex = numPools - 1;
                        direction = -1;
                    } else if (poolIndex < 0) {
                        poolIndex = 0;
                        direction = 1;
                    }
                    attempts++;
                }
                state.pools[poolIndex].playerIds.push(sorted[i].id);
                
                poolIndex += direction;
                if (poolIndex === numPools) {
                    poolIndex = numPools - 1;
                    direction = -1;
                } else if (poolIndex === -1) {
                    poolIndex = 0;
                    direction = 1;
                }
            }
        }

        state.pools.forEach((pool) => {
            const pIds = pool.playerIds;
            const poolMatches = [];
            for (let i = 0; i < pIds.length; i++) {
                for (let j = i + 1; j < pIds.length; j++) {
                    poolMatches.push({ p1: pIds[i], p2: pIds[j] });
                }
            }

            poolMatches.forEach((m, index) => {
                const matchId = `match_${pool.id}_${index}`;
                state.matches[matchId] = {
                    id: matchId,
                    p1Id: m.p1,
                    p2Id: m.p2,
                    p1Sets: null,
                    p2Sets: null,
                    sets: [
                        { p1: null, p2: null },
                        { p1: null, p2: null },
                        { p1: null, p2: null }
                    ],
                    wo: null,
                    played: false
                };
                pool.matches.push(matchId);
            });
            
            recalculatePoolStandings(pool);
        });

        state.matchFormat = dom.matchFormat.value || "classic";
        initBracketConfig();
    }

    // ==========================================================================
    // STANDINGS CALCULATIONS (FFT RULES)
    // ==========================================================================

    function recalculatePoolStandings(pool) {
        // Initialize stats
        const stats = {};
        pool.playerIds.forEach(pId => {
            stats[pId] = {
                playerId: pId,
                played: 0,
                won: 0,
                lost: 0,
                points: 0,
                setsWon: 0,
                setsLost: 0,
                setsDiff: 0,
                gamesWon: 0,
                gamesLost: 0,
                gamesDiff: 0,
                directMatchResults: {} // key: opponentId -> true (won) / false (lost)
            };
        });

        // Loop matches in pool
        pool.matches.forEach(mId => {
            const match = state.matches[mId];
            if (!match || !match.played) return;

            const p1 = match.p1Id;
            const p2 = match.p2Id;

            stats[p1].played++;
            stats[p2].played++;

            // Handle WO
            if (match.wo) {
                if (match.wo === "p1") { // Player 1 forfeited
                    stats[p1].lost++;
                    stats[p1].points += 0; // WO loser gets 0 points
                    
                    stats[p2].won++;
                    stats[p2].points += 2; // Winner gets 2 points
                    
                    // No games/sets difference (pas de jeux d'écart)
                    
                    stats[p1].directMatchResults[p2] = false;
                    stats[p2].directMatchResults[p1] = true;
                } else { // Player 2 forfeited
                    stats[p2].lost++;
                    stats[p2].points += 0;
                    
                    stats[p1].won++;
                    stats[p1].points += 2;
                    
                    // No games/sets difference (pas de jeux d'écart)
                    
                    stats[p1].directMatchResults[p2] = true;
                    stats[p2].directMatchResults[p1] = false;
                }
                return;
            }

            // Normal match score calculations
            const p1Sets = match.p1Sets;
            const p2Sets = match.p2Sets;

            stats[p1].setsWon += p1Sets;
            stats[p1].setsLost += p2Sets;
            stats[p2].setsWon += p2Sets;
            stats[p2].setsLost += p1Sets;

            // Compile games
            match.sets.forEach(set => {
                if (set.p1 !== null && set.p2 !== null) {
                    stats[p1].gamesWon += set.p1;
                    stats[p1].gamesLost += set.p2;
                    stats[p2].gamesWon += set.p2;
                    stats[p2].gamesLost += set.p1;
                }
            });

            if (p1Sets > p2Sets) {
                stats[p1].won++;
                stats[p1].points += 2;
                stats[p2].lost++;
                stats[p2].points += 1; // Standard defeat gets 1 point
                stats[p1].directMatchResults[p2] = true;
                stats[p2].directMatchResults[p1] = false;
            } else {
                stats[p2].won++;
                stats[p2].points += 2;
                stats[p1].lost++;
                stats[p1].points += 1;
                stats[p1].directMatchResults[p2] = false;
                stats[p2].directMatchResults[p1] = true;
            }
        });

        // Compute Differences
        pool.playerIds.forEach(pId => {
            const pStats = stats[pId];
            pStats.setsDiff = pStats.setsWon - pStats.setsLost;
            pStats.gamesDiff = pStats.gamesWon - pStats.gamesLost;
        });

        // Sort players based on rules:
        // 1. Points
        // 2. Tie break
        const sortedPlayers = [...pool.playerIds].sort((aId, bId) => {
            const a = stats[aId];
            const b = stats[bId];

            if (a.points !== b.points) {
                return b.points - a.points; // Higher points first
            }

            // Points are equal. Find how many players are tied.
            // Check all players in the pool that have same points
            const tiedIds = pool.playerIds.filter(pId => stats[pId].points === a.points);

            if (tiedIds.length === 2) {
                // Case 1: Exactly 2 players are tied. Resolve by direct match (confrontation directe).
                if (a.directMatchResults[bId] !== undefined) {
                    return a.directMatchResults[bId] ? -1 : 1; // Winner of direct match goes first
                }
            } else {
                // Case 2: 3 or 4 players are tied.
                // 1. Sets Difference
                if (a.setsDiff !== b.setsDiff) {
                    return b.setsDiff - a.setsDiff;
                }
                // 2. Games Difference
                if (a.gamesDiff !== b.gamesDiff) {
                    return b.gamesDiff - a.gamesDiff;
                }
            }

            // 3. Fallback to ranking weight (stronger player goes first)
            const aPlayer = state.players.find(p => p.id === aId);
            const bPlayer = state.players.find(p => p.id === bId);
            return bPlayer.rankValue - aPlayer.rankValue;
        });

        pool.standings = sortedPlayers.map((pId, idx) => ({
            rank: idx + 1,
            playerId: pId,
            stats: stats[pId]
        }));
    }

    // Recalculate standings for all pools
    function updateAllPoolsStandings() {
        state.pools.forEach(pool => {
            recalculatePoolStandings(pool);
        });
        
        // Enable or disable "Launch final bracket" based on whether pools are done or we are active
        dom.btnGenerateBracket.disabled = false; // Always allow starting bracket, with warning if incomplete
    }

    // ==========================================================================
    // RENDER: POOLS PHASE
    // ==========================================================================

    function renderPoolsStage() {
        dom.poolsContainer.innerHTML = "";

        state.pools.forEach(pool => {
            const card = document.createElement("div");
            card.className = "card glass-card pool-card";

            // Title
            const header = document.createElement("div");
            header.className = "pool-header";
            header.innerHTML = `<h3><i class="fa-solid fa-table-cells"></i> ${pool.name}</h3>`;
            card.appendChild(header);

            // Table of Standings
            const table = document.createElement("table");
            table.className = "standings-table";
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width: 40px;">Pos</th>
                        <th class="align-left">Joueur</th>
                        <th>Class.</th>
                        <th>Pts</th>
                        <th>Joués</th>
                        <th>G</th>
                        <th>P</th>
                        <th>Sets</th>
                        <th>Jeux</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            `;

            const tbody = table.querySelector("tbody");
            pool.standings.forEach(row => {
                const player = state.players.find(p => p.id === row.playerId);
                if (!player) return;
                
                const stats = row.stats;
                const tr = document.createElement("tr");
                
                // Highlight qualified rows
                if (row.rank <= state.qualifiersPerPool) {
                    tr.className = "qualified-row";
                }

                // Format Diff values with +/- signs
                const fmtDiff = (val) => val > 0 ? `+${val}` : `${val}`;

                tr.innerHTML = `
                    <td class="pos-cell">${row.rank}</td>
                    <td class="align-left font-bold">${player.lastname} ${player.firstname}</td>
                    <td><span class="cell-badge">${player.rank}</span></td>
                    <td class="font-bold">${stats.points}</td>
                    <td>${stats.played}</td>
                    <td>${stats.won}</td>
                    <td>${stats.lost}</td>
                    <td><span class="help-text" style="margin-top:0;">${stats.setsWon}/${stats.setsLost} (${fmtDiff(stats.setsDiff)})</span></td>
                    <td><span class="help-text" style="margin-top:0;">${stats.gamesWon}/${stats.gamesLost} (${fmtDiff(stats.gamesDiff)})</span></td>
                `;
                tbody.appendChild(tr);
            });
            card.appendChild(table);

            // Collapsible Matches section
            const matchesDiv = document.createElement("div");
            matchesDiv.className = "pool-matches-collapsible";
            matchesDiv.style.marginTop = "1rem";
            
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "btn btn-secondary w-full text-left pool-matches-toggle";
            toggleBtn.style.width = "100%";
            toggleBtn.style.display = "flex";
            toggleBtn.style.justifyContent = "space-between";
            toggleBtn.style.alignItems = "center";
            toggleBtn.innerHTML = `<span><i class="fa-solid fa-calendar-days" style="margin-right: 8px;"></i> Afficher les Matchs (${pool.matches.length})</span> <i class="fa-solid fa-chevron-down toggle-icon"></i>`;
            
            const listContainer = document.createElement("div");
            listContainer.className = "matches-list-container";
            listContainer.style.display = "none";
            listContainer.style.marginTop = "10px";
            
            const list = document.createElement("div");
            list.className = "matches-list";

            toggleBtn.addEventListener("click", () => {
                const isHidden = listContainer.style.display === "none";
                listContainer.style.display = isHidden ? "block" : "none";
                toggleBtn.classList.toggle("active", isHidden);
                const icon = toggleBtn.querySelector(".toggle-icon");
                if (isHidden) {
                    icon.className = "fa-solid fa-chevron-up toggle-icon";
                } else {
                    icon.className = "fa-solid fa-chevron-down toggle-icon";
                }
            });

            pool.matches.forEach(mId => {
                const match = state.matches[mId];
                if (!match) return;

                const p1 = state.players.find(p => p.id === match.p1Id);
                const p2 = state.players.find(p => p.id === match.p2Id);
                if (!p1 || !p2) return;

                const item = document.createElement("div");
                item.className = `match-item ${match.played ? 'played' : ''}`;
                item.setAttribute("data-match-id", match.id);

                let scoreHtml = `<div class="score-placeholder">Saisir score</div>`;
                let winnerId = null;
                
                if (match.played) {
                    if (match.wo) {
                        const winner = match.wo === "p1" ? p2.lastname : p1.lastname;
                        scoreHtml = `<div class="match-score"><span class="badge" style="background: rgba(239,68,68,0.1); color: var(--danger); font-weight: 600; padding: 4px 8px; border-radius: 6px;">W.O. (${winner})</span></div>`;
                        winnerId = match.wo === "p1" ? match.p2Id : match.p1Id;
                    } else {
                        scoreHtml = `<div class="match-score">`;
                        match.sets.forEach((set, index) => {
                            if (set.p1 !== null && set.p2 !== null) {
                                const p1Won = set.p1 > set.p2;
                                scoreHtml += `<span class="set-score ${p1Won ? 'winner-set' : ''}">${set.p1}-${set.p2}</span>`;
                            }
                        });
                        scoreHtml += `</div>`;
                        winnerId = match.p1Sets > match.p2Sets ? match.p1Id : match.p2Id;
                    }
                }

                item.innerHTML = `
                    <div class="match-players">
                        <div class="match-player ${winnerId === p1.id ? 'winner' : ''}">${p1.lastname} <span class="help-text">(${p1.rank})</span></div>
                        <div class="match-player ${winnerId === p2.id ? 'winner' : ''}">${p2.lastname} <span class="help-text">(${p2.rank})</span></div>
                    </div>
                    ${scoreHtml}
                `;

                item.addEventListener("click", () => {
                    openScoreModal(match.id);
                });

                list.appendChild(item);
            });
            
            listContainer.appendChild(list);
            matchesDiv.appendChild(toggleBtn);
            matchesDiv.appendChild(listContainer);
            card.appendChild(matchesDiv);

            dom.poolsContainer.appendChild(card);
        });
    }

    // ==========================================================================
    // SCORE ENTRY MODAL CONTROL
    // ==========================================================================

    function openScoreModal(matchId) {
        state.activeMatchId = matchId;
        const match = state.matches[matchId];
        if (!match) return;

        const p1 = state.players.find(p => p.id === match.p1Id);
        const p2 = state.players.find(p => p.id === match.p2Id);
        if (!p1 || !p2) return;

        dom.modalMatchTitle.textContent = `${p1.firstname} ${p1.lastname} vs ${p2.firstname} ${p2.lastname}`;
        
        let formatText = "Format : 2 sets gagnants de 6 jeux";
        if (state.matchFormat === "super-tiebreak") {
            formatText = "Format : 2 sets à 6 jeux + super tie-break au 3e (10 pts)";
        } else if (state.matchFormat === "senior-no-ad") {
            formatText = "Format : 2 sets à 6 jeux + super tie-break + Point Décisif (No Ad)";
        }
        dom.modalMatchFormatBadge.textContent = formatText;

        dom.modalP1Name.textContent = `${p1.firstname} ${p1.lastname}`;
        dom.modalP2Name.textContent = `${p2.firstname} ${p2.lastname}`;

        // Reset inputs
        dom.woP1.checked = false;
        dom.woP2.checked = false;
        setScoreInputsEnabled(true);

        if (match.played) {
            if (match.wo) {
                if (match.wo === "p1") {
                    dom.woP1.checked = true;
                    setWOInputs(false);
                } else {
                    dom.woP2.checked = true;
                    setWOInputs(true);
                }
                setScoreInputsEnabled(false);
            } else {
                dom.scoreP1S1.value = match.sets[0].p1 !== null ? match.sets[0].p1 : "";
                dom.scoreP2S1.value = match.sets[0].p2 !== null ? match.sets[0].p2 : "";
                dom.scoreP1S2.value = match.sets[1].p1 !== null ? match.sets[1].p1 : "";
                dom.scoreP2S2.value = match.sets[1].p2 !== null ? match.sets[1].p2 : "";
                dom.scoreP1S3.value = match.sets[2].p1 !== null ? match.sets[2].p1 : "";
                dom.scoreP2S3.value = match.sets[2].p2 !== null ? match.sets[2].p2 : "";
            }
        } else {
            dom.scoreP1S1.value = "";
            dom.scoreP2S1.value = "";
            dom.scoreP1S2.value = "";
            dom.scoreP2S2.value = "";
            dom.scoreP1S3.value = "";
            dom.scoreP2S3.value = "";
        }

        dom.scoreModal.classList.add("active");
    }

    function closeScoreModal() {
        dom.scoreModal.classList.remove("active");
        state.activeMatchId = null;
    }

    function clearMatchScore(matchId) {
        const match = state.matches[matchId];
        if (!match) return;

        match.played = false;
        match.wo = null;
        match.p1Sets = null;
        match.p2Sets = null;
        match.sets = [
            { p1: null, p2: null },
            { p1: null, p2: null },
            { p1: null, p2: null }
        ];

        saveState();

        if (state.stage === "pools") {
            updateAllPoolsStandings();
            renderPoolsStage();
        } else if (state.stage === "bracket") {
            // Update bracket structure or just let user click again
            updateBracketMatchResult(matchId, null);
            renderBracketStage();
        }
    }

    function saveMatchScore() {
        const matchId = state.activeMatchId;
        const match = state.matches[matchId];
        if (!match) return;

        // Check if WO
        if (dom.woP1.checked) {
            match.played = true;
            match.wo = "p1"; // P1 forfeits, P2 wins
            match.p1Sets = 0;
            match.p2Sets = 2;
            match.sets = [
                { p1: null, p2: null },
                { p1: null, p2: null },
                { p1: null, p2: null }
            ];
        } else if (dom.woP2.checked) {
            match.played = true;
            match.wo = "p2"; // P2 forfeits, P1 wins
            match.p1Sets = 2;
            match.p2Sets = 0;
            match.sets = [
                { p1: null, p2: null },
                { p1: null, p2: null },
                { p1: null, p2: null }
            ];
        } else {
            // Normal Score parsing
            const s1p1 = parseInt(dom.scoreP1S1.value);
            const s1p2 = parseInt(dom.scoreP2S1.value);
            const s2p1 = parseInt(dom.scoreP1S2.value);
            const s2p2 = parseInt(dom.scoreP2S2.value);
            const s3p1 = dom.scoreP1S3.value !== "" ? parseInt(dom.scoreP1S3.value) : null;
            const s3p2 = dom.scoreP2S3.value !== "" ? parseInt(dom.scoreP2S3.value) : null;

            // Validations
            if (isNaN(s1p1) || isNaN(s1p2) || isNaN(s2p1) || isNaN(s2p2)) {
                alert("Veuillez saisir au moins les scores des deux premiers sets.");
                return;
            }

            // Determine sets won
            let p1SetsWon = 0;
            let p2SetsWon = 0;

            // Set 1
            if (s1p1 > s1p2) p1SetsWon++;
            else if (s1p2 > s1p1) p2SetsWon++;

            // Set 2
            if (s2p1 > s2p2) p1SetsWon++;
            else if (s2p2 > s2p1) p2SetsWon++;

            // Set 3 (only check if required)
            if (p1SetsWon === p2SetsWon) {
                if (s3p1 === null || s3p2 === null || isNaN(s3p1) || isNaN(s3p2)) {
                    alert("Un 3ème set / super tie-break est requis car les joueurs sont à 1 set partout !");
                    return;
                }
                if (s3p1 > s3p2) p1SetsWon++;
                else if (s3p2 > s3p1) p2SetsWon++;
            }

            match.played = true;
            match.wo = null;
            match.p1Sets = p1SetsWon;
            match.p2Sets = p2SetsWon;
            match.sets = [
                { p1: s1p1, p2: s1p2 },
                { p1: s2p1, p2: s2p2 },
                { p1: s3p1, p2: s3p2 }
            ];
        }

        saveState();
        closeScoreModal();

        if (state.stage === "pools") {
            updateAllPoolsStandings();
            renderPoolsStage();
        } else if (state.stage === "bracket") {
            updateBracketMatchResult(matchId, match);
            renderBracketStage();
        }
    }

    // ==========================================================================
    // ALGORITHMS: BRACKET GENERATION (KNOCKOUT STAGE)
    // ==========================================================================

    function generateProgressiveBracket() {
        const sorted = [...state.players].sort((a, b) => a.rankValue - b.rankValue); // NC first
        if (sorted.length < 2) {
            alert("Minimum 2 joueurs requis pour générer le tableau.");
            return;
        }

        state.pools = [];
        state.matches = {};
        
        // Group players by rank value
        const rankGroups = [];
        let currentVal = null;
        let currentGroup = [];

        sorted.forEach(p => {
            if (currentVal === null) {
                currentVal = p.rankValue;
                currentGroup = [p];
            } else if (p.rankValue === currentVal) {
                currentGroup.push(p);
            } else {
                rankGroups.push({
                    rankValue: currentVal,
                    players: currentGroup
                });
                currentVal = p.rankValue;
                currentGroup = [p];
            }
        });
        if (currentGroup.length > 0) {
            rankGroups.push({
                rankValue: currentVal,
                players: currentGroup
            });
        }

        // We will construct the rounds
        const rounds = [];
        let activeSurvivors = []; 
        let matchCounter = 0;

        const nextMatchId = () => `prog_match_${matchCounter++}`;

        // Loop through rank groups
        rankGroups.forEach((group, groupIdx) => {
            const entrants = group.players;
            const entrantsRankName = entrants[0].rank;

            const roundPlayers = [];
            
            entrants.forEach(p => {
                roundPlayers.push({ id: p.id, rankValue: p.rankValue, label: `${p.lastname} ${p.firstname}` });
            });

            activeSurvivors.forEach(s => {
                roundPlayers.push(s); 
            });

            // Sort roundPlayers: highest rankValue first (so they get BYEs if odd, and play later)
            roundPlayers.sort((a, b) => b.rankValue - a.rankValue);

            const roundMatches = [];
            const newSurvivors = [];

            const M = roundPlayers.length;
            if (M === 1) {
                newSurvivors.push(roundPlayers[0]);
            } else if (M > 1) {
                const numMatches = Math.floor(M / 2);
                const hasBye = M % 2 !== 0;

                if (hasBye) {
                    newSurvivors.push(roundPlayers[0]); // highest rank gets a BYE
                }

                const startIdx = hasBye ? 1 : 0;
                for (let i = startIdx; i < roundPlayers.length; i += 2) {
                    const p1 = roundPlayers[i];
                    const p2 = roundPlayers[i + 1];
                    const mId = nextMatchId();

                    state.matches[mId] = {
                        id: mId,
                        p1Id: p1.id || null,
                        p2Id: p2.id || null,
                        p1Origin: p1.label || "",
                        p2Origin: p2.label || "",
                        p1MatchId: p1.matchId || null,
                        p2MatchId: p2.matchId || null,
                        p1Sets: null,
                        p2Sets: null,
                        sets: [
                            { p1: null, p2: null },
                            { p1: null, p2: null },
                            { p1: null, p2: null }
                        ],
                        wo: null,
                        played: false
                    };

                    roundMatches.push(mId);

                    newSurvivors.push({
                        matchId: mId,
                        rankValue: Math.max(p1.rankValue, p2.rankValue),
                        label: `Vainqueur Match ${mId.split('_').pop()}`
                    });
                }
            }

            if (roundMatches.length > 0) {
                rounds.push({
                    roundName: `Tour ${groupIdx + 1} (${entrantsRankName})`,
                    matches: roundMatches
                });
            }

            activeSurvivors = newSurvivors;
        });

        // Resolve activeSurvivors down to 1 single champion
        let extraRoundIdx = 1;
        while (activeSurvivors.length > 1) {
            const roundMatches = [];
            const newSurvivors = [];
            const M = activeSurvivors.length;
            const numMatches = Math.floor(M / 2);
            const hasBye = M % 2 !== 0;

            if (hasBye) {
                newSurvivors.push(activeSurvivors[0]);
            }

            const startIdx = hasBye ? 1 : 0;
            for (let i = startIdx; i < activeSurvivors.length; i += 2) {
                const p1 = activeSurvivors[i];
                const p2 = activeSurvivors[i + 1];
                const mId = nextMatchId();

                state.matches[mId] = {
                    id: mId,
                    p1Id: p1.id || null,
                    p2Id: p2.id || null,
                    p1Origin: p1.label || "",
                    p2Origin: p2.label || "",
                    p1MatchId: p1.matchId || null,
                    p2MatchId: p2.matchId || null,
                    p1Sets: null,
                    p2Sets: null,
                    sets: [
                        { p1: null, p2: null },
                        { p1: null, p2: null },
                        { p1: null, p2: null }
                    ],
                    wo: null,
                    played: false
                };

                roundMatches.push(mId);

                newSurvivors.push({
                    matchId: mId,
                    rankValue: Math.max(p1.rankValue, p2.rankValue),
                    label: `Vainqueur Match ${mId.split('_').pop()}`
                });
            }

            rounds.push({
                roundName: `Phase Finale - Tour ${extraRoundIdx++}`,
                matches: roundMatches
            });

            activeSurvivors = newSurvivors;
        }

        state.bracket = {
            rounds: rounds,
            champion: null
        };

        state.stage = "bracket";
        saveState();

        propagateWinners();
        
        switchTab("tab-bracket");
        renderBracketStage();
        updateNavigationButtons();
    }

    function generateBracket() {
        if (state.type === "progressive") {
            generateProgressiveBracket();
            return;
        }
        
        // Step 1: Collect qualified players from pools.
        // We sort qualified players: pool winners first, then runners-up.
        const winners = [];
        const runners = [];
 
        state.pools.forEach(pool => {
            // Find who is 1st and 2nd in pool.standings
            const first = pool.standings.find(row => row.rank === 1);
            const second = pool.standings.find(row => row.rank === 2);
 
            if (first) {
                winners.push({
                    playerId: first.playerId,
                    stats: first.stats,
                    origin: `${pool.name} - 1er`
                });
            }
            if (second && state.qualifiersPerPool >= 2) {
                runners.push({
                    playerId: second.playerId,
                    stats: second.stats,
                    origin: `${pool.name} - 2ème`
                });
            }
        });
 
        // Sort winners by performance (points, setsDiff, gamesDiff)
        const sortPerformance = (a, b) => {
            if (a.stats.points !== b.stats.points) return b.stats.points - a.stats.points;
            if (a.stats.setsDiff !== b.stats.setsDiff) return b.stats.setsDiff - a.stats.setsDiff;
            return b.stats.gamesDiff - a.stats.gamesDiff;
        };
 
        winners.sort(sortPerformance);
        runners.sort(sortPerformance);
 
        // All qualified players ranked
        const qualified = [...winners, ...runners];
        const numQualified = qualified.length;
 
        if (numQualified === 0) {
            alert("Aucun joueur qualifié. Veuillez d'abord ajouter des joueurs et générer les poules.");
            return;
        }
 
        // Determine size of the bracket (next power of 2: 2, 4, 8, 16)
        let bracketSize = 2;
        if (numQualified > 8) bracketSize = 16;
        else if (numQualified > 4) bracketSize = 8;
        else if (numQualified > 2) bracketSize = 4;
 
        // Seeding positions based on standard tournament seeds
        // Example for 8 spots:
        // Match 1: Seed 1 vs Seed 8
        // Match 2: Seed 5 vs Seed 4
        // Match 3: Seed 3 vs Seed 6
        // Match 4: Seed 7 vs Seed 2
        // We match them so Seed 1 and Seed 2 can only meet in the Final.
        let seedOrder = [];
        if (bracketSize === 2) {
            seedOrder = [1, 2];
        } else if (bracketSize === 4) {
            seedOrder = [1, 4, 3, 2]; // 1v4, 3v2
        } else if (bracketSize === 8) {
            seedOrder = [1, 8, 5, 4, 3, 6, 7, 2]; // 1v8, 5v4, 3v6, 7v2
        } else if (bracketSize === 16) {
            seedOrder = [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2];
        }
 
        // Map qualified players to seed ranks (1-indexed)
        const seeds = [];
        for (let i = 0; i < bracketSize; i++) {
            if (i < numQualified) {
                seeds.push(qualified[i]);
            } else {
                seeds.push(null); // represent a BYE (exempt)
            }
        }
 
        // Build first round matches
        const firstRoundMatches = [];
        const numMatchesFirstRound = bracketSize / 2;
 
        for (let i = 0; i < numMatchesFirstRound; i++) {
            const seedP1Index = seedOrder[i * 2] - 1;
            const seedP2Index = seedOrder[i * 2 + 1] - 1;
 
            const q1 = seeds[seedP1Index];
            const q2 = seeds[seedP2Index];
 
            const matchId = `bracket_r0_m${i}`;
            const mObj = {
                id: matchId,
                p1Id: q1 ? q1.playerId : null,
                p2Id: q2 ? q2.playerId : null,
                p1Origin: q1 ? q1.origin : "",
                p2Origin: q2 ? q2.origin : "",
                p1Sets: null,
                p2Sets: null,
                sets: [
                    { p1: null, p2: null },
                    { p1: null, p2: null },
                    { p1: null, p2: null }
                ],
                wo: null,
                played: false
            };
 
            // Auto-advance if one is a BYE (null)
            if (mObj.p1Id === null || mObj.p2Id === null) {
                if (mObj.p1Id !== null) {
                    mObj.played = true;
                    mObj.p1Sets = 2; mObj.p2Sets = 0;
                } else if (mObj.p2Id !== null) {
                    mObj.played = true;
                    mObj.p1Sets = 0; mObj.p2Sets = 2;
                } else {
                    // Both null
                    mObj.played = true;
                }
            }
 
            state.matches[matchId] = mObj;
            firstRoundMatches.push(matchId);
        }
 
        // Initialize rounds array in bracket
        const rounds = [];
        let roundMatches = firstRoundMatches;
        let rIndex = 0;
        let numRoundMatches = numMatchesFirstRound;
 
        const getRoundName = (matchesCount) => {
            if (matchesCount === 8) return "Huitièmes de Finale";
            if (matchesCount === 4) return "Quarts de Finale";
            if (matchesCount === 2) return "Demi-Finales";
            if (matchesCount === 1) return "Finale";
            return `Tour ${rIndex + 1}`;
        };
 
        rounds.push({
            roundName: getRoundName(numRoundMatches),
            matches: roundMatches
        });
 
        // Generate placeholders for subsequent rounds
        while (numRoundMatches > 1) {
            rIndex++;
            numRoundMatches /= 2;
            const nextRoundMatches = [];
 
            for (let i = 0; i < numRoundMatches; i++) {
                const matchId = `bracket_r${rIndex}_m${i}`;
                const mObj = {
                    id: matchId,
                    p1Id: null, // to be determined by previous round winner
                    p2Id: null,
                    p1Origin: `Vainqueur Match ${i * 2 + 1}`,
                    p2Origin: `Vainqueur Match ${i * 2 + 2}`,
                    p1Sets: null,
                    p2Sets: null,
                    sets: [
                        { p1: null, p2: null },
                        { p1: null, p2: null },
                        { p1: null, p2: null }
                    ],
                    wo: null,
                    played: false
                };
 
                state.matches[matchId] = mObj;
                nextRoundMatches.push(matchId);
            }
 
            rounds.push({
                roundName: getRoundName(numRoundMatches),
                matches: nextRoundMatches
            });
            roundMatches = nextRoundMatches;
        }
 
        state.bracket = {
            rounds: rounds,
            champion: null
        };
 
        // Propagate any automatic BYEs to next rounds
        propagateWinners();
    }

    // Propagate winners from round to round
    function propagateWinners() {
        if (!state.bracket) return;

        const rounds = state.bracket.rounds;

        if (state.type === "progressive") {
            rounds.forEach(round => {
                round.matches.forEach(mId => {
                    const match = state.matches[mId];
                    if (!match) return;

                    // Propagate p1 from source match
                    if (match.p1MatchId) {
                        const srcMatch = state.matches[match.p1MatchId];
                        if (srcMatch && srcMatch.played) {
                            let winnerId = null;
                            if (srcMatch.wo) {
                                winnerId = srcMatch.wo === "p1" ? srcMatch.p2Id : srcMatch.p1Id;
                            } else {
                                winnerId = srcMatch.p1Sets > srcMatch.p2Sets ? srcMatch.p1Id : srcMatch.p2Id;
                            }
                            if (winnerId && match.p1Id !== winnerId) {
                                match.p1Id = winnerId;
                                const pObj = state.players.find(p => p.id === winnerId);
                                if (pObj) {
                                    match.p1Origin = `${pObj.lastname} ${pObj.firstname}`;
                                }
                            }
                        } else {
                            match.p1Id = null;
                            match.p1Origin = `Vainqueur Match ${match.p1MatchId.split('_').pop()}`;
                        }
                    }

                    // Propagate p2 from source match
                    if (match.p2MatchId) {
                        const srcMatch = state.matches[match.p2MatchId];
                        if (srcMatch && srcMatch.played) {
                            let winnerId = null;
                            if (srcMatch.wo) {
                                winnerId = srcMatch.wo === "p1" ? srcMatch.p2Id : srcMatch.p1Id;
                            } else {
                                winnerId = srcMatch.p1Sets > srcMatch.p2Sets ? srcMatch.p1Id : srcMatch.p2Id;
                            }
                            if (winnerId && match.p2Id !== winnerId) {
                                match.p2Id = winnerId;
                                const pObj = state.players.find(p => p.id === winnerId);
                                if (pObj) {
                                    match.p2Origin = `${pObj.lastname} ${pObj.firstname}`;
                                }
                            }
                        } else {
                            match.p2Id = null;
                            match.p2Origin = `Vainqueur Match ${match.p2MatchId.split('_').pop()}`;
                        }
                    }
                });
            });

            // Determine champion
            const lastRound = rounds[rounds.length - 1];
            if (lastRound && lastRound.matches.length === 1) {
                const finalMatch = state.matches[lastRound.matches[0]];
                if (finalMatch && finalMatch.played) {
                    if (finalMatch.wo) {
                        state.bracket.champion = finalMatch.wo === "p1" ? finalMatch.p2Id : finalMatch.p1Id;
                    } else {
                        state.bracket.champion = finalMatch.p1Sets > finalMatch.p2Sets ? finalMatch.p1Id : finalMatch.p2Id;
                    }
                } else {
                    state.bracket.champion = null;
                }
            }
            return;
        }

        // Standard Bracket Propagation
        for (let r = 0; r < rounds.length - 1; r++) {
            const currentRound = rounds[r];
            const nextRound = rounds[r + 1];

            for (let m = 0; m < currentRound.matches.length; m++) {
                const match = state.matches[currentRound.matches[m]];
                if (!match) continue;

                // Determine winner of this match
                let winnerId = null;
                let winnerName = "";
                if (match.played) {
                    if (match.wo) {
                        winnerId = match.wo === "p1" ? match.p2Id : match.p1Id;
                    } else {
                        winnerId = match.p1Sets > match.p2Sets ? match.p1Id : match.p2Id;
                    }
                    if (winnerId) {
                        const wp = state.players.find(p => p.id === winnerId);
                        winnerName = wp ? `${wp.lastname} ${wp.firstname}` : "";
                    }
                }

                // Push winner to next round match slot
                const nextMatchIndex = Math.floor(m / 2);
                const nextMatch = state.matches[nextRound.matches[nextMatchIndex]];
                const isFirstSlot = m % 2 === 0;

                if (nextMatch) {
                    if (isFirstSlot) {
                        nextMatch.p1Id = winnerId;
                        if (winnerId) nextMatch.p1Origin = winnerName;
                    } else {
                        nextMatch.p2Id = winnerId;
                        if (winnerId) nextMatch.p2Origin = winnerName;
                    }
                }
            }
        }

        // Check overall champion
        const finalRound = rounds[rounds.length - 1];
        const finalMatch = state.matches[finalRound.matches[0]];
        if (finalMatch && finalMatch.played) {
            if (finalMatch.wo) {
                state.bracket.champion = finalMatch.wo === "p1" ? finalMatch.p2Id : finalMatch.p1Id;
            } else {
                state.bracket.champion = finalMatch.p1Sets > finalMatch.p2Sets ? finalMatch.p1Id : finalMatch.p2Id;
            }
        } else {
            state.bracket.champion = null;
        }
    }

    function updateBracketMatchResult(matchId, matchData) {
        if (!state.bracket) return;

        // Propagate winners upwards
        propagateWinners();
        
        // Save
        saveState();

        // Check if champion was just crowned
        if (state.bracket.champion) {
            showChampionCelebration(state.bracket.champion);
        }
    }

    // ==========================================================================
    // RENDER: BRACKET STAGE
    // ==========================================================================

    function renderBracketStage() {
        dom.bracketContainer.innerHTML = "";
        if (!state.bracket) return;

        state.bracket.rounds.forEach((round, roundIdx) => {
            const col = document.createElement("div");
            col.className = "bracket-round";

            const title = document.createElement("div");
            title.className = "round-title";
            title.textContent = round.roundName;
            col.appendChild(title);

            const matchesContainer = document.createElement("div");
            matchesContainer.className = "bracket-matches";

            round.matches.forEach(mId => {
                const match = state.matches[mId];
                if (!match) return;

                const p1 = state.players.find(p => p.id === match.p1Id);
                const p2 = state.players.find(p => p.id === match.p2Id);

                const matchBox = document.createElement("div");
                matchBox.className = "bracket-match";
                matchBox.setAttribute("data-match-id", match.id);

                let winnerId = null;
                if (match.played) {
                    if (match.wo) {
                        winnerId = match.wo === "p1" ? match.p2Id : match.p1Id;
                    } else {
                        winnerId = match.p1Sets > match.p2Sets ? match.p1Id : match.p2Id;
                    }
                }

                // Render Player 1 Row
                const p1Row = document.createElement("div");
                p1Row.className = `bracket-match-player bracket-match-p1 ${winnerId === match.p1Id && winnerId !== null ? 'winner-row' : ''}`;
                
                let p1NameHtml = `<span class="player-origin">${match.p1Origin || "À déterminer"}</span>`;
                if (p1) {
                    p1NameHtml = `<strong>${p1.lastname}</strong> ${p1.firstname} <span class="badge info-badge" style="padding: 2px 6px; font-size: 0.65rem;">${p1.rank}</span>`;
                }

                let p1ScoreHtml = "";
                if (match.played && !match.wo && match.p1Id) {
                    p1ScoreHtml = `<div class="bracket-player-score">`;
                    match.sets.forEach(set => {
                        if (set.p1 !== null && set.p2 !== null) {
                            const isSetWinner = set.p1 > set.p2;
                            p1ScoreHtml += `<span class="${isSetWinner ? 'winner-set' : ''}">${set.p1}</span>`;
                        }
                    });
                    p1ScoreHtml += `</div>`;
                } else if (match.played && match.wo === "p1") {
                    p1ScoreHtml = `<span class="badge" style="background: rgba(239,68,68,0.1); color: var(--danger); font-size: 0.65rem;">F</span>`;
                } else if (match.played && match.wo === "p2") {
                    p1ScoreHtml = `<span class="badge" style="background: rgba(34,197,94,0.1); color: var(--success); font-size: 0.65rem;">WO</span>`;
                }

                p1Row.innerHTML = `
                    <div class="bracket-player-info ${winnerId === match.p1Id && winnerId !== null ? 'winner' : ''}">
                        ${p1NameHtml}
                    </div>
                    ${p1ScoreHtml}
                `;
                matchBox.appendChild(p1Row);

                // Render Player 2 Row
                const p2Row = document.createElement("div");
                p2Row.className = `bracket-match-player bracket-match-p2 ${winnerId === match.p2Id && winnerId !== null ? 'winner-row' : ''}`;
                
                let p2NameHtml = `<span class="player-origin">${match.p2Origin || "À déterminer"}</span>`;
                if (p2) {
                    p2NameHtml = `<strong>${p2.lastname}</strong> ${p2.firstname} <span class="badge info-badge" style="padding: 2px 6px; font-size: 0.65rem;">${p2.rank}</span>`;
                }

                let p2ScoreHtml = "";
                if (match.played && !match.wo && match.p2Id) {
                    p2ScoreHtml = `<div class="bracket-player-score">`;
                    match.sets.forEach(set => {
                        if (set.p1 !== null && set.p2 !== null) {
                            const isSetWinner = set.p2 > set.p1;
                            p2ScoreHtml += `<span class="${isSetWinner ? 'winner-set' : ''}">${set.p2}</span>`;
                        }
                    });
                    p2ScoreHtml += `</div>`;
                } else if (match.played && match.wo === "p2") {
                    p2ScoreHtml = `<span class="badge" style="background: rgba(239,68,68,0.1); color: var(--danger); font-size: 0.65rem;">F</span>`;
                } else if (match.played && match.wo === "p1") {
                    p2ScoreHtml = `<span class="badge" style="background: rgba(34,197,94,0.1); color: var(--success); font-size: 0.65rem;">WO</span>`;
                }

                p2Row.innerHTML = `
                    <div class="bracket-player-info ${winnerId === match.p2Id && winnerId !== null ? 'winner' : ''}">
                        ${p2NameHtml}
                    </div>
                    ${p2ScoreHtml}
                `;
                matchBox.appendChild(p2Row);

                // Event click to edit score (only if players are known)
                if (match.p1Id && match.p2Id) {
                    matchBox.addEventListener("click", () => {
                        openScoreModal(match.id);
                    });
                } else {
                    matchBox.style.cursor = "default";
                    matchBox.style.opacity = "0.75";
                }

                matchesContainer.appendChild(matchBox);
            });

            col.appendChild(matchesContainer);
            dom.bracketContainer.appendChild(col);
        });

        // Add Champion Column at the end
        const champCol = document.createElement("div");
        champCol.className = "bracket-round";
        champCol.style.justifyContent = "center";

        const title = document.createElement("div");
        title.className = "round-title";
        title.textContent = "Champion";
        champCol.appendChild(title);

        const champBox = document.createElement("div");
        champBox.className = "champion-box";

        let champName = "À désigner";
        let champClub = "TC LA CIOTAT";

        if (state.bracket.champion) {
            const player = state.players.find(p => p.id === state.bracket.champion);
            if (player) {
                champName = `${player.firstname} ${player.lastname}`;
                champBox.addEventListener("click", () => {
                    showChampionCelebration(state.bracket.champion);
                });
                champBox.style.cursor = "pointer";
            }
        }

        champBox.innerHTML = `
            <i class="fa-solid fa-trophy"></i>
            <h4>Vainqueur</h4>
            <div class="champ-name">${champName}</div>
        `;
        
        champCol.appendChild(champBox);
        dom.bracketContainer.appendChild(champCol);
    }

    // ==========================================================================
    // CHAMPION CELEBRATION (CONFETTI ANIMATION)
    // ==========================================================================

    let confettiInterval = null;

    function showChampionCelebration(playerId) {
        const player = state.players.find(p => p.id === playerId);
        if (!player) return;

        dom.winnerFullname.textContent = `${player.firstname} ${player.lastname}`;
        
        // Build simple stats summaries
        let winsCount = 0;
        let playedCount = 0;
        
        // Scan matches
        Object.values(state.matches).forEach(match => {
            if (match.played && (match.p1Id === playerId || match.p2Id === playerId)) {
                playedCount++;
                let matchWinner = null;
                if (match.wo) {
                    matchWinner = match.wo === "p1" ? match.p2Id : match.p1Id;
                } else {
                    matchWinner = match.p1Sets > match.p2Sets ? match.p1Id : match.p2Id;
                }
                if (matchWinner === playerId) winsCount++;
            }
        });

        dom.winnerStatsDetails.innerHTML = `
            <p>Classement FFT : <strong>${player.rank}</strong></p>
            <p>Parcours : <strong>${winsCount} victoires</strong> sur ${playedCount} matchs joués</p>
        `;

        dom.winnerModal.classList.add("active");
        startConfetti();
    }

    function startConfetti() {
        const canvas = document.getElementById("confetti-canvas");
        canvas.innerHTML = "";
        const colors = ['#d7ff00', '#0ea5e9', '#ffffff', '#ff007f', '#00ffcc'];

        // Create particles
        for (let i = 0; i < 80; i++) {
            const p = document.createElement("div");
            p.className = "confetti-particle";
            p.style.position = "absolute";
            p.style.width = `${Math.random() * 8 + 6}px`;
            p.style.height = `${Math.random() * 15 + 8}px`;
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            p.style.left = `${Math.random() * 100}%`;
            p.style.top = `-20px`;
            p.style.borderRadius = "2px";
            p.style.opacity = Math.random();
            p.style.transform = `rotate(${Math.random() * 360}deg)`;
            
            // Animation values
            const duration = Math.random() * 3 + 2;
            const delay = Math.random() * 2;
            
            p.style.animation = `fall ${duration}s linear ${delay}s infinite`;
            canvas.appendChild(p);
        }

        // Add CSS rule dynamically for the fall animation if not present
        if (!document.getElementById("confetti-keyframes")) {
            const style = document.createElement("style");
            style.id = "confetti-keyframes";
            style.innerHTML = `
                @keyframes fall {
                    0% { top: -20px; transform: translateX(0) rotate(0deg); }
                    50% { transform: translateX(${Math.random() * 50 - 25}px) rotate(180deg); }
                    100% { top: 105%; transform: translateX(${Math.random() * 100 - 50}px) rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    function stopConfetti() {
        const canvas = document.getElementById("confetti-canvas");
        canvas.innerHTML = "";
    }
});
