/**
 * SkillForge: Neon Operator Edition
 * Sci-Fi / Cyber-Tech HUD mechanics: System Integrity, Data Upload, Uptime, Tech Feedback Panel
 */

const DAILY_XP_GOAL = 50;

const app = {
    // --- Core State ---
    data: [],
    currentMode: null,
    currentTopic: null,
    questions: [],
    currentIndex: 0,
    score: 0,
    userAnswers: [],
    timerInterval: null,
    timerSeconds: 0,

    // --- Gamification State ---
    hearts: 5,
    xp: 0,
    todayXP: 0,
    streak: 0,
    lastPlayedDate: null,
    selectedKey: null,       // Currently selected option key (practice mode: wait for CHECK)
    selectedBtn: null,       // Currently selected button element
    lostHeartsThisLesson: false,

    // --- DOM Cache ---
    dom: {},

    cacheDom: function() {
        this.dom = {
            views: document.querySelectorAll('.view'),
            homeView: document.getElementById('home-view'),
            topicView: document.getElementById('topic-view'),
            quizView: document.getElementById('quiz-view'),
            resultView: document.getElementById('result-view'),
            topicsGrid: document.getElementById('topics-grid'),
            // Top Bar
            streakCount: document.getElementById('streak-count'),
            xpCount: document.getElementById('xp-count'),
            heartCount: document.getElementById('heart-count'),
            flameIcon: document.getElementById('flame-icon'),
            // Daily Goal
            goalRingFill: document.getElementById('goal-ring-fill'),
            goalXPText: document.getElementById('goal-xp-text'),
            dailyGoalWidget: document.getElementById('daily-goal-widget'),
            // Quiz
            progressText: document.getElementById('progress-text'),
            progressFill: document.getElementById('progress-fill'),
            timerBox: document.getElementById('timer-box'),
            topicBadge: document.getElementById('q-topic-badge'),
            questionText: document.getElementById('q-text'),
            optionsContainer: document.getElementById('options-container'),
            quizHeartCount: document.getElementById('quiz-heart-count'),
            mascot: document.getElementById('mascot'),
            mascotFace: document.getElementById('mascot-face'),
            // Footer buttons
            btnCheck: document.getElementById('btn-check'),
            btnNext: document.getElementById('btn-next'),
            btnSubmit: document.getElementById('btn-submit'),
            quizFixedFooter: document.getElementById('quiz-fixed-footer'),
            // Bottom sheet
            bottomSheet: document.getElementById('bottom-sheet'),
            bottomSheetOverlay: document.getElementById('bottom-sheet-overlay'),
            sheetIcon: document.getElementById('sheet-icon'),
            sheetTitle: document.getElementById('sheet-title'),
            sheetExplanation: document.getElementById('sheet-explanation'),
            sheetContinueBtn: document.getElementById('sheet-continue-btn'),
            // Game Over
            gameoverOverlay: document.getElementById('gameover-overlay'),
            // Results
            scorePercentage: document.getElementById('score-percentage'),
            perfMsg: document.getElementById('performance-msg'),
            resTotal: document.getElementById('res-total'),
            resCorrect: document.getElementById('res-correct'),
            resWrong: document.getElementById('res-wrong'),
            xpEarnedValue: document.getElementById('xp-earned-value'),
            confettiCanvas: document.getElementById('confetti-canvas'),
        };
    },

    // --- Initialization ---
    init: async function() {
        this.cacheDom();
        this.loadUserState();
        this.updateStreak();
        this.renderStats();

        try {
            const response = await fetch('questions.json');
            if (!response.ok) throw new Error("Failed to load questions");
            this.data = await response.json();
            console.log("SkillForge Neon Operator loaded:", this.data.length, "queries");
        } catch (error) {
            console.error(error);
            alert("SYSTEM ERROR: Failed to load query database. Ensure local server is active.");
        }
    },

    // =====================
    // PERSISTENCE (localStorage)
    // =====================
    loadUserState: function() {
        this.xp = parseInt(localStorage.getItem('user_xp')) || 0;
        this.hearts = parseInt(localStorage.getItem('heart_count'));
        if (isNaN(this.hearts) || this.hearts < 0) this.hearts = 5;
        this.streak = parseInt(localStorage.getItem('streak_count')) || 0;
        this.lastPlayedDate = localStorage.getItem('last_played_date') || null;
        this.todayXP = parseInt(localStorage.getItem('today_xp')) || 0;

        // Reset todayXP if it's a new day
        const today = this.getDateString();
        const storedDate = localStorage.getItem('today_xp_date');
        if (storedDate !== today) {
            this.todayXP = 0;
            localStorage.setItem('today_xp', '0');
            localStorage.setItem('today_xp_date', today);
        }
    },

    saveUserState: function() {
        localStorage.setItem('user_xp', this.xp);
        localStorage.setItem('heart_count', this.hearts);
        localStorage.setItem('streak_count', this.streak);
        localStorage.setItem('last_played_date', this.lastPlayedDate);
        localStorage.setItem('today_xp', this.todayXP);
        localStorage.setItem('today_xp_date', this.getDateString());
    },

    getDateString: function(date) {
        const d = date || new Date();
        return d.toISOString().split('T')[0]; // "YYYY-MM-DD"
    },

    // =====================
    // STREAK LOGIC
    // =====================
    updateStreak: function() {
        const today = this.getDateString();
        if (!this.lastPlayedDate) {
            // First time user
            this.streak = 0;
            return;
        }

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = this.getDateString(yesterday);

        if (this.lastPlayedDate === today) {
            // Already played today, keep streak
        } else if (this.lastPlayedDate === yesterdayStr) {
            // Played yesterday → increment on first activity today
            // (Will be incremented in markActivity)
        } else {
            // Streak broken
            this.streak = 0;
        }
        this.saveUserState();
    },

    markActivity: function() {
        const today = this.getDateString();
        if (this.lastPlayedDate !== today) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = this.getDateString(yesterday);

            if (this.lastPlayedDate === yesterdayStr) {
                this.streak++;
            } else if (!this.lastPlayedDate || this.lastPlayedDate < yesterdayStr) {
                this.streak = 1;
            }

            this.lastPlayedDate = today;
            this.saveUserState();
            this.renderStats();
        }
    },

    // =====================
    // XP LOGIC
    // =====================
    awardXP: function(amount) {
        this.xp += amount;
        this.todayXP += amount;
        this.saveUserState();
        this.renderStats();

        // Pulse animation
        this.dom.xpCount.classList.add('xp-pulse');
        setTimeout(() => this.dom.xpCount.classList.remove('xp-pulse'), 500);
    },

    // =====================
    // HEARTS LOGIC
    // =====================
    loseHeart: function() {
        if (this.hearts > 0) {
            this.hearts--;
            this.lostHeartsThisLesson = true;
            this.saveUserState();
            this.renderStats();

            // Shield deplete animation
            const heartEl = this.dom.heartCount.parentElement;
            heartEl.classList.add('heart-break');
            setTimeout(() => heartEl.classList.remove('heart-break'), 500);

            // Screen flash red
            const appEl = document.querySelector('.app-container');
            appEl.classList.add('screen-flash-red');
            setTimeout(() => appEl.classList.remove('screen-flash-red'), 400);
        }

        if (this.hearts <= 0) {
            // Delay so user sees the bottom sheet first
            setTimeout(() => this.showGameOver(), 800);
        }
    },

    refillHearts: function() {
        this.hearts = 5;
        this.saveUserState();
        this.renderStats();
    },

    // =====================
    // UI RENDERING
    // =====================
    renderStats: function() {
        this.dom.streakCount.innerText = this.streak;
        this.dom.xpCount.innerText = this.todayXP;
        this.dom.heartCount.innerText = this.hearts;

        // Quiz hearts (if in quiz)
        if (this.dom.quizHeartCount) {
            this.dom.quizHeartCount.innerText = this.hearts;
        }

        // Daily goal ring
        const progress = Math.min(this.todayXP / DAILY_XP_GOAL, 1);
        const circumference = 2 * Math.PI * 34; // r=34
        const offset = circumference * (1 - progress);
        this.dom.goalRingFill.style.strokeDashoffset = offset;
        this.dom.goalXPText.innerText = this.todayXP;
    },

    // =====================
    // MASCOT
    // =====================
    setMascot: function(state) {
        const mascot = this.dom.mascot;
        const face = this.dom.mascotFace;

        mascot.className = 'mascot';

        if (state === 'happy') {
            face.innerText = '◈';
            mascot.classList.add('happy');
        } else if (state === 'sad') {
            face.innerText = '⚠';
            mascot.classList.add('sad');
        } else if (state === 'thinking') {
            face.innerText = '⬡';
        } else {
            face.innerText = '⟐';
        }
    },

    // =====================
    // NAVIGATION
    // =====================
    switchView: function(viewId) {
        this.dom.views.forEach(view => {
            view.classList.remove('active');
            setTimeout(() => {
                if (view.id !== viewId) view.classList.add('hidden');
            }, 300);
        });

        const target = document.getElementById(viewId);
        target.classList.remove('hidden');
        void target.offsetWidth;
        target.classList.add('active');

        // Show/hide top bar elements depending on view
        const isQuiz = viewId === 'quiz-view';
        this.dom.dailyGoalWidget.style.display = isQuiz ? 'none' : 'flex';
    },

    setMode: function(mode) {
        this.currentMode = mode;
        this.loadTopics();
        this.switchView('topic-view');
    },

    goHome: function() {
        this.stopTimer();
        this.hideBottomSheet();
        this.hideGameOver();
        this.switchView('home-view');
        this.currentMode = null;
    },

    confirmQuit: function() {
        if (confirm('Abort current operation?')) {
            this.goHome();
        }
    },

    // =====================
    // TOPICS
    // =====================
    loadTopics: function() {
        const topicCounts = this.data.reduce((acc, curr) => {
            acc[curr.Topic] = (acc[curr.Topic] || 0) + 1;
            return acc;
        }, {});

        this.dom.topicsGrid.innerHTML = '';

        const topicEmojis = ['⬡', '◇', '◈', '⟐', '▣', '△', '⏣', '⎔', '⬢', '⏢'];
        let emojiIndex = 0;

        Object.keys(topicCounts).forEach(topic => {
            const card = document.createElement('div');
            card.className = 'card topic-card';
            const emoji = topicEmojis[emojiIndex % topicEmojis.length];
            emojiIndex++;
            card.innerHTML = `
                <div style="font-size:1.8rem;margin-bottom:6px;">${emoji}</div>
                <h4>${topic}</h4>
                <span>${topicCounts[topic]} QUERIES</span>
            `;
            card.onclick = () => this.startQuiz(topic);
            this.dom.topicsGrid.appendChild(card);
        });
    },

    // =====================
    // QUIZ LOGIC
    // =====================
    startQuiz: function(topic) {
        this.currentTopic = topic;
        this.questions = this.data
            .filter(q => q.Topic === topic)
            .sort(() => 0.5 - Math.random());

        this.currentIndex = 0;
        this.score = 0;
        this.lostHeartsThisLesson = false;
        this.userAnswers = new Array(this.questions.length).fill(null);
        this.selectedKey = null;
        this.selectedBtn = null;

        this.setupQuizUI();
        this.loadQuestion();
        this.switchView('quiz-view');
        this.setMascot('thinking');
    },

    restartTopic: function() {
        this.refillHearts();
        this.startQuiz(this.currentTopic);
    },

    refillAndRestart: function() {
        this.hideGameOver();
        this.refillHearts();
        this.startQuiz(this.currentTopic);
    },

    setupQuizUI: function() {
        const isTest = this.currentMode === 'test';

        if (isTest) {
            this.dom.timerBox.classList.remove('hidden');
            this.startTimer();
        } else {
            this.dom.timerBox.classList.add('hidden');
        }

        this.renderStats();
    },

    loadQuestion: function() {
        const q = this.questions[this.currentIndex];
        const isTest = this.currentMode === 'test';

        this.selectedKey = null;
        this.selectedBtn = null;

        // Update Progress
        this.dom.progressText.innerText = `${this.currentIndex + 1} / ${this.questions.length}`;
        const pct = ((this.currentIndex) / this.questions.length) * 100;
        this.dom.progressFill.style.width = `${pct}%`;

        // Render Content
        this.dom.topicBadge.innerText = q.Topic;
        this.dom.questionText.innerText = q.Question_Text;

        // Render Options
        this.dom.optionsContainer.innerHTML = '';
        const savedAnswer = this.userAnswers[this.currentIndex];

        for (let i = 1; i <= 4; i++) {
            const choiceKey = `choice_${i}`;
            const choiceText = q[choiceKey];

            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = choiceText;
            btn.dataset.key = choiceKey;
            btn.onclick = () => this.selectOption(choiceKey, btn);

            if (isTest && savedAnswer === choiceKey) {
                btn.classList.add('selected');
                this.selectedKey = choiceKey;
                this.selectedBtn = btn;
            }

            this.dom.optionsContainer.appendChild(btn);
        }

        // Button states
        const isLast = this.currentIndex === this.questions.length - 1;

        if (isTest) {
            // Test mode: show CHECK which acts as "save & next" or "submit" on last
            this.dom.btnCheck.classList.add('hidden');
            if (isLast) {
                this.dom.btnNext.classList.add('hidden');
                this.dom.btnSubmit.classList.remove('hidden');
            } else {
                this.dom.btnNext.classList.remove('hidden');
                this.dom.btnSubmit.classList.add('hidden');
            }
        } else {
            // Practice mode: show CHECK, hide next/submit
            this.dom.btnCheck.classList.remove('hidden');
            this.dom.btnCheck.disabled = true;
            this.dom.btnNext.classList.add('hidden');
            this.dom.btnSubmit.classList.add('hidden');
        }

        this.setMascot('thinking');
    },

    selectOption: function(key, btn) {
        // Remove previous selection
        const allBtns = this.dom.optionsContainer.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.classList.remove('selected'));

        btn.classList.add('selected');
        this.selectedKey = key;
        this.selectedBtn = btn;

        if (this.currentMode === 'test') {
            this.userAnswers[this.currentIndex] = key;
        }

        // Enable CHECK button
        this.dom.btnCheck.disabled = false;
    },

    // Called when user presses CHECK (practice mode)
    checkAnswer: function() {
        if (!this.selectedKey) return;

        const q = this.questions[this.currentIndex];
        const answerVal = q.answer_key;
        const correctAnswerKey = String(answerVal).startsWith('choice_')
            ? answerVal
            : `choice_${answerVal}`;

        const allBtns = this.dom.optionsContainer.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.disabled = true);

        const isCorrect = this.selectedKey === correctAnswerKey;

        if (isCorrect) {
            this.selectedBtn.classList.add('correct');
            this.score++;
            this.awardXP(10);
            this.markActivity();
            this.setMascot('happy');
            this.showBottomSheet(true, q.Solution);
        } else {
            this.selectedBtn.classList.add('wrong');
            const correctBtn = [...allBtns].find(b => b.dataset.key === correctAnswerKey);
            if (correctBtn) correctBtn.classList.add('correct');
            this.loseHeart();
            this.setMascot('sad');
            this.showBottomSheet(false, q.Solution);
        }

        // Hide CHECK so user must use the sheet's CONTINUE
        this.dom.btnCheck.classList.add('hidden');
    },

    // =====================
    // BOTTOM SHEET FEEDBACK
    // =====================
    showBottomSheet: function(isCorrect, explanation) {
        const sheet = this.dom.bottomSheet;
        const overlay = this.dom.bottomSheetOverlay;

        sheet.classList.remove('hidden', 'sheet-correct', 'sheet-wrong');
        overlay.classList.remove('hidden');

        if (isCorrect) {
            sheet.classList.add('sheet-correct');
            this.dom.sheetIcon.innerText = '▣';
            this.dom.sheetTitle.innerText = 'ACCESS GRANTED';
        } else {
            sheet.classList.add('sheet-wrong');
            this.dom.sheetIcon.innerText = '⚠';
            this.dom.sheetTitle.innerText = 'ERROR DETECTED';
        }

this.dom.sheetExplanation.innerText = explanation || 'No diagnostic data available.';

        // Trigger slide-up animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                sheet.classList.add('visible');
            });
        });
    },

    hideBottomSheet: function() {
        const sheet = this.dom.bottomSheet;
        sheet.classList.remove('visible');
        setTimeout(() => {
            sheet.classList.add('hidden');
            sheet.classList.remove('sheet-correct', 'sheet-wrong');
            this.dom.bottomSheetOverlay.classList.add('hidden');
        }, 350);
    },

    sheetContinue: function() {
        this.hideBottomSheet();

        // If game over (hearts == 0), don't advance
        if (this.hearts <= 0) return;

        // Advance to next or finish
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.loadQuestion();
        } else {
            this.finishPractice();
        }
    },

    // =====================
    // GAME OVER
    // =====================
    showGameOver: function() {
        this.hideBottomSheet();
        this.dom.gameoverOverlay.classList.remove('hidden');
    },

    hideGameOver: function() {
        this.dom.gameoverOverlay.classList.add('hidden');
    },

    // =====================
    // NEXT / NAVIGATION
    // =====================
    nextQuestion: function() {
        // For test mode navigation
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.loadQuestion();
        }
    },

    // =====================
    // TIMER (Test Mode)
    // =====================
    startTimer: function() {
        this.timerSeconds = 0;
        this.updateTimerDisplay();
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this.updateTimerDisplay();
        }, 1000);
    },

    stopTimer: function() {
        clearInterval(this.timerInterval);
    },

    updateTimerDisplay: function() {
        const mins = Math.floor(this.timerSeconds / 60).toString().padStart(2, '0');
        const secs = (this.timerSeconds % 60).toString().padStart(2, '0');
        this.dom.timerBox.innerText = `${mins}:${secs}`;
    },

    // =====================
    // RESULTS
    // =====================
    finishPractice: function() {
        // Practice mode completion
        const percentage = Math.round((this.score / this.questions.length) * 100);

        // Bonus XP for no hearts lost
        let bonusXP = 0;
        if (!this.lostHeartsThisLesson) {
            bonusXP = 5;
            this.awardXP(bonusXP);
        }

        this.markActivity();
        this.showResults(this.score, this.questions.length, bonusXP);
    },

    finishTest: function() {
        this.stopTimer();

        let correctCount = 0;
        this.questions.forEach((q, index) => {
            const answerVal = q.answer_key;
            const correctAnswerKey = String(answerVal).startsWith('choice_')
                ? answerVal
                : `choice_${answerVal}`;

            if (this.userAnswers[index] === correctAnswerKey) {
                correctCount++;
            }
        });

        // Award XP for test mode
        const xpEarned = correctCount * 10;
        this.awardXP(xpEarned);
        this.markActivity();

        let bonusXP = 0;
        // No hearts bonus in test mode since hearts aren't deducted
        this.showResults(correctCount, this.questions.length, bonusXP);
    },

    showResults: function(correctCount, total, bonusXP) {
        const percentage = Math.round((correctCount / total) * 100);
        const totalXP = correctCount * 10 + bonusXP;

        let msg = "ANALYSIS: SUBOPTIMAL — RETRY ADVISED";
        if (percentage >= 90) msg = "ANALYSIS: OPTIMAL — ELITE CLEARANCE";
        else if (percentage >= 70) msg = "ANALYSIS: EFFECTIVE — PROCEED";
        else if (percentage >= 50) msg = "ANALYSIS: ADEQUATE — REVIEW SUGGESTED";

        this.dom.scorePercentage.innerText = `${percentage}%`;
        this.dom.perfMsg.innerText = msg;
        this.dom.resTotal.innerText = total;
        this.dom.resCorrect.innerText = correctCount;
        this.dom.resWrong.innerText = total - correctCount;
        this.dom.xpEarnedValue.innerText = `+${totalXP} DU`;

        const circle = document.querySelector('.score-circle');
        if (percentage >= 70) circle.style.borderColor = 'var(--neon-green)';
        else if (percentage < 50) circle.style.borderColor = 'var(--neon-red)';
        else circle.style.borderColor = 'var(--neon-cyan)';

        // Complete progress bar
        this.dom.progressFill.style.width = '100%';

        this.switchView('result-view');

        // Confetti!
        if (percentage >= 50) {
            this.launchConfetti();
        }
    },

    // =====================
    // CONFETTI EFFECT
    // =====================
    launchConfetti: function() {
        const canvas = this.dom.confettiCanvas;
        if (!canvas || !canvas.getContext) {
            // Fallback: CSS confetti
            this.cssConfetti();
            return;
        }

        const ctx = canvas.getContext('2d');
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        const colors = ['#0ea5e9', '#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#22d3ee'];
        const particles = [];

        for (let i = 0; i < 60; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * -canvas.height,
                w: Math.random() * 3 + 2,
                h: Math.random() * 12 + 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                speed: Math.random() * 4 + 3,
                angle: Math.random() * 0.3 - 0.15,
                spin: (Math.random() - 0.5) * 0.05,
                opacity: 1,
            });
        }

        let frame = 0;
        const maxFrames = 150;

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.y += p.speed;
                p.angle += p.spin;
                p.opacity -= 0.005;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.globalAlpha = Math.max(p.opacity, 0);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            });

            frame++;
            if (frame < maxFrames) {
                requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        animate();
    },

    cssConfetti: function() {
        const container = document.querySelector('.result-container');
        const colors = ['#0ea5e9', '#6366f1', '#10b981', '#f43f5e', '#f59e0b'];

        for (let i = 0; i < 30; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = Math.random() * 1.5 + 's';
            piece.style.animationDuration = (Math.random() * 1.5 + 2) + 's';
            container.appendChild(piece);

            setTimeout(() => piece.remove(), 4000);
        }
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});