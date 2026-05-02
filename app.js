// --- State Management ---
const StorageKey = 'vokabelAppProgress';

// Default state
let state = {
    currentWeekId: 1,
    currentDay: 1,
    stars: 0
};

// Load state from local storage
function loadState() {
    const saved = localStorage.getItem(StorageKey);
    if (saved) {
        state = JSON.parse(saved);
    }
}

function saveState() {
    localStorage.setItem(StorageKey, JSON.stringify(state));
    updateHeaderStars();
}

// Global App Object to hold methods exposed to HTML
window.app = {};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    updateHeaderStars();
    app.showDashboard();
});

function updateHeaderStars() {
    document.getElementById('star-count').innerText = state.stars;
}

// --- Speech Synthesis Helper ---
let availableVoices = [];
if ('speechSynthesis' in window) {
    // Load voices initially
    availableVoices = speechSynthesis.getVoices();
    // Update when voices are loaded asynchronously by the browser
    speechSynthesis.onvoiceschanged = () => {
        availableVoices = speechSynthesis.getVoices();
    };
}

function speakText(text, lang = 'en') {
    if (!('speechSynthesis' in window)) return;
    
    speechSynthesis.cancel(); // Stop anything currently speaking
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (lang === 'en') {
        utterance.lang = 'en-US';
        
        // Prioritize natural-sounding human voices
        const preferredVoiceNames = ['Google US English', 'Google UK English Female', 'Samantha', 'Daniel', 'Karen', 'Tessa', 'Moira'];
        let selectedVoice = null;
        
        // 1. Try to find a preferred natural voice
        for (const name of preferredVoiceNames) {
            const voice = availableVoices.find(v => v.name.includes(name) && v.lang.startsWith('en'));
            if (voice) {
                selectedVoice = voice;
                break;
            }
        }
        
        // 2. Fallback to any English voice
        if (!selectedVoice) {
            selectedVoice = availableVoices.find(v => v.lang.startsWith('en'));
        }
        
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }
        
        utterance.rate = 0.85; // Slightly slower for kids
        utterance.pitch = 1.1; // Slightly friendlier
    }
    
    speechSynthesis.speak(utterance);
}


// --- View Management ---
function switchView(viewId) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
        view.classList.add('hidden');
    });
    // Show target view
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        target.classList.add('active');
    }
}

// --- Dashboard ---
app.showDashboard = () => {
    switchView('view-dashboard');
    
    const weekSel = document.getElementById('week-selector');
    if (weekSel) {
        weekSel.innerHTML = '';
        vocabData.forEach(w => {
            const opt = document.createElement('option');
            opt.value = w.weekId;
            opt.innerText = `Woche ${w.weekId}: ${w.topic}`;
            if (w.weekId === state.currentWeekId) opt.selected = true;
            weekSel.appendChild(opt);
        });
    }
    
    app.updateDaySelector();
};

app.updateDaySelector = () => {
    const daySel = document.getElementById('day-selector');
    if (!daySel) return;
    
    daySel.innerHTML = '';
    const weekData = vocabData.find(w => w.weekId === state.currentWeekId);
    
    if (weekData) {
        weekData.days.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.day;
            opt.innerText = d.day;
            if (d.day === state.currentDay) opt.selected = true;
            daySel.appendChild(opt);
        });
        document.getElementById('start-learning-btn').style.display = 'inline-block';
    } else {
        document.getElementById('start-learning-btn').style.display = 'none';
    }
};

app.changeWeek = (weekId) => {
    state.currentWeekId = parseInt(weekId);
    state.currentDay = 1;
    saveState();
    app.updateDaySelector();
};

app.changeDay = (day) => {
    state.currentDay = parseInt(day);
    saveState();
};

app.resetProgress = () => {
    if(confirm("Möchtest du wirklich deinen gesamten Fortschritt löschen?")) {
        state = { currentWeekId: 1, currentDay: 1, stars: 0 };
        saveState();
        app.showDashboard();
    }
}

// --- Daily Vocabulary ---
let dailyWords = [];
let currentWordIndex = 0;

app.startDailyVocab = () => {
    const weekData = vocabData.find(w => w.weekId === state.currentWeekId);
    if (!weekData) return;
    
    const dayData = weekData.days.find(d => d.day === state.currentDay);
    if (!dayData) return;

    dailyWords = dayData.words;
    currentWordIndex = 0;
    
    document.getElementById('vocab-day').innerText = state.currentDay;
    document.getElementById('vocab-topic').innerText = weekData.topic;
    
    renderFlashcard();
    switchView('view-daily-vocab');
};

function renderFlashcard() {
    const card = document.getElementById('current-flashcard');
    card.classList.remove('is-flipped');
    
    const word = dailyWords[currentWordIndex];
    document.getElementById('card-front-text').innerText = word.de;
    document.getElementById('card-back-text').innerText = word.en;
    
    document.getElementById('word-progress').innerText = `${currentWordIndex + 1} / ${dailyWords.length}`;
    
    // Manage buttons
    document.getElementById('prev-word-btn').disabled = currentWordIndex === 0;
    
    if (currentWordIndex === dailyWords.length - 1) {
        document.getElementById('next-word-btn').classList.add('hidden');
        document.getElementById('finish-daily-btn').classList.remove('hidden');
    } else {
        document.getElementById('next-word-btn').classList.remove('hidden');
        document.getElementById('finish-daily-btn').classList.add('hidden');
    }
}

app.flipCard = () => {
    const card = document.getElementById('current-flashcard');
    card.classList.toggle('is-flipped');
};

app.nextWord = () => {
    if (currentWordIndex < dailyWords.length - 1) {
        currentWordIndex++;
        renderFlashcard();
    }
};

app.prevWord = () => {
    if (currentWordIndex > 0) {
        currentWordIndex--;
        renderFlashcard();
    }
};

app.speakWord = (e) => {
    e.stopPropagation(); // Prevent flipping the card
    const word = dailyWords[currentWordIndex].en;
    speakText(word, 'en');
};

app.finishDaily = () => {
    // Reward stars
    state.stars += 5;
    
    // Advance progress
    const weekData = vocabData.find(w => w.weekId === state.currentWeekId);
    if (state.currentDay < weekData.days.length) {
        state.currentDay++;
    } else {
        // Move to next week
        state.currentWeekId++;
        state.currentDay = 1;
    }
    
    saveState();
    triggerConfetti();
    setTimeout(() => {
        app.showDashboard();
    }, 1500);
};

// --- Test Setup ---
app.showTestSetup = () => {
    switchView('view-test-setup');
    const container = document.getElementById('week-selection');
    container.innerHTML = '';
    
    vocabData.forEach(week => {
        const label = document.createElement('label');
        label.className = 'week-checkbox-label';
        
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = week.weekId;
        // Pre-check weeks they've already completed or are currently doing
        if (week.weekId <= state.currentWeekId) {
            cb.checked = true;
        }
        
        const text = document.createTextNode(`Woche ${week.weekId}: ${week.topic}`);
        
        label.appendChild(cb);
        label.appendChild(text);
        container.appendChild(label);
    });
};

// --- Test Logic ---
let testWords = [];
let currentTestIndex = 0;
let testScore = 0;
let currentCorrectAnswer = "";

app.startTest = () => {
    const checkboxes = document.querySelectorAll('#week-selection input:checked');
    const selectedWeeks = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (selectedWeeks.length === 0) {
        alert("Bitte wähle mindestens eine Woche aus!");
        return;
    }
    
    // Gather all words from selected weeks
    let allWords = [];
    selectedWeeks.forEach(weekId => {
        const week = vocabData.find(w => w.weekId === weekId);
        if (week) {
            week.days.forEach(day => {
                allWords = allWords.concat(day.words);
            });
        }
    });
    
    // Shuffle and pick max 15 words for the test
    allWords = shuffleArray(allWords);
    testWords = allWords.slice(0, 15);
    
    if (testWords.length === 0) return;
    
    currentTestIndex = 0;
    testScore = 0;
    document.getElementById('test-score').innerText = testScore;
    
    switchView('view-test');
    renderTestQuestion();
};

app.cancelTest = () => {
    if(confirm("Test wirklich abbrechen?")) {
        app.showDashboard();
    }
};

function renderTestQuestion() {
    const word = testWords[currentTestIndex];
    document.getElementById('test-word').innerText = word.de;
    currentCorrectAnswer = word.en;
    
    // Reset UI
    document.getElementById('test-feedback').className = 'feedback hidden';
    document.getElementById('test-next-btn').classList.add('hidden');
    document.getElementById('test-mc-area').classList.add('hidden');
    document.getElementById('test-type-area').classList.add('hidden');
    
    // Decide question type: 60% MC, 40% Type
    const isMC = Math.random() < 0.6;
    
    if (isMC) {
        setupMcQuestion(word);
    } else {
        setupTypeQuestion();
    }
}

function setupMcQuestion(correctWord) {
    document.getElementById('test-mc-area').classList.remove('hidden');
    document.getElementById('test-mc-area').classList.remove('disabled');
    
    // Generate options
    let options = [correctWord.en];
    
    // Get 3 random wrong words from our pool
    let pool = [...testWords];
    pool = pool.filter(w => w.en !== correctWord.en);
    pool = shuffleArray(pool);
    
    for (let i = 0; i < 3 && i < pool.length; i++) {
        options.push(pool[i].en);
    }
    
    // Fill remaining if pool wasn't large enough
    const fallbacks = ["apple", "house", "car", "dog", "blue"];
    while (options.length < 4) {
        let fb = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        if (!options.includes(fb)) options.push(fb);
    }
    
    options = shuffleArray(options);
    
    for (let i = 0; i < 4; i++) {
        const btn = document.getElementById(`mc-btn-${i}`);
        btn.innerText = options[i];
        btn.className = 'btn btn-mc'; // Reset classes
        btn.onclick = () => app.checkMcAnswer(i, options[i] === correctWord.en);
    }
}

function setupTypeQuestion() {
    document.getElementById('test-type-area').classList.remove('hidden');
    const input = document.getElementById('test-type-input');
    input.value = '';
    input.disabled = false;
    input.focus();
}

app.checkMcAnswer = (btnIndex, isCorrect) => {
    document.getElementById('test-mc-area').classList.add('disabled');
    const btn = document.getElementById(`mc-btn-${btnIndex}`);
    
    if (isCorrect) {
        btn.classList.add('correct');
        handleCorrect();
    } else {
        btn.classList.add('wrong');
        handleWrong(currentCorrectAnswer);
        
        // Highlight correct one
        for (let i = 0; i < 4; i++) {
            const b = document.getElementById(`mc-btn-${i}`);
            if (b.innerText === currentCorrectAnswer) {
                b.classList.add('correct');
            }
        }
    }
    
    document.getElementById('test-next-btn').classList.remove('hidden');
};

app.handleTypeKeyPress = (e) => {
    if (e.key === 'Enter') {
        app.checkTypeAnswer();
    }
};

app.checkTypeAnswer = () => {
    const input = document.getElementById('test-type-input');
    const answer = input.value.trim().toLowerCase();
    const correct = currentCorrectAnswer.toLowerCase();
    
    if (!answer) return;
    
    input.disabled = true;
    
    // Simple tolerance: allow exact match
    if (answer === correct) {
        input.style.borderColor = 'var(--success)';
        handleCorrect();
    } else {
        input.style.borderColor = 'var(--primary)';
        handleWrong(currentCorrectAnswer);
    }
    
    document.getElementById('test-next-btn').classList.remove('hidden');
};

function handleCorrect() {
    testScore++;
    document.getElementById('test-score').innerText = testScore;
    showFeedback(true, "Richtig! 🎉");
    speakText("Correct!", 'en');
}

function handleWrong(correctWord) {
    showFeedback(false, `Schade! Richtig wäre: "${correctWord}"`);
}

function showFeedback(isCorrect, text) {
    const fb = document.getElementById('test-feedback');
    fb.innerText = text;
    fb.className = `feedback ${isCorrect ? 'correct' : 'wrong'}`;
    fb.classList.remove('hidden');
}

app.nextTestQuestion = () => {
    currentTestIndex++;
    if (currentTestIndex < testWords.length) {
        renderTestQuestion();
    } else {
        finishTest();
    }
};

function finishTest() {
    switchView('view-test-result');
    document.getElementById('final-score').innerText = testScore;
    document.getElementById('total-questions').innerText = testWords.length;
    
    // Award stars based on score
    const percentage = testScore / testWords.length;
    let earnedStars = Math.floor(testScore * 2); // 2 stars per correct answer
    if (percentage === 1) earnedStars += 10; // Bonus for perfect!
    
    document.getElementById('stars-earned-amount').innerText = earnedStars;
    state.stars += earnedStars;
    saveState();
    
    if (percentage >= 0.5) {
        triggerConfetti();
    }
}

// --- Utils ---
function shuffleArray(array) {
    let curId = array.length;
    while (0 !== curId) {
        let randId = Math.floor(Math.random() * curId);
        curId -= 1;
        let tmp = array[curId];
        array[curId] = array[randId];
        array[randId] = tmp;
    }
    return array;
}

function triggerConfetti() {
    if (typeof confetti === 'function') {
        const duration = 3000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#FF6B6B', '#4ECDC4', '#FFE66D']
            });
            confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#FF6B6B', '#4ECDC4', '#FFE66D']
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    }
}
