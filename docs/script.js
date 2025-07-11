// script.js
let players = [];
let teamRanks = {};
let answer;
let attempts = 0;
const maxAttempts = 6;
const guessedPlayers = new Set();
const minimumPoints = 50;
let currentFocus;

async function loadGame() {
    const playerResponse = await fetch('./data/master.csv');
    const playerCsvData = await playerResponse.text();
    const parsedPlayers = Papa.parse(playerCsvData, { header: true, dynamicTyping: true });
    console.log("Raw parsed players data:", parsedPlayers.data);
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

    const teamRankResponse = await fetch('./data/league_tables_converted.csv');
    const teamRankCsvData = await teamRankResponse.text();
    const parsedTeamRanks = Papa.parse(teamRankCsvData, { header: true, dynamicTyping: true });

    // Store team ranks in a nested object: teamRanks[season][teamName] = rank
    parsedTeamRanks.data.forEach(row => {
        if (row.season && row.Team && row.rank) {
            if (!teamRanks[row.season]) {
                teamRanks[row.season] = {};
            }
            teamRanks[row.season][normalizeForComparison(row.Team)] = row.rank;
        }
    });

    resetGame();
}

function resetGame() {
    attempts = 0;
    guessedPlayers.clear();
    document.getElementById('feedback').innerHTML = '';

    const eligiblePlayers = players.filter(p => p.points >= minimumPoints);
    if (eligiblePlayers.length === 0) {
        console.error("No eligible players found with at least " + minimumPoints + " points. Please check master.csv data.");
        alert("Error: No eligible players found to start the game. Adjust minimum points or check data.");
        return;
    }
    answer = eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];
    console.log("Correct answer:", answer); // For debugging

    document.getElementById("season").textContent = answer.season;
    document.getElementById('guessInput').disabled = false;
    document.getElementById('guessInput').value = '';
    document.getElementById('playAgainBtn').style.display = 'none';
    document.getElementById('giveUpBtn').style.display = 'inline-block';

    setupUI();
}

function setupUI() {
    const feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = ''; // Clear previous table
    const table = document.createElement("table");
    table.id = "guessesTable";
    const header = document.createElement("tr");
    const headers = ["Name", "Position", "Team", "Age", "Points", "Minutes", "Goals", "Assists", "Yellow Cards", "Red Cards"];
    headers.forEach(h => {
        const th = document.createElement("th");
        th.textContent = h;
        header.appendChild(th);
    });
    table.appendChild(header);
    feedbackDiv.appendChild(table);

    const input = document.getElementById("guessInput");
    autocomplete(input, players.filter(p => p.season === answer.season).sort((a, b) => a.name.localeCompare(b.name)));
}

const normalizeString = (str) => {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str).toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
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
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
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
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9-]/g, '') // Keep alphanumeric and hyphens, remove all spaces
        .replace(/\s/g, '') // Remove all spaces
        .trim(); // Trim leading/trailing spaces
};

function getFeedback(correct, guess) {
    const result = {};
    result['pos'] = guess['pos'] === correct['pos'] ? "correct" : "wrong";

    // Team Rank comparison
    const correctTeamRank = teamRanks[correct.season] ? teamRanks[correct.season][normalizeForComparison(correct.team)] : null;
    const guessTeamRank = teamRanks[guess.season] ? teamRanks[guess.season][normalizeForComparison(guess.team)] : null;

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

function makeGuess(inputValue) {
    console.log("makeGuess called with inputValue:", inputValue);
    const normalizedInput = normalizeForComparison(inputValue);

    if (guessedPlayers.has(normalizedInput)) {
        alert("You have already guessed this player.");
        return;
    }

    const guess = players.find(p => {
        console.log("Comparing: Player Name =", p.name, "Normalized Player Name =", p.normalizedName, "vs Normalized Input =", normalizedInput, "and Season =", answer.season);
        return p.name && p.normalizedName === normalizedInput && p.season === answer.season;
    });
    if (!guess) {
        console.error("Player not found. Please select a player from the list.", inputValue);
        return;
    }

    console.log("Found guess object:", guess); // Log the found guess object

    guessedPlayers.add(normalizedInput);
    const fb = getFeedback(answer, guess);
    const table = document.getElementById("guessesTable");
    const row = document.createElement("tr");
    const cells = [
        [guess.name, null],
        [guess.pos, fb.pos],
        [guess.team, fb.teamRank],
        [guess.age, fb.age],
        [guess.points, fb.points],
        [guess.minutes, fb.minutes],
        [guess.goals, fb.goals],
        [guess.assists, fb.assists],
        [guess.yellow_cards, fb.yellow_cards],
        [guess.red_cards, fb.red_cards],
    ];
    cells.forEach(([text, cls]) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (cls) td.classList.add(cls);
        row.appendChild(td);
    });

    table.appendChild(row);

    attempts++;
    if (guess.name === answer.name) {
        const feedbackParagraph = document.createElement("p");
        feedbackParagraph.innerHTML = `<strong>🎉 Correct! The player is ${answer.name}.</strong>`;
        feedbackParagraph.classList.add("correct-animation");
        document.getElementById("feedback").appendChild(feedbackParagraph);
        document.getElementById('guessInput').disabled = true;
        document.getElementById('playAgainBtn').style.display = 'inline-block';
        document.getElementById('giveUpBtn').style.display = 'none';
    } else if (attempts >= maxAttempts) {
        endGame(`💀 Game over! The correct player was <strong>${answer.name}</strong>.`);
    }
}

function endGame(message) {
    const table = document.getElementById("guessesTable");
    const row = document.createElement("tr");
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

    const cells = [
        [answer.name, null],
        [answer.pos, fb.pos],
        [answer.team, fb.teamRank],
        [answer.age, fb.age],
        [answer.points, fb.points],
        [answer.minutes, fb.minutes],
        [answer.goals, fb.goals],
        [answer.assists, fb.assists],
        [answer.yellow_cards, fb.yellow_cards],
        [answer.red_cards, fb.red_cards],
    ];

    cells.forEach(([text, cls]) => {
        const td = document.createElement("td");
        td.textContent = text;
        if (cls) td.classList.add(cls);
        row.appendChild(td);
    });

    table.appendChild(row);

    document.getElementById("feedback").insertAdjacentHTML("beforeend", `<p><strong>${message}</strong></p>`);
    document.getElementById('guessInput').disabled = true;
    document.getElementById('playAgainBtn').style.display = 'inline-block';
    document.getElementById('giveUpBtn').style.display = 'none';
}

function autocomplete(inp, arr) {
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

        for (i = 0; i < arr.length; i++) {
            const originalName = arr[i].name;
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
            if (matchIndex > -1) {
                b = document.createElement("DIV");
                b.innerHTML = originalName; // Just display the original name
                b.dataset.playerName = arr[i].name; // Store the original name in a data attribute
                b.addEventListener("click", function (e) {
                    const selectedPlayerName = this.dataset.playerName;
                    console.log("Autocomplete click: selectedPlayerName =", selectedPlayerName);
                    inp.value = selectedPlayerName; // Set input value for display
                    makeGuess(selectedPlayerName); // Pass the selected player name directly
                    inp.value = ""; // Clear input after guess
                    closeAllLists();
                });
                a.appendChild(b);
            }
        }
    });

    if (!inp.dataset.hasKeydownListener) {
        inp.addEventListener("keydown", function (e) {
            let x = document.getElementById(this.id + "autocomplete-list");
            if (x) x = x.getElementsByTagName("div");
            if (e.keyCode == 40) { // Down arrow
                currentFocus++;
                addActive(x);
                e.preventDefault(); // Prevent default scroll behavior
            } else if (e.keyCode == 38) { // Up arrow
                currentFocus--;
                addActive(x);
                e.preventDefault(); // Prevent default scroll behavior
            } else if (e.keyCode == 13) { // Enter key
                e.preventDefault();
                if (currentFocus > -1) {
                    if (x) x[currentFocus].click();
                } else if (x && x.length > 0) { // If no item is highlighted but there are suggestions
                    x[0].click(); // Click the first suggestion
                }
            }
        });
        inp.dataset.hasKeydownListener = "true";
    }

    function addActive(x) {
        if (!x) return false;
        removeActive(x);
        if (currentFocus >= x.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = (x.length - 1);
        x[currentFocus].classList.add("autocomplete-active");
    }

    function removeActive(x) {
        for (let i = 0; i < x.length; i++) {
            x[i].classList.remove("autocomplete-active");
        }
    }

    function closeAllLists(elmnt) {
        const x = document.getElementsByClassName("autocomplete-items");
        for (let i = 0; i < x.length; i++) {
            if (elmnt != x[i] && elmnt != inp) {
                x[i].parentNode.removeChild(x[i]);
            }
        }
    }

    document.addEventListener("click", function (e) {
        closeAllLists(e.target);
    });
}

document.getElementById('playAgainBtn').addEventListener('click', loadGame);
document.getElementById('giveUpBtn').addEventListener('click', () => {
    endGame(`The correct player was <strong>${answer.name}</strong>.`);
});

window.onload = loadGame;