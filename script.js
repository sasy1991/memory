document.addEventListener('DOMContentLoaded', () => {
    const gameBoard = document.querySelector('.memory-game');
    const gameContainer = document.querySelector('.game-container');
    const gameHeader = document.querySelector('header');
    const movesCountSpan = document.getElementById('moves-count');
    const restartButton = document.getElementById('restart-button');
    const playAgainButton = document.getElementById('play-again-button');
    const timerSpan = document.getElementById('timer');
    const winTimeElement = document.getElementById('win-time');
    const bestTimeElement = document.getElementById('best-time');
    const shareButton = document.getElementById('share-button');
    const winModal = document.getElementById('win-modal');
    const winStarsElement = document.getElementById('win-stars');
    const pauseModal = document.getElementById('pause-modal');
    const categorySelection = document.getElementById('category-selection');
    const playerLevelSpan = document.getElementById('player-level');
    const xpBar = document.getElementById('xp-bar');
    const xpText = document.getElementById('xp-text');
    const howToPlayButton = document.getElementById('how-to-play-button');
    const tutorialModal = document.getElementById('tutorial-modal');
    const closeTutorialButton = document.getElementById('close-tutorial-button');
    const dailyChallengeButton = document.getElementById('daily-challenge-button');
    const achievementsButton = document.getElementById('achievements-button');
    const achievementsModal = document.getElementById('achievements-modal');
    const closeAchievementsButton = document.getElementById('close-achievements-button');
    const achievementsList = document.getElementById('achievements-list');
    const toastContainer = document.getElementById('toast-container');
    const categoryLoader = document.getElementById('category-loader');
    const categoryContainer = document.querySelector('.category-container');
    const categoryDropdown = document.getElementById('category-dropdown');
    const startGameButton = document.getElementById('start-game-button');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const pauseButton = document.getElementById('pause-button');
    const resumeButton = document.getElementById('resume-button');
    const hintButton = document.getElementById('hint-button');

    // Sound Effects
    const flipSound = document.getElementById('flip-sound');
    const matchSound = document.getElementById('match-sound');
    const winSound = document.getElementById('win-sound');

    let hasFlippedCard = false;
    let lockBoard = false;
    let firstCard, secondCard;
    let moves = 0;
    let matchedPairs = 0;
    let totalPairs = 0;
    let currentImageUrls = [];
    let currentCategoryId = null;
    let currentCategoryName = '';
    let categoryMap = new Map();
    let timerInterval = null;
    let gameStartTime = 0;
    let hintsRemaining = 0;
    let isPaused = false;
    let timeElapsedBeforePause = 0;
    let currentDifficulty = 'easy';
    let playerLevel = 1;
    let playerXP = 0;
    let xpToNextLevel = 100;
    const XP_PER_MATCH = 10;
    const XP_WIN_BONUS = { 1: 50, 2: 100, 3: 150 };
    let shareableScoreText = '';
    let isDailyChallengeMode = false;
    // Thresholds are the maximum number of moves to get the star rating
    const difficultySettings = {
        easy: { pairs: 8, hints: 3, starThresholds: { three: 10, two: 14 } }, // perfect +2, perfect +6
        medium: { pairs: 10, hints: 4, starThresholds: { three: 14, two: 19 } }, // perfect +4, perfect +9
        hard: { pairs: 18, hints: 5, starThresholds: { three: 23, two: 30 } } // perfect +5, perfect +12
    };
    const SPECIAL_CARDS = {
        PEEK: { id: 'PEEK_CARD', icon: '👁️', text: 'Peek' },
        HINT: { id: 'HINT_CARD', icon: '💡', text: 'Extra Hint' }
    };

    let topLevelCategories = [];
    const ACHIEVEMENTS = {
        FIRST_WIN: { id: 'FIRST_WIN', title: 'First Victory', description: 'Win your first game.' },
        SPEEDSTER: { id: 'SPEEDSTER', title: 'Speedster', description: 'Finish a game in under 45 seconds.' },
        PERFECT_GAME: { id: 'PERFECT_GAME', title: 'Perfect Game', description: 'Get a 3-star rating on any level.' },
        CATEGORY_EXPLORER: { id: 'CATEGORY_EXPLORER', title: 'Category Explorer', description: 'Play 5 different categories.' },
        HINT_SAVER: { id: 'HINT_SAVER', title: 'Hint Saver', description: 'Win a medium or hard game without using any hints.' }
    };
    let unlockedAchievements = new Set();

    // --- API FETCHING ---
    async function fetchCategories() {
        let allCategories = [];
        let page = 1;
        const baseUrl = 'https://coloringjungle.com/wp-json/wp/v2/coloring-page-category?per_page=100&_fields=id,name,parent';

        while (true) {
            try {
                const response = await fetch(`${baseUrl}&page=${page}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const categories = await response.json();

                if (categories.length === 0) break; // Exit loop if no more categories

                allCategories = allCategories.concat(categories);
                if (categories.length < 100) break; // Exit if it's the last page

                page++;
            } catch (error) {
                console.error("Failed to fetch categories:", error);
                // Error is now handled by the caller
                return []; // Return empty array on error
            }
        }
        return allCategories;
    }

    async function fetchImages(categoryId, count = 8) {
        const url = `https://coloringjungle.com/wp-json/wp/v2/coloring-pages?coloring-page-category=${categoryId}&_fields=yoast_head_json.og_image&per_page=${count}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const imagesData = await response.json();

            const imageUrls = imagesData
                .map(item => item?.yoast_head_json?.og_image?.[0]?.url)
                .filter(Boolean); // Filter out any null/undefined URLs

            return imageUrls;
        } catch (error) {
            console.error(`Failed to fetch images for category ${categoryId}:`, error);
            // Return an empty array to signify failure or no images.
            return [];
        }
    }

    // --- LOCAL STORAGE HELPERS ---
    function getBestTime(categoryId, difficulty) {
        const bestTime = localStorage.getItem(`bestTime_${categoryId}_${difficulty}`);
        return bestTime ? parseInt(bestTime, 10) : null;
    }

    function saveBestTime(categoryId, difficulty, newTimeInSeconds) {
        const existingBestTime = getBestTime(categoryId, difficulty);
        if (!existingBestTime || newTimeInSeconds < existingBestTime) {
            localStorage.setItem(`bestTime_${categoryId}_${difficulty}`, newTimeInSeconds);
            return true; // Indicates a new record
        }
        return false; // Not a new record
    }

    function getStarRating(categoryId, difficulty) {
        const rating = localStorage.getItem(`starRating_${categoryId}_${difficulty}`);
        return rating ? parseInt(rating, 10) : 0; // Return 0 if no rating
    }

    function saveStarRating(categoryId, difficulty, newRating) {
        const existingRating = getStarRating(categoryId, difficulty);
        if (newRating > existingRating) {
            localStorage.setItem(`starRating_${categoryId}_${difficulty}`, newRating);
            return true; // New record
        }
        return false;
    }

    // --- PLAYER STATS & XP ---
    function calculateXPForLevel(level) {
        // Simple scaling: 100 XP for level 1, 120 for 2, 140 for 3, etc.
        return 100 + (level - 1) * 20;
    }

    function loadPlayerStats() {
        playerLevel = parseInt(localStorage.getItem('playerLevel') || '1', 10);
        playerXP = parseInt(localStorage.getItem('playerXP') || '0', 10);
        xpToNextLevel = calculateXPForLevel(playerLevel);
    }

    function savePlayerStats() {
        localStorage.setItem('playerLevel', playerLevel);
        localStorage.setItem('playerXP', playerXP);
    }

    function addXP(amount) {
        playerXP += amount;
        while (playerXP >= xpToNextLevel) {
            playerXP -= xpToNextLevel;
            playerLevel++;
            xpToNextLevel = calculateXPForLevel(playerLevel);
            showToast(`🎉 Level Up! You are now Level ${playerLevel}!`);
        }
        updatePlayerStatsUI();
        savePlayerStats();
    }

    function updatePlayerStatsUI() {
        if (!playerLevelSpan || !xpBar || !xpText) return;

        playerLevelSpan.textContent = playerLevel;
        xpText.textContent = `${playerXP} / ${xpToNextLevel} XP`;

        const xpPercentage = (playerXP / xpToNextLevel) * 100;
        xpBar.style.width = `${xpPercentage}%`;
    }


    // --- DAILY CHALLENGE HELPERS ---
    function getTodaysDateString() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function generateDailyChallenge() {
        const dateString = getTodaysDateString();
        // Create a simple seed from the date string
        let seed = 0;
        for (let i = 0; i < dateString.length; i++) {
            seed += dateString.charCodeAt(i);
        }

        // Use a simple pseudo-random number generator based on the seed
        const pseudoRandom = () => {
            let x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };

        // Get all playable categories (children and parents with children)
        const allPlayableCategories = [];
        topLevelCategories.forEach(parent => {
            if (parent.children.length > 0) {
                allPlayableCategories.push(parent);
                allPlayableCategories.push(...parent.children);
            }
        });

        // Pick a random category and difficulty
        const categoryIndex = Math.floor(pseudoRandom() * allPlayableCategories.length);
        const categoryId = allPlayableCategories[categoryIndex].id;

        const difficulties = ['easy', 'medium', 'hard'];
        const difficultyIndex = Math.floor(pseudoRandom() * difficulties.length);
        const difficulty = difficulties[difficultyIndex];

        return { categoryId, difficulty };
    }

    function handleDailyChallengeClick() {
        const today = getTodaysDateString();
        const lastCompletion = localStorage.getItem('dailyChallenge_lastCompletionDate');

        if (lastCompletion === today) {
            showToast("You've already completed today's challenge! Come back tomorrow.");
            return;
        }

        isDailyChallengeMode = true;
        const challenge = generateDailyChallenge();
        initializeGame(challenge.categoryId, challenge.difficulty);
    }

    // --- POWER-UP HELPERS ---
    function hintEffect() {
        hintsRemaining++;
        updateHintDisplay();
        showToast('💡 You found an extra hint!');
    }


    // --- ACHIEVEMENT HELPERS ---
    function loadAchievements() {
        const saved = localStorage.getItem('unlockedAchievements');
        if (saved) {
            unlockedAchievements = new Set(JSON.parse(saved));
        }
    }

    function unlockAchievement(achievementId) {
        if (unlockedAchievements.has(achievementId)) return; // Already unlocked

        unlockedAchievements.add(achievementId);
        localStorage.setItem('unlockedAchievements', JSON.stringify([...unlockedAchievements]));

        const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);
        if (achievement) {
            showToast(`🏆 Achievement Unlocked: ${achievement.title}`);
        }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.classList.add('toast');
        toast.textContent = message;
        toastContainer.appendChild(toast);

        // The 'toast-out' animation will handle removal, but this is a fallback
        setTimeout(() => {
            toast.remove();
        }, 4500);
    }

    function checkWinAchievements(elapsedTime, starRating) {
        unlockAchievement(ACHIEVEMENTS.FIRST_WIN.id);
        if (elapsedTime < 45000) unlockAchievement(ACHIEVEMENTS.SPEEDSTER.id);
        if (starRating === 3) unlockAchievement(ACHIEVEMENTS.PERFECT_GAME.id);
        if ((currentDifficulty === 'medium' || currentDifficulty === 'hard') && hintsRemaining === difficultySettings[currentDifficulty].hints) {
            unlockAchievement(ACHIEVEMENTS.HINT_SAVER.id);
        }
    }

    // --- SOUND HELPERS ---
    function playSound(sound) {
        if (sound) {
            sound.currentTime = 0; // Rewind to the start
            sound.play().catch(e => console.error("Error playing sound:", e));
        }
    }

    // --- UI & SCREEN MANAGEMENT ---
    function showCategoryScreen() {
        categorySelection.classList.remove('hidden');
        gameHeader.classList.add('hidden');
        gameContainer.classList.add('hidden');
        startGameButton.disabled = true;
        if (bestTimeElement) bestTimeElement.textContent = '';
        if (winStarsElement) winStarsElement.innerHTML = '';
        winModal.classList.remove('visible');
        isDailyChallengeMode = false;
        gameHeader.querySelector('h1').textContent = 'Memory Fun!'; // Reset header
        achievementsModal.classList.remove('visible');
        tutorialModal.classList.remove('visible');
        pauseModal.classList.remove('visible');
        clearInterval(timerInterval);
        if (timerSpan) timerSpan.textContent = '00:00';
        populateDropdown();
    }

    function showGameScreen() {
        categorySelection.classList.add('hidden');
        gameHeader.classList.remove('hidden');
        gameContainer.classList.remove('hidden');
    }

    function pauseGame() {
        if (isPaused || !timerInterval) return;
        isPaused = true;
        lockBoard = true; // Prevent interaction while modal appears
        clearInterval(timerInterval);
        timeElapsedBeforePause = Date.now() - gameStartTime;
        pauseModal.classList.add('visible');
        pauseButton.disabled = true;
    }

    function resumeGame() {
        if (!isPaused) return;
        isPaused = false;
        lockBoard = false;
        pauseModal.classList.remove('visible');
        // Adjust start time to account for the paused duration
        gameStartTime = Date.now() - timeElapsedBeforePause;
        timerInterval = setInterval(updateTimer, 1000);
        pauseButton.disabled = false;
    }

    function populateAchievementsModal() {
        achievementsList.innerHTML = '';
        Object.values(ACHIEVEMENTS).forEach(ach => {
            const item = document.createElement('div');
            item.classList.add('achievement-item');
            if (unlockedAchievements.has(ach.id)) {
                item.classList.add('unlocked');
            }
            item.innerHTML = `
                <h3>${ach.title}</h3>
                <p>${ach.description}</p>
            `;
            achievementsList.appendChild(item);
        });
    }

    function showAchievementsModal() {
        populateAchievementsModal();
        achievementsModal.classList.add('visible');
    }

    // --- GAME INITIALIZATION ---
    async function initializeGame(categoryId, forcedDifficulty = null) {
        if (forcedDifficulty) {
            currentDifficulty = forcedDifficulty;
            difficultyButtons.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.difficulty === forcedDifficulty);
            });
        }

        if (isDailyChallengeMode) {
            gameHeader.querySelector('h1').textContent = 'Daily Challenge';
        }

        showGameScreen();
        resetGame(true); // Full reset including board HTML
        gameBoard.innerHTML = `
            <div class="loader-container" style="grid-column: 1 / -1;">
                <div class="loader"></div>
                <p class="loader-text">Loading Images...</p>
            </div>
        `;

        const settings = difficultySettings[currentDifficulty];
        const pairsToFetch = settings.pairs;
        currentCategoryId = parseInt(categoryId, 10);
        const selectedCategory = categoryMap.get(currentCategoryId);

        // --- Achievement Check: Category Explorer ---
        const playedCategories = JSON.parse(localStorage.getItem('playedCategories') || '[]');
        const playedSet = new Set(playedCategories);
        playedSet.add(currentCategoryId);
        localStorage.setItem('playedCategories', JSON.stringify([...playedSet]));
        if (playedSet.size >= 5) unlockAchievement(ACHIEVEMENTS.CATEGORY_EXPLORER.id);

        currentCategoryName = selectedCategory ? selectedCategory.name.replace(/ Coloring Pages?/gi, '').trim() : 'this category';
        let imageUrls = [];

        // If the selected category is a parent, fetch a mix from its children.
        if (selectedCategory && selectedCategory.children.length > 0) {

            const children = [...selectedCategory.children];
            shuffle(children);

            // Use at least 3 children if available, otherwise use all of them.
            const childrenToSample = children.length >= 3 ? children.slice(0, 3) : children;

            if (childrenToSample.length > 0) {

                // Fetch images from all sampled children concurrently
                const imagePromises = childrenToSample.map(child => fetchImages(child.id, pairsToFetch));
                const nestedImageUrls = await Promise.all(imagePromises);

                // Flatten the array of arrays, and get unique URLs
                const uniqueUrls = [...new Set(nestedImageUrls.flat())];

                // Shuffle the collected unique images and take the first 8
                shuffle(uniqueUrls);
                imageUrls = uniqueUrls.slice(0, pairsToFetch);

            }
        }

        // If no images were found from children (or it wasn't a parent), fetch from the category itself.
        if (imageUrls.length === 0) {
            imageUrls = await fetchImages(categoryId, pairsToFetch);
        }

        // --- Inject Special Cards ---
        let finalImageSet = [...imageUrls];
        if (currentDifficulty === 'medium' && finalImageSet.length >= settings.pairs) {
            finalImageSet.pop(); // Remove one image pair to make space
            finalImageSet.push(SPECIAL_CARDS.PEEK.id);
        } else if (currentDifficulty === 'hard' && finalImageSet.length >= settings.pairs) {
            finalImageSet.pop(); // Remove two image pairs
            finalImageSet.pop();
            finalImageSet.push(SPECIAL_CARDS.PEEK.id);
            finalImageSet.push(SPECIAL_CARDS.HINT.id);
        }

        // The final set of items to be paired up on the board
        currentImageUrls = finalImageSet;

        if (currentImageUrls.length < settings.pairs && currentImageUrls.length > 0) {
            console.warn(`Only found ${currentImageUrls.length} of ${settings.pairs} required images. The game will have fewer pairs.`);
        } else if (currentImageUrls.length < 2) { // Need at least 2 pairs to play
            gameBoard.innerHTML = `<p>Could not find any images for this category or its sub-categories. Please choose another.</p>`;
            return;
        }

        setupBoard();
    }

    function setupBoard() {
        resetGame(true); // Clear board and reset counters
        const settings = difficultySettings[currentDifficulty];
        gameBoard.classList.remove('difficulty-easy', 'difficulty-medium', 'difficulty-hard');
        gameBoard.classList.add(`difficulty-${currentDifficulty}`);
        hintsRemaining = settings.hints;
        updateHintDisplay();
        hintButton.disabled = false;
        totalPairs = currentImageUrls.length;
        const gameImages = [...currentImageUrls, ...currentImageUrls];

        // Start timer
        clearInterval(timerInterval);
        timerSpan.textContent = '00:00';
        isPaused = false;
        gameStartTime = Date.now();
        timerInterval = setInterval(updateTimer, 1000);

        shuffle(gameImages);

        gameImages.forEach((imageUrl, index) => {
            const card = document.createElement('div');
            card.classList.add('memory-card');
            // Use the image URL as a unique identifier for the pair
            card.dataset.id = imageUrl;

            let backFaceHTML = '';
            const specialCard = Object.values(SPECIAL_CARDS).find(sc => sc.id === imageUrl);

            if (specialCard) {
                backFaceHTML = `
                    <div class="back-face special-card-back">
                        <div class="icon">${specialCard.icon}</div>
                        <div>${specialCard.text}</div>
                    </div>
                `;
            } else {
                backFaceHTML = `
                    <div class="back-face">
                        <img src="${imageUrl}" alt="Memory Card Image">
                    </div>
                `;
            }

            card.innerHTML = `<div class="front-face"></div>${backFaceHTML}`;
            gameBoard.appendChild(card);
            card.addEventListener('click', flipCard);
        });
    }


    function populateDropdown() {
        // 4. Populate the dropdown with parents and indented children
        categoryDropdown.innerHTML = '';
        addDefaultDropdownOption();
        topLevelCategories.forEach(parentCategory => {
            // Add the parent category itself as a selectable option
            const parentOption = document.createElement('option');
            parentOption.value = parentCategory.id;
            const parentRating = getStarRating(parentCategory.id, currentDifficulty);
            const parentStars = '★'.repeat(parentRating) + '☆'.repeat(3 - parentRating);
            parentOption.textContent = `${parentCategory.name.replace(/ Coloring Pages?/gi, '').trim()} ${parentStars}`;

            parentOption.classList.add('parent-category');
            categoryDropdown.appendChild(parentOption);

            // Add its children as indented options
            if (parentCategory.children.length > 0) {
                parentCategory.children.forEach(childCategory => {
                    const childOption = document.createElement('option');
                    childOption.value = childCategory.id;
                    const childRating = getStarRating(childCategory.id, currentDifficulty);
                    const childStars = '★'.repeat(childRating) + '☆'.repeat(3 - childRating);

                    // Use a character for indentation for better cross-browser support
                    childOption.textContent = `  • ${childCategory.name.replace(/ Coloring Pages?/gi, '').trim()} ${childStars}`;

                    childOption.classList.add('child-category');
                    categoryDropdown.appendChild(childOption);
                });
            }
        });
    }
    function addDefaultDropdownOption() {
        const defaultOption = document.createElement('option');
        defaultOption.textContent = 'Select a category';
        defaultOption.value = '';
        categoryDropdown.appendChild(defaultOption);
    }

    async function fetchAndDisplayCategories() {
        const flatCategories = await fetchCategories();

        if (flatCategories.length === 0) {
            // Display an error inside the loader container if fetching fails
            categoryLoader.innerHTML = '<p class="loader-text">Could not load categories. Please refresh.</p>';
            return; // Exit if no categories were fetched
        }

        // --- Build Hierarchy ---
        categoryMap.clear(); // Clear previous data
        topLevelCategories = []; // Use the global variable

        // 1. Initialize each category with a children array and add to a map
        flatCategories.forEach(category => {
            category.children = [];
            categoryMap.set(category.id, category);
        });

        // 2. Link children to their parents
        flatCategories.forEach(category => {
            if (category.parent !== 0 && categoryMap.has(category.parent)) {
                const parentCategory = categoryMap.get(category.parent);
                parentCategory.children.push(category);
            } else if (category.parent === 0) {
                topLevelCategories.push(category);
            }
        });

        // 3. Sort categories alphabetically for better UX
        const sortByName = (a, b) => a.name.localeCompare(b.name);
        topLevelCategories.sort(sortByName);
        topLevelCategories.forEach(parent => parent.children.sort(sortByName));

        // Initial population of dropdown
        populateDropdown();
        // Hide loader and show the dropdown controls
        categoryLoader.classList.add('hidden');
        categoryContainer.classList.remove('hidden');
    }

    function updateHintDisplay() {
        const hintSpan = hintButton.querySelector('span');
        if (hintSpan) {
            hintSpan.textContent = `Hint (${hintsRemaining})`;
        }
    }

    function updateTimer() {
        const elapsedTime = Date.now() - gameStartTime;
        timerSpan.textContent = formatTime(elapsedTime);
    }

    function formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    function handleStartGame() {
        const categoryId = categoryDropdown.value;
        if (categoryId) initializeGame(categoryId);
    }

    function shuffle(array) {
        // Fisher-Yates (aka Knuth) Shuffle
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    // --- GAME LOGIC ---
    function flipCard() {
        if (lockBoard) return;
        if (this === firstCard) return;

        playSound(flipSound);
        this.classList.add('flip');

        if (!hasFlippedCard) {
            // First card flipped
            hasFlippedCard = true;
            firstCard = this;
            return;
        }

        // Second card flipped
        secondCard = this;
        incrementMoves();
        checkForMatch();
    }

    function checkForMatch() {
        if (firstCard.dataset.id === secondCard.dataset.id) {
            processSuccessfulMatch();
        } else {
            unflipCards();
        }
    }

    function processSuccessfulMatch() {
        const cardId = firstCard.dataset.id;
        const isSpecial = Object.values(SPECIAL_CARDS).some(sc => sc.id === cardId);

        playSound(matchSound);
        firstCard.removeEventListener('click', flipCard);
        secondCard.removeEventListener('click', flipCard);
        addXP(XP_PER_MATCH);
        matchedPairs++;

        if (isSpecial) {
            lockBoard = true; // Keep board locked for the effect
            setTimeout(() => triggerSpecialCardEffect(cardId), 500);
        } else {
            resetBoard();
            checkForWin();
        }
    }

    function triggerSpecialCardEffect(cardId) {
        switch (cardId) {
            case SPECIAL_CARDS.PEEK.id:
                const cardsToPeek = document.querySelectorAll('.memory-card:not(.flip)');
                cardsToPeek.forEach(card => card.classList.add('flip'));
                setTimeout(() => {
                    cardsToPeek.forEach(card => card.classList.remove('flip'));
                    resetBoard();
                    checkForWin();
                }, 1500); // Peek for 1.5 seconds
                break;
            case SPECIAL_CARDS.HINT.id:
                hintEffect();
                resetBoard();
                checkForWin();
                break;
        }
    }

    function checkForWin() {
        if (matchedPairs === totalPairs) {
            clearInterval(timerInterval);
            const elapsedTime = Date.now() - gameStartTime;
            setTimeout(() => showWinModal(elapsedTime), 500);
        }
    }

    function unflipCards() {
        lockBoard = true;
        setTimeout(() => {
            firstCard.classList.remove('flip');
            secondCard.classList.remove('flip');
            resetBoard();
        }, 1200);
    }

    function resetBoard() {
        [hasFlippedCard, lockBoard] = [false, false];
        [firstCard, secondCard] = [null, null];
    }

    function incrementMoves() {
        moves++;
        movesCountSpan.textContent = moves;
    }

    function resetGame(clearBoardHtml = false) {
        if (clearBoardHtml) gameBoard.innerHTML = '';
        moves = 0;
        matchedPairs = 0;
        movesCountSpan.textContent = moves;
        resetBoard(); // Resets flipped cards, lock state etc.
        winModal.classList.remove('visible');
        pauseModal.classList.remove('visible');
        clearInterval(timerInterval);
        if (timerSpan) timerSpan.textContent = '00:00';
    }

    function displayStars(rating) {
        if (!winStarsElement) return;
        winStarsElement.innerHTML = ''; // Clear previous stars
        for (let i = 1; i <= 3; i++) {
            const starSpan = document.createElement('span');
            starSpan.textContent = '★';
            if (i <= rating) {
                starSpan.classList.add('filled');
            }
            // Add a little animation delay for each star
            starSpan.style.transitionDelay = `${i * 0.1}s`;
            starSpan.style.transform = 'scale(0)';
            winStarsElement.appendChild(starSpan);

            // Trigger the animation
            setTimeout(() => {
                starSpan.style.transform = 'scale(1)';
            }, 100);
        }
    }

    function showWinModal(elapsedTime) {
        playSound(winSound);
        // Trigger confetti
        confetti({
            particleCount: 150,
            spread: 90,
            origin: { y: 0.6 }
        });

        // --- Star Rating Logic ---
        const settings = difficultySettings[currentDifficulty];
        let starRating = 0;
        if (moves <= settings.starThresholds.three) {
            starRating = 3;
        } else if (moves <= settings.starThresholds.two) {
            starRating = 2;
        } else {
            starRating = 1;
        }
        displayStars(starRating);
        addXP(XP_WIN_BONUS[starRating] || 50);

        // --- Create Shareable Text ---
        const starsText = '★'.repeat(starRating) + '☆'.repeat(3 - starRating);
        const gameModeText = isDailyChallengeMode ? "Today's Daily Challenge" : `Category: ${currentCategoryName}`;
        const difficultyText = currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
        const formattedTime = formatTime(elapsedTime);
        shareableScoreText = `I just played Memory Fun! 🧠\n\n${gameModeText}\nDifficulty: ${difficultyText}\nScore: ${starsText}\nTime: ${formattedTime}\nMoves: ${moves}\n\nCan you beat my score?`;

        // --- Check Achievements ---
        checkWinAchievements(elapsedTime, starRating);

        const finalTimeInSeconds = Math.floor(elapsedTime / 1000);

        winTimeElement.textContent = `Your time: ${formattedTime}`;

        if (isDailyChallengeMode) {
            const today = getTodaysDateString();
            localStorage.setItem('dailyChallenge_lastCompletionDate', today);
            saveBestTime(`daily_${today}`, currentDifficulty, finalTimeInSeconds);
            saveStarRating(`daily_${today}`, currentDifficulty, starRating);
            const dailyBestTime = getBestTime(`daily_${today}`, currentDifficulty);
            bestTimeElement.textContent = `Today's Best: ${formatTime(dailyBestTime * 1000)}`;
        } else {
            const isNewRecord = saveBestTime(currentCategoryId, currentDifficulty, finalTimeInSeconds);
            const bestTimeInSeconds = getBestTime(currentCategoryId, currentDifficulty);
            if (isNewRecord) {
                bestTimeElement.innerHTML = `✨ New Best Time! ✨`;
            } else if (bestTimeInSeconds) {
                const formattedBestTime = formatTime(bestTimeInSeconds * 1000);
                bestTimeElement.textContent = `Best for this category (${currentDifficulty}): ${formattedBestTime}`;
            } else {
                bestTimeElement.textContent = '';
            }
        }
        winModal.classList.add('visible');
    }

    function showHint() {
        if (lockBoard || hintsRemaining <= 0) return;

        const unflippedCards = document.querySelectorAll('.memory-card:not(.flip)');
        const cardGroups = new Map();

        unflippedCards.forEach(card => {
            const id = card.dataset.id;
            if (!cardGroups.has(id)) {
                cardGroups.set(id, []);
            }
            cardGroups.get(id).push(card);
        });

        let pairToShow = null;
        for (const group of cardGroups.values()) {
            if (group.length === 2) {
                pairToShow = group;
                break;
            }
        }

        if (pairToShow) {
            hintsRemaining--;
            updateHintDisplay();

            lockBoard = true;
            hintButton.disabled = true;
            pairToShow.forEach(card => card.classList.add('hint-reveal'));
            setTimeout(() => {
                pairToShow.forEach(card => card.classList.remove('hint-reveal'));
                lockBoard = false;
                // Re-enable button only if hints are left
                if (hintsRemaining > 0) {
                    hintButton.disabled = false;
                }
            }, 1500);
        } else {
            // No hint available, provide feedback to the user
            const hintSpan = hintButton.querySelector('span');
            if (!hintSpan) return; // Safety check
            const originalText = hintSpan.textContent;
            hintButton.disabled = true;
            hintSpan.textContent = 'No Hints!';
            setTimeout(() => {
                hintSpan.textContent = originalText;
                hintButton.disabled = false;
            }, 1500);
        }
    }

    async function shareScore() {
        if (!shareableScoreText) return;

        const winModalContent = winModal.querySelector('.modal-content');
        const linkToShare = "https://sasy1991.github.io/memory/"; // This is your placeholder link

        try {
            const canvas = await html2canvas(winModalContent, { scale: 2, backgroundColor: null });
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            if (!blob) throw new Error('Canvas to Blob conversion failed');

            const file = new File([blob], 'score.png', { type: 'image/png' });
            const shareData = { files: [file], title: 'Memory Fun! Score', text: shareableScoreText, url: linkToShare };

            // Check if we can share files
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share(shareData);
            } else {
                // Fallback for browsers that can't share files (e.g., desktop)
                await navigator.clipboard.writeText(`${shareableScoreText}\n\nPlay here: ${linkToShare}`);
                showToast('Score copied to clipboard!');
            }
        } catch (error) {
            console.error('Error sharing score with image:', error);
            await navigator.clipboard.writeText(`${shareableScoreText}\n\nPlay here: ${linkToShare}`);
            showToast('Image sharing not supported. Score copied to clipboard!');
        }
    }

    // --- EVENT LISTENERS ---
    restartButton.addEventListener('click', () => {
        // Restarts the current game with the same images
        setupBoard();
    });
    hintButton.addEventListener('click', showHint);
    pauseButton.addEventListener('click', pauseGame);
    resumeButton.addEventListener('click', resumeGame);
    playAgainButton.addEventListener('click', showCategoryScreen);
    howToPlayButton.addEventListener('click', () => tutorialModal.classList.add('visible'));
    closeTutorialButton.addEventListener('click', () => tutorialModal.classList.remove('visible'));
    shareButton.addEventListener('click', shareScore);
    dailyChallengeButton.addEventListener('click', handleDailyChallengeClick);
    achievementsButton.addEventListener('click', showAchievementsModal);
    closeAchievementsButton.addEventListener('click', () => achievementsModal.classList.remove('visible'));
    categoryDropdown.addEventListener('change', () => {
        // Enable the start button only if a valid category is selected
        startGameButton.disabled = !categoryDropdown.value;
    });
    startGameButton.addEventListener('click', handleStartGame);
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentDifficulty = button.dataset.difficulty;
            difficultyButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            populateDropdown();

        });
    });

    // --- APP START ---
    function startApp() {
        loadPlayerStats();
        loadAchievements();
        categoryLoader.classList.remove('hidden');
        categoryContainer.classList.add('hidden');
        showCategoryScreen();
        updatePlayerStatsUI();
        fetchAndDisplayCategories();
    }

    startApp();
});