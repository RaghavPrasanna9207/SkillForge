/**
 * SkillForge - Frontend Logic
 * Handles state management, view switching, and quiz logic.
 */

const app = {
    // --- State Management ---
    data: [],           // All questions loaded from JSON
    currentMode: null,  // 'practice' or 'test'
    currentTopic: null,
    questions: [],      // Filtered questions for current session
    currentIndex: 0,
    score: 0,
    userAnswers: [],    // Stores { questionId, selectedOption, isCorrect }
    timerInterval: null,
    timerSeconds: 0,

    // --- DOM Elements Cache ---
    dom: {
        views: document.querySelectorAll('.view'),
        homeView: document.getElementById('home-view'),
        topicView: document.getElementById('topic-view'),
        quizView: document.getElementById('quiz-view'),
        resultView: document.getElementById('result-view'),
        topicsGrid: document.getElementById('topics-grid'),
        // Quiz Elements
        progressText: document.getElementById('progress-text'),
        progressFill: document.getElementById('progress-fill'),
        timerBox: document.getElementById('timer-box'),
        topicBadge: document.getElementById('q-topic-badge'),
        questionText: document.getElementById('q-text'),
        optionsContainer: document.getElementById('options-container'),
        explanationBox: document.getElementById('explanation-box'),
        explanationText: document.getElementById('explanation-text'),
        btnNext: document.getElementById('btn-next'),
        btnSubmit: document.getElementById('btn-submit'),
        // Results Elements
        scorePercentage: document.getElementById('score-percentage'),
        perfMsg: document.getElementById('performance-msg'),
        resTotal: document.getElementById('res-total'),
        resCorrect: document.getElementById('res-correct'),
        resWrong: document.getElementById('res-wrong')
    },

    // --- Initialization ---
    init: async function() {
        try {
            const response = await fetch('questions.json');
            if (!response.ok) throw new Error("Failed to load questions");
            this.data = await response.json();
            console.log("Questions loaded:", this.data.length);
        } catch (error) {
            console.error(error);
            alert("Error loading questions.json. Ensure you are running on a local server.");
        }
    },

    // --- Navigation & View Switching ---
    switchView: function(viewId) {
        this.dom.views.forEach(view => {
            view.classList.remove('active');
            // Small delay to allow display:none to toggle for animation reset
            setTimeout(() => {
                if(view.id !== viewId) view.classList.add('hidden');
            }, 300);
        });

        const target = document.getElementById(viewId);
        target.classList.remove('hidden');
        // Force reflow
        void target.offsetWidth;
        target.classList.add('active');
    },

    setMode: function(mode) {
        this.currentMode = mode;
        this.loadTopics();
        this.switchView('topic-view');
    },

    goHome: function() {
        this.stopTimer();
        this.switchView('home-view');
        this.currentMode = null;
    },

    // --- Topic Handling ---
    loadTopics: function() {
        // Extract unique topics and count
        const topicCounts = this.data.reduce((acc, curr) => {
            acc[curr.Topic] = (acc[curr.Topic] || 0) + 1;
            return acc;
        }, {});

        this.dom.topicsGrid.innerHTML = '';

        Object.keys(topicCounts).forEach(topic => {
            const card = document.createElement('div');
            card.className = 'card topic-card';
            card.innerHTML = `
                <h4>${topic}</h4>
                <span>${topicCounts[topic]} Questions</span>
            `;
            card.onclick = () => this.startQuiz(topic);
            this.dom.topicsGrid.appendChild(card);
        });
    },

    // --- Quiz Logic ---
    startQuiz: function(topic) {
        this.currentTopic = topic;
        // Filter and Shuffle
        this.questions = this.data
            .filter(q => q.Topic === topic)
            .sort(() => 0.5 - Math.random());

        this.currentIndex = 0;
        this.score = 0;
        this.userAnswers = new Array(this.questions.length).fill(null);

        this.setupQuizUI();
        this.loadQuestion();
        this.switchView('quiz-view');
    },

    restartTopic: function() {
        this.startQuiz(this.currentTopic);
    },

    setupQuizUI: function() {
        const isTest = this.currentMode === 'test';

        // Timer visibility
        if (isTest) {
            this.dom.timerBox.classList.remove('hidden');
            this.startTimer();
        } else {
            this.dom.timerBox.classList.add('hidden');
        }

        // Button states
        this.dom.btnNext.classList.remove('hidden');
        this.dom.btnSubmit.classList.add('hidden');
    },

    loadQuestion: function() {
        const q = this.questions[this.currentIndex];
        const isTest = this.currentMode === 'test';

        // Update Progress
        this.dom.progressText.innerText = `Question ${this.currentIndex + 1} / ${this.questions.length}`;
        const pct = ((this.currentIndex + 1) / this.questions.length) * 100;
        this.dom.progressFill.style.width = `${pct}%`;

        // Render Content
        this.dom.topicBadge.innerText = q.Topic;
        this.dom.questionText.innerText = q.Question_Text;
        this.dom.explanationBox.classList.add('hidden'); // Always hide explanation initially

        // Render Options
        this.dom.optionsContainer.innerHTML = '';

        // Check if previously answered (for navigation in Test Mode)
        const savedAnswer = this.userAnswers[this.currentIndex];

        for (let i = 1; i <= 4; i++) {
            const choiceKey = `choice_${i}`;
            const choiceText = q[choiceKey];

            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerText = choiceText;
            btn.dataset.key = choiceKey;

            // Handle Clicks
            btn.onclick = () => this.handleAnswer(choiceKey, btn);

            // Restore state if in Test Mode and already answered
            if (isTest && savedAnswer === choiceKey) {
                btn.classList.add('selected');
            }

            this.dom.optionsContainer.appendChild(btn);
        }

        // Button Logic (Last Question)
        if (this.currentIndex === this.questions.length - 1) {
            this.dom.btnNext.classList.add('hidden');
            if (isTest) this.dom.btnSubmit.classList.remove('hidden');
        } else {
            this.dom.btnNext.classList.remove('hidden');
            this.dom.btnSubmit.classList.add('hidden');
        }
    },

    handleAnswer: function(selectedKey, btnElement) {
        const q = this.questions[this.currentIndex];

        // --- FIX: Normalize the JSON answer to match button keys ---
        // If JSON says 1, we convert it to "choice_1"
        // If JSON says "choice_1", we keep it as is
        const answerVal = q.answer_key;
        const correctAnswerKey = String(answerVal).startsWith('choice_')
            ? answerVal
            : `choice_${answerVal}`;
        // -----------------------------------------------------------

        if (this.currentMode === 'practice') {
            // PRACTICE MODE: Immediate Feedback

            const allBtns = this.dom.optionsContainer.querySelectorAll('.option-btn');
            allBtns.forEach(b => b.disabled = true);

            if (selectedKey === correctAnswerKey) {
                btnElement.classList.add('correct');
                this.score++;
            } else {
                btnElement.classList.add('wrong');
                // Highlight correct one
                const correctBtn = [...allBtns].find(b => b.dataset.key === correctAnswerKey);
                if(correctBtn) correctBtn.classList.add('correct');
            }

            // Show Solution
            this.dom.explanationText.innerText = q.Solution;
            this.dom.explanationBox.classList.remove('hidden');

        } else {
            // TEST MODE: Selection Only

            const allBtns = this.dom.optionsContainer.querySelectorAll('.option-btn');
            allBtns.forEach(b => b.classList.remove('selected'));

            btnElement.classList.add('selected');

            this.userAnswers[this.currentIndex] = selectedKey;
        }
    },

    nextQuestion: function() {
        if (this.currentIndex < this.questions.length - 1) {
            this.currentIndex++;
            this.loadQuestion();
        }
    },

    // --- Timer Logic (Test Mode) ---
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

    // --- Results Handling ---
    finishTest: function() {
        this.stopTimer();

        // Calculate Score for Test Mode
        let correctCount = 0;
        this.questions.forEach((q, index) => {

            // --- FIX: Same normalization logic here ---
            const answerVal = q.answer_key;
            const correctAnswerKey = String(answerVal).startsWith('choice_')
                ? answerVal
                : `choice_${answerVal}`;
            // ------------------------------------------

            if (this.userAnswers[index] === correctAnswerKey) {
                correctCount++;
            }
        });

        const percentage = Math.round((correctCount / this.questions.length) * 100);

        // Determine Message
        let msg = "Needs Improvement";
        if (percentage >= 90) msg = "Excellent!";
        else if (percentage >= 70) msg = "Good Job!";
        else if (percentage >= 50) msg = "Not Bad";

        // Render Results
        this.dom.scorePercentage.innerText = `${percentage}%`;
        this.dom.perfMsg.innerText = msg;
        this.dom.resTotal.innerText = this.questions.length;
        this.dom.resCorrect.innerText = correctCount;
        this.dom.resWrong.innerText = this.questions.length - correctCount;

        // Colorize score circle based on result
        const circle = document.querySelector('.score-circle');
        if(percentage >= 70) circle.style.borderColor = 'var(--correct)';
        else if (percentage < 50) circle.style.borderColor = 'var(--wrong)';
        else circle.style.borderColor = 'var(--primary)';

        this.switchView('result-view');
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});