// script.js
let players = [];
let teamRanks = {};
let seasonGamesPlayed = {}; // Most league games any team has played, to flag seasons still in progress
let seasonMinimumPoints = {}; // Points needed to be in a season's top scorers, who are the possible answers
let answer;
let attempts = 0;
let candidates = []; // Players offered by the autocomplete for the current season
const maxAttempts = 6;
const guessedPlayers = new Set();
const answerShare = 0.25; // Answers are drawn from the top 25% of each season's points scorers
const seasonMatches = 38;
let currentFocus;

// Resolve data files relative to this script, so the page works whether it's served from /docs/ or the site root
const dataUrl = new URL('data/', document.currentScript.src);
const badgeUrl = new URL('assets/badges/', document.currentScript.src);

// Crests come from fpl-planner's src/assets/team-badges, named by FPL abbreviation
const TEAM_BADGES = {
    "Arsenal": "ARS", "Aston Villa": "AVL", "Bournemouth": "BOU", "Brentford": "BRE", "Brighton": "BHA",
    "Burnley": "BUR", "Chelsea": "CHE", "Coventry City": "COV", "Crystal Palace": "CRY", "Everton": "EVE",
    "Fulham": "FUL", "Hull": "HUL", "Ipswich": "IPS", "Leeds": "LEE", "Leicester": "LEI", "Liverpool": "LIV",
    "Luton": "LUT", "Man City": "MCI", "Man Utd": "MUN", "Newcastle": "NEW", "Norwich": "NOR",
    "Nott'm Forest": "NFO", "Sheffield Utd": "SHU", "Southampton": "SOU", "Spurs": "TOT", "Sunderland": "SUN",
    "Watford": "WAT", "West Brom": "WBA", "West Ham": "WHU", "Wolves": "WOL",
};

// Lucide icon paths
const ICONS = {
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    success: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    error: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
};

function icon(name, className = "icon") {
    return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

function teamBadge(team) {
    const abbreviation = TEAM_BADGES[team];
    if (!abbreviation) {
        const fallback = document.createElement("span");
        fallback.className = "badge badge-fallback";
        fallback.title = team;
        return fallback;
    }
    const img = document.createElement("img");
    img.className = "badge";
    img.src = new URL(`${abbreviation}.svg`, badgeUrl);
    img.alt = "";
    img.loading = "lazy";
    return img;
}

async function loadGame() {
    const playerResponse = await fetch(new URL('master.csv', dataUrl));
    const playerCsvData = await playerResponse.text();
    const parsedPlayers = Papa.parse(playerCsvData, { header: true, dynamicTyping: true });
    players = parsedPlayers.data.filter(p => p.name).map(p => ({
        ...p,
        normalizedName: normalizeForComparison(p.name),
        age: p.dob ? Math.floor((Date.now() - new Date(p.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : null // Calculate age from dob
    })); // Filter out players with no name and add normalized name

    if (players.length === 0) {
        console.error("No players loaded. Check master.csv and parsing logic.");
        return; // Stop game initialization if no players
    }
    console.log("Players loaded successfully. Total players:", players.length);

    const pointsBySeason = {};
    players.forEach(p => (pointsBySeason[p.season] ??= []).push(p.points));
    Object.entries(pointsBySeason).forEach(([season, points]) => {
        points.sort((a, b) => b - a);
        seasonMinimumPoints[season] = points[Math.ceil(points.length * answerShare) - 1];
    });

    const teamRankResponse = await fetch(new URL('league_tables_converted.csv', dataUrl));
    const teamRankCsvData = await teamRankResponse.text();
    const parsedTeamRanks = Papa.parse(teamRankCsvData, { header: true, dynamicTyping: true });

    // Store team ranks in a nested object: teamRanks[season][teamName] = rank
    parsedTeamRanks.data.forEach(row => {
        if (row.season && row.Team && row.rank) {
            if (!teamRanks[row.season]) {
                teamRanks[row.season] = {};
            }
            teamRanks[row.season][normalizeForComparison(row.Team)] = row.rank;
            seasonGamesPlayed[row.season] = Math.max(seasonGamesPlayed[row.season] || 0, row.M);
        }
    });

    populateSeasonCheckboxes();
    resetGame();
}

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function showToast(message, type = "info") {
    const toast = document.getElementById('toast');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `${icon(type)}<span></span>`;
    toast.querySelector('span').textContent = message;
    requestAnimationFrame(() => toast.classList.add('show'));
    clearTimeout(showToast.timeout);
    showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2400);
}

function getSelectedSeasons() {
    return Array.from(document.querySelectorAll('#season-checkboxes input:checked')).map(cb => cb.value);
}

function saveSelectedSeasons() {
    const selectedSeasons = getSelectedSeasons();
    setCookie("selectedSeasons", JSON.stringify(selectedSeasons), 365);
    const allBoxes = document.querySelectorAll('#season-checkboxes input');
    document.getElementById('toggleAllBtn').textContent = selectedSeasons.length === allBoxes.length ? 'None' : 'All';
}

function populateSeasonCheckboxes() {
    const seasonCheckboxes = document.getElementById('season-checkboxes');
    const seasons = [...new Set(players.map(p => p.season))];
    seasons.sort().reverse();
    seasonCheckboxes.innerHTML = '';
    const savedSeasons = getCookie("selectedSeasons");
    const selectedSeasons = savedSeasons ? JSON.parse(savedSeasons) : seasons;

    seasons.forEach(season => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = season;
        checkbox.name = season;
        checkbox.value = season;
        checkbox.checked = selectedSeasons.includes(season);

        const label = document.createElement('label');
        label.htmlFor = season;
        label.appendChild(document.createTextNode(season));

        seasonCheckboxes.appendChild(checkbox);
        seasonCheckboxes.appendChild(label);

        checkbox.addEventListener('change', saveSelectedSeasons);
    });
    saveSelectedSeasons();

    document.getElementById('toggleAllBtn').addEventListener('click', () => {
        const allBoxes = document.querySelectorAll('#season-checkboxes input');
        const selectAll = getSelectedSeasons().length !== allBoxes.length;
        allBoxes.forEach(cb => cb.checked = selectAll);
        saveSelectedSeasons();
    });
    document.getElementById('newPlayerBtn').addEventListener('click', resetGame);
}

function resetGame() {
    attempts = 0;
    guessedPlayers.clear();
    document.getElementById('feedback').innerHTML = '';
    document.getElementById('result').hidden = true;

    const selectedSeasons = getSelectedSeasons();
    const eligiblePlayers = players.filter(p => selectedSeasons.includes(p.season) && p.points >= seasonMinimumPoints[p.season]);
    if (eligiblePlayers.length === 0) {
        showToast("Select at least one season to play", "error");
        document.getElementById('guessInput').disabled = true;
        return;
    }
    answer = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
    console.log("Correct answer:", answer); // For debugging

    document.getElementById("season").textContent = answer.season;
    const gamesPlayed = seasonGamesPlayed[answer.season] ?? seasonMatches;
    document.getElementById("seasonStatus").textContent = gamesPlayed < seasonMatches ? `Live · after GW${gamesPlayed}` : '';
    document.getElementById('guessInput').disabled = false;
    document.getElementById('guessInput').value = '';
    document.getElementById('playAgainBtn').hidden = true;
    document.getElementById('giveUpBtn').hidden = false;

    setupUI();
    renderAttempts();
    document.getElementById('guessInput').focus();
}

function renderAttempts(label) {
    document.getElementById('attempts').textContent = label ?? `Guess ${Math.min(attempts + 1, maxAttempts)} / ${maxAttempts}`;
    document.getElementById('attemptsBar').style.setProperty('--used', attempts / maxAttempts);
}

function setupUI() {
    const feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = ''; // Clear previous table
    const table = document.createElement("table");
    table.id = "guessesTable";
    const header = document.createElement("tr");
    const headers = [["Player"], ["Pos", "Position"], ["Team", "Team league position"], ["Age"], ["Pts", "Points"], ["Mins", "Minutes"], ["G", "Goals"], ["A", "Assists"], ["YC", "Yellow cards"], ["RC", "Red cards"]];
    headers.forEach(([h, title]) => {
        const th = document.createElement("th");
        th.textContent = h;
        if (title) th.title = title;
        header.appendChild(th);
    });
    table.appendChild(header);
    feedbackDiv.appendChild(table);

    candidates = players.filter(p => p.season === answer.season).sort((a, b) => a.name.localeCompare(b.name));
}

const normalizeString = (str) => {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str).toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // Remove diacritics
        .replace(/[^a-z0-9-']/g, '') // Keep alphanumeric, hyphens, and apostrophes
        .replace(/\s/g, '') // Remove all spaces
        .trim(); // Trim leading/trailing spaces
};

const normalizeWithoutApostrophe = (str) => {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str).toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // Remove diacritics
        .replace(/[^a-z0-9-]/g, '') // Keep alphanumeric and hyphens, remove apostrophes
        .replace(/\s/g, '') // Remove all spaces
        .trim(); // Trim leading/trailing spaces
};

const normalizeForComparison = (str) => {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str).toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // Remove diacritics
        .replace(/[^a-z0-9-]/g, '') // Keep alphanumeric and hyphens, remove all spaces
        .replace(/\s/g, '') // Remove all spaces
        .trim(); // Trim leading/trailing spaces
};

function getTeamRank(player) {
    return teamRanks[player.season] ? teamRanks[player.season][normalizeForComparison(player.team)] ?? null : null;
}

function ordinal(n) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getFeedback(correct, guess) {
    const result = {};
    result['pos'] = guess['pos'] === correct['pos'] ? "correct" : "wrong";

    // Team Rank comparison
    const correctTeamRank = getTeamRank(correct);
    const guessTeamRank = getTeamRank(guess);

    if (correctTeamRank !== null && guessTeamRank !== null) {
        if (guessTeamRank === correctTeamRank) {
            result['teamRank'] = "correct";
        } else if (guessTeamRank > correctTeamRank) { // Guessed team rank is numerically higher (worse) than correct, so correct is 'higher' (better)
            result['teamRank'] = "higher";
        } else { // guessTeamRank < correctTeamRank, so correct is 'lower' (worse)
            result['teamRank'] = "lower";
        }
    } else {
        result['teamRank'] = "wrong"; // Or some other indicator for missing data
    }

    const numericalFields = ['age', 'points', 'minutes', 'goals', 'assists', 'yellow_cards', 'red_cards'];
    numericalFields.forEach(k => {
        if (guess[k] === correct[k]) result[k] = "correct";
        else if (guess[k] < correct[k]) result[k] = "higher";
        else result[k] = "lower";
    });
    return result;
}

function addRow(player, fb, isAnswer = false) {
    const table = document.getElementById("guessesTable");
    const row = document.createElement("tr");
    if (isAnswer) row.classList.add("answer-row");

    const nameCell = document.createElement("td");
    nameCell.className = "name-cell";
    const name = document.createElement("span");
    name.textContent = player.name;
    nameCell.append(teamBadge(player.team), name);
    if (isAnswer) nameCell.insertAdjacentHTML("beforeend", '<i class="reticle"></i>'.repeat(4));
    row.appendChild(nameCell);

    const teamRank = getTeamRank(player);
    const cells = [
        [player.pos, fb.pos],
        [player.team, fb.teamRank, teamRank ? ordinal(teamRank) : null],
        [player.age, fb.age],
        [player.points, fb.points],
        [player.minutes, fb.minutes],
        [player.goals, fb.goals],
        [player.assists, fb.assists],
        [player.yellow_cards, fb.yellow_cards],
        [player.red_cards, fb.red_cards],
    ];
    cells.forEach(([text, cls, subtext], i) => {
        const td = document.createElement("td");
        td.className = `tile ${cls}`;
        const value = document.createElement("span");
        value.className = "value";
        if (cls === "higher" || cls === "lower") value.innerHTML = icon(cls === "higher" ? "up" : "down", "icon arrow");
        value.append(document.createTextNode(text ?? "–"));
        td.appendChild(value);
        if (subtext) {
            const small = document.createElement("small");
            small.textContent = subtext;
            td.appendChild(small);
        }
        td.style.animationDelay = `${i * 50}ms`;
        row.appendChild(td);
    });

    table.appendChild(row);
}

function makeGuess(inputValue) {
    const normalizedInput = normalizeForComparison(inputValue);

    if (guessedPlayers.has(normalizedInput)) {
        showToast("Already guessed");
        return;
    }

    const guess = candidates.find(p => p.normalizedName === normalizedInput);
    if (!guess) {
        showToast("Pick a player from the list");
        return;
    }

    guessedPlayers.add(normalizedInput);
    addRow(guess, getFeedback(answer, guess), guess.name === answer.name);

    attempts++;
    if (guess.name === answer.name) {
        renderAttempts(`Solved in ${attempts}`);
        finishGame("success", `Solved in ${attempts} ${attempts === 1 ? "guess" : "guesses"}`, `It was ${answer.name}.`);
    } else if (attempts >= maxAttempts) {
        renderAttempts("Out of guesses");
        endGame("Out of guesses", `It was ${answer.name}.`);
    } else {
        renderAttempts();
    }
}

function endGame(title, description) {
    const fb = {
        pos: "correct",
        teamRank: "correct",
        age: "correct",
        points: "correct",
        minutes: "correct",
        goals: "correct",
        assists: "correct",
        yellow_cards: "correct",
        red_cards: "correct",
    };
    addRow(answer, fb, true);
    finishGame("error", title, description);
}

function finishGame(type, title, description) {
    const result = document.getElementById("result");
    result.className = `result result-${type}`;
    result.innerHTML = `${icon(type)}<div><strong></strong><span></span></div>`;
    result.querySelector('strong').textContent = title;
    result.querySelector('span').textContent = description;
    result.hidden = false;
    document.getElementById('guessInput').disabled = true;
    document.getElementById('playAgainBtn').hidden = false;
    document.getElementById('giveUpBtn').hidden = true;
    document.getElementById('playAgainBtn').focus();
}

function autocomplete(inp) {
    inp.addEventListener("input", function (e) {
        let a, b, i, val = this.value;
        closeAllLists();
        if (!val) { return false; }
        currentFocus = -1;
        a = document.createElement("DIV");
        a.setAttribute("id", this.id + "autocomplete-list");
        a.setAttribute("class", "autocomplete-items");
        this.parentNode.appendChild(a);
        const inputHasApostrophe = val.includes("'"); // Check if raw input has apostrophe

        for (i = 0; i < candidates.length; i++) {
            const originalName = candidates[i].name;
            let normalizedPlayerName;
            let normalizedInputForComparison;

            if (inputHasApostrophe) {
                normalizedPlayerName = normalizeString(originalName); // Keeps apostrophe
                normalizedInputForComparison = normalizeString(val); // Keeps apostrophe
            } else {
                normalizedPlayerName = normalizeWithoutApostrophe(originalName); // Removes apostrophe
                normalizedInputForComparison = normalizeWithoutApostrophe(val); // Removes apostrophe
            }

            const matchIndex = normalizedPlayerName.indexOf(normalizedInputForComparison);
            if (matchIndex > -1 && !guessedPlayers.has(candidates[i].normalizedName)) {
                b = document.createElement("DIV");
                const label = document.createElement("span");
                label.className = "option-label";
                const name = document.createElement("span");
                name.textContent = originalName;
                label.append(teamBadge(candidates[i].team), name);
                const details = document.createElement("small");
                details.textContent = `${candidates[i].team} · ${candidates[i].pos}`;
                b.append(label, details);
                b.dataset.playerName = originalName; // Store the original name in a data attribute
                b.addEventListener("click", function (e) {
                    makeGuess(this.dataset.playerName);
                    inp.value = ""; // Clear input after guess
                    closeAllLists();
                    inp.focus();
                });
                a.appendChild(b);
            }
        }
        if (!a.children.length) a.innerHTML = '<p class="autocomplete-empty">No players found</p>';
    });

    inp.addEventListener("keydown", function (e) {
        let x = document.getElementById(this.id + "autocomplete-list");
        if (x) x = x.getElementsByTagName("div");
        if (e.key === "ArrowDown") {
            currentFocus++;
            addActive(x);
            e.preventDefault(); // Prevent default scroll behavior
        } else if (e.key === "ArrowUp") {
            currentFocus--;
            addActive(x);
            e.preventDefault(); // Prevent default scroll behavior
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (x && currentFocus > -1) {
                x[currentFocus].click();
            } else if (x && x.length > 0) { // If no item is highlighted but there are suggestions
                x[0].click(); // Click the first suggestion
            }
        } else if (e.key === "Escape") {
            closeAllLists();
        }
    });

    function addActive(x) {
        if (!x || x.length === 0) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
        x[currentFocus].scrollIntoView({ block: "nearest" });
    }

    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        const x = document.getElementsByClassName("autocomplete-items");
        for (let i = x.length - 1; i >= 0; i--) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }

    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

autocomplete(document.getElementById('guessInput'));
document.getElementById('playAgainBtn').addEventListener('click', resetGame);
document.getElementById('giveUpBtn').addEventListener('click', () => {
    renderAttempts("Gave up");
    endGame("Gave up", `It was ${answer.name}.`);
});

// "/" focuses the search, like the planner's search fields
document.addEventListener('keydown', (e) => {
    const input = document.getElementById('guessInput');
    if (e.key === '/' && document.activeElement !== input && !input.disabled) {
        e.preventDefault();
        input.focus();
    }
});

window.onload = loadGame;
