// player.js - DEBUGGING VERSION
class GamePlayer {
    constructor() {
        this.playerId = null;
        this.playerName = null;
        this.gamePin = null;
        this.currentGame = null;
        this.score = 0;
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.gameState = 'joining';
        this.currentTimer = null;
        this.answerSubmitted = false;
        
        this.init();
    }

    async init() {
        console.log('🎯 Initializing Player...');
        
        // Wait for Firebase to be ready
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
            return;
        }
        
        try {
            await window.sharedStorage.waitForInitialization();
            console.log('✅ Firebase ready, setting up player...');
        } catch (error) {
            console.error('❌ Error waiting for Firebase:', error);
        }
        
        this.setupEventListeners();
        this.checkUrlParams();
        console.log('✅ Player system fully initialized');
    }

    setupEventListeners() {
        // Enter key to join game
        document.getElementById('player-name')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
        document.getElementById('game-pin')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinGame();
        });
    }

    checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const pin = urlParams.get('pin');
        const name = urlParams.get('name');
        
        if (pin) {
            document.getElementById('game-pin').value = pin;
        }
        if (name) {
            document.getElementById('player-name').value = name;
        }
        
        if (pin && name) {
            setTimeout(() => this.joinGame(), 1000);
        }
    }

    async joinGame() {
        this.gamePin = document.getElementById('game-pin').value.trim();
        this.playerName = document.getElementById('player-name').value.trim();

        if (!this.gamePin || this.gamePin.length !== 6) {
            alert('Please enter a valid 6-digit game PIN');
            return;
        }

        if (!this.playerName) {
            alert('Please enter your name');
            return;
        }

        this.playerId = window.sharedStorage.generatePlayerId();

        try {
            // Check if game exists
            this.currentGame = await window.sharedStorage.readData(`games/${this.gamePin}`);
            
            if (!this.currentGame) {
                alert('Game not found. Please check the PIN.');
                return;
            }

            if (this.currentGame.state === 'finished') {
                alert('This game has already ended.');
                return;
            }

            // Check if player name already exists
            const existingPlayers = Object.values(this.currentGame.players || {});
            const nameExists = existingPlayers.some(player => 
                player.name.toLowerCase() === this.playerName.toLowerCase()
            );
            
            if (nameExists) {
                alert('This name is already taken in this game. Please choose a different name.');
                return;
            }

            // Register player
            const playerData = {
                id: this.playerId,
                name: this.playerName,
                joined: Date.now(),
                score: 0,
                status: 'waiting',
                lastActive: Date.now()
            };

            await window.sharedStorage.updateData(`games/${this.gamePin}/players/${this.playerId}`, playerData);

            // Switch to waiting screen
            this.showScreen('waiting-screen');
            document.getElementById('player-display-name').textContent = this.playerName;
            document.getElementById('display-game-pin').textContent = this.gamePin;

            // DEBUG: Check Firebase data
            await this.debugFirebaseConnection();

            // Start listening for game updates
            this.startGameListening();

            console.log(`🎯 Player ${this.playerName} joined game ${this.gamePin}`);

        } catch (error) {
            console.error('❌ Failed to join game:', error);
            alert('Failed to join game. Please check your connection and try again.');
        }
    }

    async debugFirebaseConnection() {
        console.log('🐛 DEBUG: Checking Firebase connection...');
        
        try {
            const gameData = await window.sharedStorage.readData(`games/${this.gamePin}`);
            console.log('🐛 Game data:', gameData);
            
            const currentQuestion = await window.sharedStorage.readData(`games/${this.gamePin}/currentQuestion`);
            console.log('🐛 Current question:', currentQuestion);
            
            const players = await window.sharedStorage.readData(`games/${this.gamePin}/players`);
            console.log('🐛 Players:', players);
            
            return {
                gameExists: !!gameData,
                hasCurrentQuestion: !!currentQuestion,
                playerCount: players ? Object.keys(players).length : 0
            };
        } catch (error) {
            console.error('🐛 Debug error:', error);
            return { error: error.message };
        }
    }

    startGameListening() {
        console.log('👂 Starting game state monitoring...');
        
        // Listen for game state changes
        window.sharedStorage.listenToData(`games/${this.gamePin}`, (game) => {
            console.log('🔄 Full game update received:', game);
            
            if (!game) {
                console.log('❌ Game not found, might have been deleted');
                this.showScreen('join-screen');
                alert('Game not found. It might have been deleted by the host.');
                return;
            }
            
            this.currentGame = game;
            this.updateGameState(game.state);
            this.updatePlayersList(game.players);
            this.updateLeaderboard();
            
            // Check for current question in game data
            if (game.state === 'playing' && game.currentQuestion) {
                console.log('📥 Current question found in main game data');
                this.showQuestion(game.currentQuestion);
            }
        });

        // Listen specifically for current question changes
        window.sharedStorage.listenToData(`games/${this.gamePin}/currentQuestion`, (questionData) => {
            console.log('❓ Direct current question update:', questionData);
            
            if (questionData && this.gameState === 'playing') {
                console.log('🎯 New question via direct listener');
                this.showQuestion(questionData);
            } else if (!questionData) {
                console.log('📭 Current question cleared');
                this.clearQuestionDisplay();
            }
        });
    }

    updateGameState(state) {
        console.log('🎮 Game state changing to:', state);
        this.gameState = state;
        
        switch (state) {
            case 'waiting':
                this.showScreen('waiting-screen');
                break;
            case 'playing':
                this.showScreen('game-screen');
                this.showScreen('live-leaderboard-panel');
                this.selectedAnswer = null;
                this.answerSubmitted = false;
                if (this.currentTimer) clearInterval(this.currentTimer);
                
                // Immediately check for current question
                if (this.currentGame?.currentQuestion) {
                    console.log('🚨 Immediate question check:', this.currentGame.currentQuestion);
                    this.showQuestion(this.currentGame.currentQuestion);
                }
                break;
            case 'finished':
                this.showScreen('results-screen');
                this.showFinalResults();
                break;
        }
    }

    updatePlayersList(players) {
        const container = document.getElementById('lobby-players');
        if (!container) return;
        
        const playerList = Object.values(players || {});
        
        if (playerList.length === 0) {
            container.innerHTML = '<p class="no-data">No players yet</p>';
            return;
        }

        container.innerHTML = `
            <div class="player-count">👥 ${playerList.length} Player${playerList.length !== 1 ? 's' : ''} Joined</div>
            ${playerList.map(player => `
                <div class="player-card ${player.id === this.playerId ? 'you' : ''}">
                    <div class="player-name">${player.name} ${player.id === this.playerId ? '(You)' : ''}</div>
                    <div class="player-status">${player.status || 'waiting'}</div>
                </div>
            `).join('')}
        `;
    }

    showQuestion(questionData) {
        console.log('🎯 RAW QUESTION DATA:', questionData);
        
        if (!questionData) {
            console.log('❌ No question data');
            return;
        }
        
        // Extract question from different possible structures
        const question = questionData.question || questionData;
        
        if (!question || !question.text) {
            console.log('❌ Invalid question structure:', question);
            return;
        }
        
        console.log('🎯 Displaying question:', question.text);
        
        this.currentQuestion = question;
        this.selectedAnswer = null;
        this.answerSubmitted = false;
        
        // Update UI
        const questionNumber = (questionData.index + 1) || 1;
        document.getElementById('q-number').textContent = questionNumber;
        document.getElementById('game-question-text').textContent = question.text;
        
        const optionsContainer = document.getElementById('game-options');
        const options = question.options || [];
        
        if (options.length === 0) {
            optionsContainer.innerHTML = '<p class="no-data">No options available</p>';
            return;
        }
        
        optionsContainer.innerHTML = options.map((option, index) => `
            <div class="option" onclick="player.selectAnswer(${index + 1})" data-option="${index + 1}">
                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${option}</span>
            </div>
        `).join('');
        
        const timeLimit = questionData.timeLimit || question.timeLimit || 20;
        this.startQuestionTimer(timeLimit);
        
        // Clear feedback
        const feedbackElement = document.getElementById('answer-feedback');
        if (feedbackElement) {
            feedbackElement.classList.add('hidden');
            feedbackElement.innerHTML = '';
        }
        
        // Enable options
        document.querySelectorAll('.option').forEach(option => {
            option.style.pointerEvents = 'auto';
            option.classList.remove('selected', 'correct', 'incorrect');
        });
        
        console.log('✅ Question displayed successfully');
    }

    clearQuestionDisplay() {
        document.getElementById('game-question-text').textContent = 'Waiting for next question...';
        document.getElementById('game-options').innerHTML = '';
        document.getElementById('answer-feedback').classList.add('hidden');
        document.getElementById('game-timer').textContent = '--';
    }

    startQuestionTimer(timeLimit) {
        let timeLeft = timeLimit;
        document.getElementById('game-timer').textContent = timeLeft;
        
        if (this.currentTimer) clearInterval(this.currentTimer);
        
        this.currentTimer = setInterval(() => {
            timeLeft--;
            document.getElementById('game-timer').textContent = timeLeft;
            
            if (timeLeft <= 0) {
                clearInterval(this.currentTimer);
                if (!this.answerSubmitted) {
                    this.submitAnswer();
                }
            }
        }, 1000);
    }

    selectAnswer(answerIndex) {
        if (this.answerSubmitted) return;
        
        this.selectedAnswer = answerIndex;
        
        document.querySelectorAll('.option').forEach(option => {
            option.classList.remove('selected');
        });
        
        document.querySelector(`.option[data-option="${answerIndex}"]`).classList.add('selected');
        
        setTimeout(() => this.submitAnswer(), 500);
    }

    async submitAnswer() {
        if (this.answerSubmitted) return;

        if (this.selectedAnswer === null) {
            this.selectedAnswer = 0;
        }

        if (this.currentTimer) clearInterval(this.currentTimer);

        this.answerSubmitted = true;
        const timeLeft = parseInt(document.getElementById('game-timer').textContent);
        
        const answerData = {
            playerId: this.playerId,
            playerName: this.playerName,
            answer: this.selectedAnswer,
            timeLeft: timeLeft,
            submitted: Date.now()
        };

        try {
            await window.sharedStorage.updateData(`games/${this.gamePin}/currentQuestion/answers/${this.playerId}`, answerData);
            this.showAnswerFeedback();
            
            document.querySelectorAll('.option').forEach(option => {
                option.style.pointerEvents = 'none';
            });
            
        } catch (error) {
            console.error('❌ Failed to submit answer:', error);
        }
    }

    showAnswerFeedback() {
        const feedbackContainer = document.getElementById('answer-feedback');
        const isCorrect = this.selectedAnswer === this.currentQuestion.correctAnswer;
        
        feedbackContainer.innerHTML = `
            <div class="${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                <h3>${isCorrect ? '✅ Correct!' : '❌ Incorrect'}</h3>
                <p>${isCorrect ? 
                    'Great job! Points will be awarded based on your speed.' : 
                    `Correct answer was: ${String.fromCharCode(64 + this.currentQuestion.correctAnswer)}. ${this.currentQuestion.options[this.currentQuestion.correctAnswer - 1]}`
                }</p>
            </div>
        `;
        
        feedbackContainer.classList.remove('hidden');
        
        // Show correct/incorrect colors
        document.querySelectorAll('.option').forEach(option => {
            const optionNum = parseInt(option.getAttribute('data-option'));
            option.classList.remove('correct', 'incorrect');
            
            if (optionNum === this.currentQuestion.correctAnswer) {
                option.classList.add('correct');
            } else if (optionNum === this.selectedAnswer && !isCorrect) {
                option.classList.add('incorrect');
            }
        });
    }

    updateLeaderboard() {
        this.updateMiniLeaderboard();
    }

    updateMiniLeaderboard() {
        const leaderboardContainer = document.getElementById('mini-leaderboard');
        if (!leaderboardContainer) return;
        
        const players = Object.values(this.currentGame?.players || {});
        const sortedPlayers = players.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5);
        
        if (sortedPlayers.length === 0) {
            leaderboardContainer.innerHTML = '<p class="no-data">No players yet</p>';
            return;
        }

        leaderboardContainer.innerHTML = sortedPlayers.map((player, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            
            return `
                <div class="leaderboard-item ${player.id === this.playerId ? 'you' : ''}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="position">${medal} ${index + 1}</span>
                        <span>${player.name} ${player.id === this.playerId ? '(You)' : ''}</span>
                    </div>
                    <div style="font-weight: bold;">${player.score || 0}</div>
                </div>
            `;
        }).join('');
    }

    showFinalResults() {
        const players = Object.values(this.currentGame?.players || {});
        const sortedPlayers = players.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        const currentPlayer = players.find(p => p.id === this.playerId);
        if (currentPlayer) {
            document.getElementById('final-score').textContent = currentPlayer.score || 0;
            this.score = currentPlayer.score || 0;
        }
        
        const leaderboardContainer = document.getElementById('final-leaderboard');
        leaderboardContainer.innerHTML = `
            <h3>🏆 FINAL STANDINGS</h3>
            <div class="final-leaderboard">
                ${sortedPlayers.map((player, index) => {
                    let medal = '';
                    if (index === 0) medal = '🥇';
                    else if (index === 1) medal = '🥈';
                    else if (index === 2) medal = '🥉';
                    
                    return `
                        <div class="leaderboard-item ${player.id === this.playerId ? 'you' : ''} ${index < 3 ? 'top-three' : ''}">
                            <div style="display: flex; align-items: center; gap: 15px;">
                                <span class="position" style="font-size: 1.3em;">${medal} ${index + 1}</span>
                                <div>
                                    <div style="font-weight: bold; font-size: 1.1em;">${player.name} ${player.id === this.playerId ? '(You)' : ''}</div>
                                    <div style="color: var(--text-secondary);">${player.score || 0} points</div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        if (currentPlayer) {
            const position = sortedPlayers.findIndex(p => p.id === this.playerId) + 1;
            this.showAchievementMessage(position, sortedPlayers.length);
        }
    }

    showAchievementMessage(position, totalPlayers) {
        let message = '';
        
        if (position === 1) message = '🏆 CHAMPION! YOU WON THE GAME!';
        else if (position === 2) message = '🥈 SILVER MEDAL! AMAZING!';
        else if (position === 3) message = '🥉 BRONZE MEDAL! EXCELLENT!';
        else if (position <= Math.ceil(totalPlayers / 4)) message = '🎯 TOP QUARTER FINISH!';
        else if (position <= Math.ceil(totalPlayers / 2)) message = '⭐ TOP HALF FINISH!';
        else message = '👍 GOOD EFFORT!';
        
        const resultsContainer = document.getElementById('results-screen');
        const achievementElement = document.createElement('div');
        achievementElement.className = 'achievement-message';
        achievementElement.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 1.5em; font-weight: bold; margin-bottom: 10px;">${message}</div>
                <div style="font-size: 1.2em;">
                    Position <strong>#${position}</strong> out of <strong>${totalPlayers}</strong> players
                </div>
            </div>
        `;
        
        const playerFinalScore = resultsContainer.querySelector('.player-final-score');
        if (playerFinalScore) {
            const existingAchievement = playerFinalScore.querySelector('.achievement-message');
            if (existingAchievement) existingAchievement.remove();
            playerFinalScore.appendChild(achievementElement);
        }
    }

    showScreen(screenId) {
        const screens = ['join-screen', 'waiting-screen', 'game-screen', 'results-screen', 'live-leaderboard-panel'];
        screens.forEach(screen => {
            const element = document.getElementById(screen);
            if (element) element.classList.add('hidden');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) targetScreen.classList.remove('hidden');
        
        if (screenId === 'game-screen' || screenId === 'results-screen') {
            const leaderboardPanel = document.getElementById('live-leaderboard-panel');
            if (leaderboardPanel) leaderboardPanel.classList.remove('hidden');
        }
    }

    async leaveGame() {
        if (this.playerId && this.gamePin) {
            try {
                await window.sharedStorage.deleteData(`games/${this.gamePin}/players/${this.playerId}`);
            } catch (error) {
                console.error('Error leaving game:', error);
            }
        }
        
        this.reset();
        this.showScreen('join-screen');
    }

    playAgain() {
        this.reset();
        this.showScreen('join-screen');
        if (this.gamePin) {
            document.getElementById('game-pin').value = this.gamePin;
        }
    }

    reset() {
        this.playerId = null;
        this.playerName = null;
        this.gamePin = null;
        this.currentGame = null;
        this.score = 0;
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.gameState = 'joining';
        this.answerSubmitted = false;
        
        if (this.currentTimer) {
            clearInterval(this.currentTimer);
            this.currentTimer = null;
        }
    }
}

let player;

function initPlayer() {
    player = new GamePlayer();
    window.joinGame = () => player.joinGame();
    window.leaveGame = () => player.leaveGame();
    window.playAgain = () => player.playAgain();
}

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initPlayer, 3000);
});