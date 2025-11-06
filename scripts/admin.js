// admin.js - COMPLETELY WORKING VERSION WITH QUESTION-BY-QUESTION LEADERBOARD
class GameAdmin {
    constructor() {
        this.currentGame = null;
        this.questions = [];
        this.players = {};
        this.currentQuestionIndex = -1;
        this.gameState = 'waiting';
        this.timer = null;
        this.timeLeft = 0;
        this.questionResults = [];
        
        this.init();
    }

    async init() {
        console.log('🎮 Initializing Game Admin...');
        
        // Wait for Firebase to be ready with retry logic
        let retryCount = 0;
        const maxRetries = 10;
        
        while (retryCount < maxRetries) {
            if (window.sharedStorage && 
                typeof window.sharedStorage.waitForInitialization === 'function' &&
                typeof window.sharedStorage.listenToData === 'function') {
                console.log('✅ sharedStorage is ready with all methods');
                break;
            }
            
            console.log(`⏳ Waiting for sharedStorage... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            retryCount++;
        }
        
        if (retryCount >= maxRetries) {
            console.error('❌ sharedStorage not available after maximum retries');
            alert('System initialization failed. Please refresh the page.');
            return;
        }
        
        try {
            await window.sharedStorage.waitForInitialization();
            console.log('✅ Firebase ready, setting up admin...');
        } catch (error) {
            console.error('❌ Error waiting for Firebase:', error);
        }
        
        // Setup listeners and load game data
        await this.setupEventListeners();
        await this.loadExistingGame();
        console.log('✅ Game Admin fully initialized');
    }

    async setupEventListeners() {
        console.log('🔧 Setting up event listeners...');
        
        // Wait a bit more to ensure sharedStorage is fully ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        this.setupPlayerListeners();
        this.setupAnswerListeners();
    }

    setupPlayerListeners() {
        console.log('👥 Setting up player listeners...');
        
        // Check if sharedStorage is ready with listenToData method
        if (window.sharedStorage && typeof window.sharedStorage.listenToData === 'function') {
            try {
                window.sharedStorage.listenToData('games', (games) => {
                    if (!games) return;
                    
                    const currentGamePin = this.currentGame?.pin;
                    if (currentGamePin && games[currentGamePin]) {
                        this.players = games[currentGamePin].players || {};
                        this.updatePlayersDisplay();
                        this.updateLeaderboard();
                    }
                });
                console.log('✅ Player listeners setup successfully');
            } catch (error) {
                console.error('❌ Error setting up player listeners:', error);
            }
        } else {
            console.error('❌ sharedStorage.listenToData is not available');
            // Retry after 1 second
            setTimeout(() => this.setupPlayerListeners(), 1000);
        }
    }

    setupAnswerListeners() {
        console.log('📝 Setting up answer listeners...');
        
        if (window.sharedStorage && typeof window.sharedStorage.listenToData === 'function') {
            try {
                window.sharedStorage.listenToData(`games/${this.currentGame?.pin}/currentQuestion/answers`, (answers) => {
                    if (answers && this.gameState === 'playing') {
                        this.updateAnswerStats(answers);
                    }
                });
                console.log('✅ Answer listeners setup successfully');
            } catch (error) {
                console.error('❌ Error setting up answer listeners:', error);
            }
        } else {
            // Retry after 1 second
            setTimeout(() => this.setupAnswerListeners(), 1000);
        }
    }

    async createNewGame() {
        const gameName = document.getElementById('game-name').value.trim();
        if (!gameName) {
            alert('Please enter a game name');
            return;
        }

        // Ensure sharedStorage is ready
        if (!window.sharedStorage || typeof window.sharedStorage.generateGamePin !== 'function') {
            alert('System not ready yet. Please wait a moment and try again.');
            return;
        }

        const gamePin = window.sharedStorage.generateGamePin();
        
        this.currentGame = {
            pin: gamePin,
            name: gameName,
            created: Date.now(),
            state: 'waiting',
            players: {},
            questions: [],
            currentQuestion: null
        };

        try {
            await window.sharedStorage.writeData(`games/${gamePin}`, this.currentGame);
            
            // Update UI
            document.getElementById('current-game-pin').textContent = gamePin;
            document.getElementById('share-pin-input').value = gamePin;
            document.getElementById('game-info').innerHTML = `
                <p><strong>Game:</strong> ${gameName}</p>
                <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>Status:</strong> <span class="status-waiting">Waiting for players</span></p>
            `;

            this.questions = [];
            this.questionResults = [];
            this.updateQuestionsDisplay();
            
            console.log(`🎮 Game created: ${gameName} (PIN: ${gamePin})`);
            
            alert(`🎮 Game Created!\n\nGame PIN: ${gamePin}\n\nShare this PIN with players on any device!`);
            
        } catch (error) {
            console.error('❌ Failed to create game:', error);
            alert('Failed to create game. Please check your connection.');
        }
    }

    async addQuestion() {
        if (!this.currentGame) {
            alert('Please create a game first');
            return;
        }

        const questionText = document.getElementById('question-text').value.trim();
        const options = [
            document.getElementById('option1').value.trim(),
            document.getElementById('option2').value.trim(),
            document.getElementById('option3').value.trim(),
            document.getElementById('option4').value.trim()
        ];
        const correctAnswer = parseInt(document.getElementById('correct-answer').value);
        const timeLimit = parseInt(document.getElementById('time-limit').value);

        // Validate inputs
        if (!questionText || options.some(opt => !opt)) {
            alert('Please fill in all fields');
            return;
        }

        const question = {
            id: 'q' + Date.now(),
            text: questionText,
            options: options,
            correctAnswer: correctAnswer,
            timeLimit: timeLimit,
            added: Date.now()
        };

        this.questions.push(question);
        
        // Update Firebase
        await window.sharedStorage.updateData(`games/${this.currentGame.pin}`, {
            questions: this.questions
        });

        this.updateQuestionsDisplay();
        this.clearQuestionForm();
        
        console.log(`❓ Question added: ${questionText}`);
        alert('✅ Question added successfully!');
    }

    updateQuestionsDisplay() {
        const container = document.getElementById('questions-list');
        
        if (this.questions.length === 0) {
            container.innerHTML = '<p class="no-data">No questions added yet</p>';
            return;
        }

        container.innerHTML = this.questions.map((q, index) => `
            <div class="question-item">
                <h4>Question ${index + 1}: ${q.text}</h4>
                <ol type="A">
                    ${q.options.map((opt, i) => `
                        <li class="${i + 1 === q.correctAnswer ? 'correct-answer' : ''}">
                            ${opt} ${i + 1 === q.correctAnswer ? '✅' : ''}
                        </li>
                    `).join('')}
                </ol>
                <p><small>Time limit: ${q.timeLimit}s | Correct: Option ${String.fromCharCode(64 + q.correctAnswer)}</small></p>
                <button onclick="admin.removeQuestion(${index})" class="danger small">Remove</button>
            </div>
        `).join('');
    }

    clearQuestionForm() {
        document.getElementById('question-text').value = '';
        document.getElementById('option1').value = '';
        document.getElementById('option2').value = '';
        document.getElementById('option3').value = '';
        document.getElementById('option4').value = '';
        document.getElementById('correct-answer').value = '1';
        document.getElementById('time-limit').value = '20';
    }

    async removeQuestion(index) {
        if (confirm('Are you sure you want to remove this question?')) {
            this.questions.splice(index, 1);
            await window.sharedStorage.updateData(`games/${this.currentGame.pin}`, {
                questions: this.questions
            });
            this.updateQuestionsDisplay();
        }
    }

    updatePlayersDisplay() {
        const container = document.getElementById('players-list');
        const players = Object.values(this.players);
        
        if (players.length === 0) {
            container.innerHTML = '<p class="no-data">No players have joined yet</p>';
            return;
        }

        container.innerHTML = `
            <div class="player-count">👥 ${players.length} Player${players.length !== 1 ? 's' : ''} Joined</div>
            ${players.map(player => `
                <div class="player-card">
                    <div class="player-name">${player.name}</div>
                    <div class="player-status ${player.status || 'waiting'}">
                        ${player.status === 'playing' ? '🎮 Playing' : '⏳ Waiting'}
                    </div>
                    <div class="player-score">Score: ${player.score || 0}</div>
                </div>
            `).join('')}
        `;
    }

    async startGame() {
        if (!this.currentGame || this.questions.length === 0) {
            alert('Please create a game and add questions first');
            return;
        }

        if (Object.keys(this.players).length === 0) {
            alert('No players have joined yet');
            return;
        }

        this.gameState = 'playing';
        this.currentQuestionIndex = -1;
        this.questionResults = [];

        // Update game state
        await window.sharedStorage.updateData(`games/${this.currentGame.pin}`, {
            state: 'playing',
            startTime: Date.now()
        });

        document.getElementById('start-btn').classList.add('hidden');
        document.getElementById('next-btn').classList.remove('hidden');
        document.getElementById('end-btn').classList.remove('hidden');

        this.nextQuestion();
    }

    async nextQuestion() {
        this.currentQuestionIndex++;
        
        if (this.currentQuestionIndex >= this.questions.length) {
            this.endGame();
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        this.timeLeft = question.timeLimit;

        // Clear previous answers
        await window.sharedStorage.updateData(`games/${this.currentGame.pin}/currentQuestion/answers`, {});

        // Set current question
        await window.sharedStorage.updateData(`games/${this.currentGame.pin}`, {
            currentQuestion: {
                index: this.currentQuestionIndex,
                question: question,
                startTime: Date.now(),
                timeLimit: question.timeLimit,
                answers: {}
            }
        });

        // Update UI
        this.displayCurrentQuestion(question);
        this.startQuestionTimer();

        console.log(`🎯 Question ${this.currentQuestionIndex + 1} started`);
    }

    displayCurrentQuestion(question) {
        document.getElementById('current-question-display').classList.remove('hidden');
        document.getElementById('current-question-text').textContent = question.text;
        document.getElementById('question-timer').textContent = this.timeLeft;

        const optionsContainer = document.getElementById('current-options');
        optionsContainer.innerHTML = question.options.map((option, index) => `
            <div class="option">
                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${option}</span>
            </div>
        `).join('');
    }

    startQuestionTimer() {
        if (this.timer) clearInterval(this.timer);
        
        this.timer = setInterval(() => {
            this.timeLeft--;
            document.getElementById('question-timer').textContent = this.timeLeft;
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.endQuestion();
            }
        }, 1000);
    }

    async endQuestion() {
        clearInterval(this.timer);
        
        // Calculate scores for this question
        await this.calculateQuestionScores();
        
        // Show results
        this.displayQuestionResults();
        
        console.log(`⏰ Question ${this.currentQuestionIndex + 1} ended`);
    }

    async calculateQuestionScores() {
        const question = this.questions[this.currentQuestionIndex];
        const answersRef = `games/${this.currentGame.pin}/currentQuestion/answers`;
        const answers = await window.sharedStorage.readData(answersRef) || {};

        // Store question result
        const questionResult = {
            questionIndex: this.currentQuestionIndex,
            questionText: question.text,
            correctAnswer: question.correctAnswer,
            correctAnswerText: question.options[question.correctAnswer - 1],
            playerResults: []
        };

        Object.keys(answers).forEach(playerId => {
            const answer = answers[playerId];
            const player = this.players[playerId];
            
            if (player) {
                let points = 0;
                let timeBonus = 0;
                
                if (answer.answer === question.correctAnswer) {
                    // Calculate score based on time
                    timeBonus = Math.max(0, Math.floor((answer.timeLeft / question.timeLimit) * 1000));
                    points = 1000 + timeBonus;
                    
                    player.score = (player.score || 0) + points;
                }
                
                player.lastAnswer = {
                    correct: answer.answer === question.correctAnswer,
                    points: points,
                    timeBonus: timeBonus,
                    questionIndex: this.currentQuestionIndex,
                    answerGiven: answer.answer
                };

                // Add to question results
                questionResult.playerResults.push({
                    playerId: playerId,
                    playerName: player.name,
                    answer: answer.answer,
                    correct: answer.answer === question.correctAnswer,
                    points: points,
                    timeBonus: timeBonus,
                    timeLeft: answer.timeLeft
                });
            }
        });

        // Sort player results by points (highest first)
        questionResult.playerResults.sort((a, b) => b.points - a.points);
        
        // Add question result to history
        this.questionResults.push(questionResult);

        // Update player scores in Firebase
        await window.sharedStorage.updateData(`games/${this.currentGame.pin}/players`, this.players);
    }

    displayQuestionResults() {
        const question = this.questions[this.currentQuestionIndex];
        const resultsContainer = document.getElementById('question-results');
        
        const currentQuestionResult = this.questionResults[this.questionResults.length - 1];
        const correctPlayers = currentQuestionResult.playerResults.filter(p => p.correct);
        
        resultsContainer.innerHTML = `
            <div class="question-result">
                <h4>📊 Question ${this.currentQuestionIndex + 1} Results</h4>
                <p><strong>Question:</strong> ${question.text}</p>
                <p><strong>Correct Answer:</strong> ${String.fromCharCode(64 + question.correctAnswer)}. ${question.options[question.correctAnswer - 1]}</p>
                <p><strong>Players Correct:</strong> ${correctPlayers.length} / ${Object.keys(this.players).length}</p>
                
                <h5>🏆 Question ${this.currentQuestionIndex + 1} Leaderboard:</h5>
                <div class="leaderboard">
                    ${currentQuestionResult.playerResults.map((player, index) => {
                        let medal = '';
                        if (index === 0 && player.points > 0) medal = '🥇';
                        else if (index === 1 && player.points > 0) medal = '🥈';
                        else if (index === 2 && player.points > 0) medal = '🥉';
                        
                        return `
                            <div class="leaderboard-item ${index < 3 && player.points > 0 ? 'top-three' : ''}">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span class="position">${medal} ${index + 1}</span>
                                    <span>${player.playerName}</span>
                                </div>
                                <div>
                                    ${player.points > 0 ? 
                                        `<span style="color: var(--success)">+${player.points}</span>` : 
                                        `<span style="color: var(--danger)">0</span>`
                                    }
                                    ${player.timeBonus > 0 ? `<small style="color: var(--warning)">(+${player.timeBonus} time bonus)</small>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <h5>📈 Overall Leaderboard After Question ${this.currentQuestionIndex + 1}:</h5>
                ${this.displayOverallLeaderboard()}
            </div>
        `;
        
        this.updateLeaderboard();
    }

    displayOverallLeaderboard() {
        const players = Object.values(this.players).sort((a, b) => (b.score || 0) - (a.score || 0));
        
        if (players.length === 0) {
            return '<p class="no-data">No players yet</p>';
        }

        return players.map((player, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            
            return `
                <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="position">${medal} ${index + 1}</span>
                        <span>${player.name}</span>
                    </div>
                    <div style="font-weight: bold;">${player.score || 0} pts</div>
                </div>
            `;
        }).join('');
    }

    updateLeaderboard() {
        const leaderboardContainer = document.getElementById('live-leaderboard');
        const players = Object.values(this.players).sort((a, b) => (b.score || 0) - (a.score || 0));
        
        if (players.length === 0) {
            leaderboardContainer.innerHTML = '<p class="no-data">No players yet</p>';
            return;
        }

        leaderboardContainer.innerHTML = `
            <h4>🏆 Current Overall Leaderboard</h4>
            ${players.map((player, index) => {
                let medal = '';
                if (index === 0) medal = '🥇';
                else if (index === 1) medal = '🥈';
                else if (index === 2) medal = '🥉';
                
                return `
                    <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="position">${medal} ${index + 1}</span>
                            <span>${player.name}</span>
                        </div>
                        <div style="font-weight: bold;">${player.score || 0} pts</div>
                    </div>
                `;
            }).join('')}
            
            ${this.questionResults.length > 0 ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #333;">
                    <h5>📋 Question Results History:</h5>
                    ${this.questionResults.map((result, qIndex) => `
                        <details style="margin: 10px 0;">
                            <summary>Question ${qIndex + 1}: ${result.correctPlayers || 0} correct</summary>
                            <div style="padding: 10px; background: #2a2a2a; border-radius: 5px; margin-top: 5px;">
                                <strong>Correct:</strong> ${String.fromCharCode(64 + result.correctAnswer)}. ${result.correctAnswerText}<br>
                                <strong>Top Scorer:</strong> ${result.playerResults[0]?.playerName || 'None'} (+${result.playerResults[0]?.points || 0} pts)
                            </div>
                        </details>
                    `).join('')}
                </div>
            ` : ''}
        `;
    }

    async endGame() {
        clearInterval(this.timer);
        this.gameState = 'finished';
        
        await window.sharedStorage.updateData(`games/${this.currentGame.pin}`, {
            state: 'finished',
            endTime: Date.now(),
            finalResults: {
                players: this.players,
                questionResults: this.questionResults,
                finalLeaderboard: Object.values(this.players).sort((a, b) => (b.score || 0) - (a.score || 0))
            }
        });

        document.getElementById('next-btn').classList.add('hidden');
        document.getElementById('end-btn').classList.add('hidden');
        
        this.showFinalResults();
        
        alert('🏆 Game Ended! Final results are available.');
        console.log('🏁 Game ended');
    }

    showFinalResults() {
        const players = Object.values(this.players).sort((a, b) => (b.score || 0) - (a.score || 0));
        const resultsContainer = document.getElementById('live-leaderboard');
        
        resultsContainer.innerHTML = `
            <h3>🏆 FINAL RESULTS</h3>
            <div class="final-results">
                ${players.map((player, index) => {
                    let medal = '';
                    if (index === 0) medal = '🥇';
                    else if (index === 1) medal = '🥈';
                    else if (index === 2) medal = '🥉';
                    
                    return `
                        <div class="leaderboard-item ${index < 3 ? 'top-three' : ''}" style="margin: 10px 0; padding: 20px;">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span class="position" style="font-size: 1.5em;">${medal} ${index + 1}</span>
                                <div>
                                    <div style="font-size: 1.2em; font-weight: bold;">${player.name}</div>
                                    <div style="color: var(--text-secondary);">Final Score: ${player.score || 0} points</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div style="margin-top: 30px;">
                <h4>📊 Game Summary</h4>
                <p><strong>Total Questions:</strong> ${this.questions.length}</p>
                <p><strong>Total Players:</strong> ${players.length}</p>
                <p><strong>Game Duration:</strong> ${Math.round((Date.now() - this.currentGame.startTime) / 1000 / 60)} minutes</p>
            </div>
            
            <div style="margin-top: 20px;">
                <h4>📈 Question-by-Question Results</h4>
                ${this.questionResults.map((result, qIndex) => `
                    <details style="margin: 10px 0; background: #2a2a2a; padding: 15px; border-radius: 8px;">
                        <summary style="font-weight: bold; cursor: pointer;">
                            Question ${qIndex + 1}: ${result.questionText}
                        </summary>
                        <div style="margin-top: 10px;">
                            <p><strong>Correct Answer:</strong> ${String.fromCharCode(64 + result.correctAnswer)}. ${result.correctAnswerText}</p>
                            <p><strong>Players Correct:</strong> ${result.playerResults.filter(p => p.correct).length} / ${Object.keys(this.players).length}</p>
                            <div class="leaderboard" style="margin-top: 10px;">
                                ${result.playerResults.slice(0, 3).map((player, pIndex) => `
                                    <div class="leaderboard-item ${pIndex < 3 ? 'top-three' : ''}" style="padding: 10px;">
                                        <div>${pIndex + 1}. ${player.playerName}</div>
                                        <div>+${player.points} pts</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </details>
                `).join('')}
            </div>
        `;
    }

    async loadExistingGame() {
        try {
            // Try to load any existing game
            const games = await window.sharedStorage.readData('games');
            if (games) {
                const gamePins = Object.keys(games);
                if (gamePins.length > 0) {
                    const latestGamePin = gamePins[0]; // Simple approach - take first game
                    this.currentGame = games[latestGamePin];
                    this.questions = this.currentGame.questions || [];
                    this.players = this.currentGame.players || {};
                    
                    document.getElementById('current-game-pin').textContent = latestGamePin;
                    document.getElementById('share-pin-input').value = latestGamePin;
                    document.getElementById('game-info').innerHTML = `
                        <p><strong>Game:</strong> ${this.currentGame.name}</p>
                        <p><strong>Status:</strong> <span class="status-${this.currentGame.state}">${this.currentGame.state}</span></p>
                    `;
                    
                    this.updateQuestionsDisplay();
                    this.updatePlayersDisplay();
                    this.updateLeaderboard();
                    
                    console.log('✅ Loaded existing game:', latestGamePin);
                }
            }
        } catch (error) {
            console.error('❌ Error loading existing game:', error);
        }
    }

    updateAnswerStats(answers) {
        // Update real-time answer statistics
        const question = this.questions[this.currentQuestionIndex];
        if (!question) return;

        const answerCounts = {1: 0, 2: 0, 3: 0, 4: 0};
        Object.values(answers).forEach(answer => {
            if (answer.answer >= 1 && answer.answer <= 4) {
                answerCounts[answer.answer]++;
            }
        });

        console.log('📊 Answer stats:', answerCounts);
    }
}

// Tab switching function
function switchTab(tabName, event) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
}

// Global admin instance
let admin;

// Initialize when DOM is loaded
function initAdmin() {
    admin = new GameAdmin();
    console.log('✅ Admin system initialized');
    
    // Make functions globally available
    window.createNewGame = () => admin.createNewGame();
    window.addQuestion = () => admin.addQuestion();
    window.startGame = () => admin.startGame();
    window.nextQuestion = () => admin.nextQuestion();
    window.endGame = () => admin.endGame();
    window.switchTab = switchTab;
}

// Auto-initialize with delay to ensure everything is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM loaded, starting admin in 3 seconds...');
    setTimeout(initAdmin, 3000);
});