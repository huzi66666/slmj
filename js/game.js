/**
 * 神农密境 - 中药学答题挑战
 * 游戏核心逻辑
 */

const ENCRYPT_KEY = "zhongyaoxue2024tcm";

// ============ 数据解密 ============
function xorDecrypt(encryptedBase64, key) {
    const encrypted = atob(encryptedBase64);
    const keyBytes = new TextEncoder().encode(key);
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted.charCodeAt(i) ^ keyBytes[i % keyBytes.length];
    }
    return new TextDecoder().decode(decrypted);
}

// ============ 游戏状态 ============
const GameState = {
    // 题库数据
    allQuestions: [],
    categories: [],
    meta: {},

    // 当前游戏配置
    selectedCategory: '',
    questionsPerLevel: 10,

    // 当前游戏进度
    currentLevel: 1, // 1=简单, 2=一般, 3=困难
    currentQuestionIndex: 0,
    currentQuestions: [],
    selectedOptions: [],

    // 统计
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    levelStats: [
        { correct: 0, wrong: 0, total: 0 },
        { correct: 0, wrong: 0, total: 0 },
        { correct: 0, wrong: 0, total: 0 }
    ],

    // 错题集
    wrongBook: [],

    // 自动跳转计时器
    autoNextTimer: null,
    countdownTimer: null,
    countdownSeconds: 3,

    // 关卡配置
    levels: [
        { difficulty: '简单', name: '小药童', badge: '童', class: 'easy', passRate: 0.8, count: 10 },
        { difficulty: '一般', name: '百草药师', badge: '师', class: 'medium', passRate: 0.8, count: 10 },
        { difficulty: '困难', name: '药王', badge: '王', class: 'hard', passRate: 1.0, count: 5 }
    ]
};

// ============ 初始化 ============
function initGame() {
    try {
        const jsonStr = xorDecrypt(ENCRYPTED_DATA, ENCRYPT_KEY);
        const data = JSON.parse(jsonStr);
        GameState.allQuestions = data.questions;
        GameState.categories = data.categories;
        GameState.meta = data.meta;
        initCategorySelect();
        bindEvents();
    } catch (e) {
        console.error('数据解密失败:', e);
        alert('题库数据加载失败，请刷新页面重试。');
    }
}

function initCategorySelect() {
    const select = document.getElementById('category-picker');
    GameState.categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        const parts = cat.split(',');
        option.textContent = parts.length > 1 ? parts[parts.length - 1].trim() : cat;
        select.appendChild(option);
    });
}

function bindEvents() {
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-submit').addEventListener('click', submitAnswer);
    document.getElementById('btn-next').addEventListener('click', handleNextClick);
    document.getElementById('btn-next-level').addEventListener('click', startNextLevel);
    document.getElementById('btn-restart').addEventListener('click', restartGame);
    document.getElementById('btn-home').addEventListener('click', goHome);
    document.getElementById('btn-wrong-book').addEventListener('click', showWrongBook);
    document.getElementById('btn-back-end').addEventListener('click', backToEnd);
}

// ============ 游戏流程 ============
function startGame() {
    GameState.selectedCategory = document.getElementById('category-picker').value;

    // 重置状态
    GameState.currentLevel = 1;
    GameState.score = 0;
    GameState.correctCount = 0;
    GameState.wrongCount = 0;
    GameState.wrongBook = [];
    GameState.levelStats = [
        { correct: 0, wrong: 0, total: 0 },
        { correct: 0, wrong: 0, total: 0 },
        { correct: 0, wrong: 0, total: 0 }
    ];

    startLevel();
}

function startLevel() {
    const level = GameState.levels[GameState.currentLevel - 1];
    const difficulty = level.difficulty;
    const levelCount = level.count;

    // 筛选题目
    let pool = GameState.allQuestions.filter(q => q.difficulty === difficulty);
    if (GameState.selectedCategory) {
        pool = pool.filter(q => q.category === GameState.selectedCategory);
    }

    // 如果筛选后题目不够，从全部该难度题目中补充
    if (pool.length < levelCount) {
        const allPool = GameState.allQuestions.filter(q => q.difficulty === difficulty);
        pool = allPool;
    }

    // 随机选取题目（不超过题池总量）
    const count = Math.min(levelCount, pool.length);
    GameState.currentQuestions = shuffleArray(pool).slice(0, count);
    GameState.currentQuestionIndex = 0;
    GameState.levelStats[GameState.currentLevel - 1] = { correct: 0, wrong: 0, total: count };

    showScreen('screen-game');
    updateGameHeader();
    showQuestion();
}

function showQuestion() {
    const question = GameState.currentQuestions[GameState.currentQuestionIndex];
    if (!question) return;

    // 清除自动跳转计时器
    clearAutoNext();

    // 更新题目信息
    const isMulti = question.type === '多选题';
    const typeBadge = document.getElementById('question-type-badge');
    typeBadge.textContent = question.type || '单选题';
    typeBadge.className = 'type-badge' + (isMulti ? ' multi' : '');

    // 知识点
    const categoryTag = document.getElementById('question-category');
    const parts = question.category.split(',');
    categoryTag.textContent = parts.length > 1 ? parts[parts.length - 1].trim() : question.category;

    // 题干
    document.getElementById('question-stem').textContent = question.stem;

    // 选项 - 使用天干编号 + 本草图标
    const container = document.getElementById('options-container');
    container.innerHTML = '';
    GameState.selectedOptions = [];

    const tianGan = {
        'A': { icon: '🌿', text: '甲', colorClass: 'tg-a' },
        'B': { icon: '🍃', text: '乙', colorClass: 'tg-b' },
        'C': { icon: '🌱', text: '丙', colorClass: 'tg-c' },
        'D': { icon: '🍂', text: '丁', colorClass: 'tg-d' },
        'E': { icon: '🌾', text: '戊', colorClass: 'tg-e' }
    };
    const optionKeys = Object.keys(question.options);
    optionKeys.forEach(key => {
        const tg = tianGan[key] || { icon: '', text: key, colorClass: '' };
        const item = document.createElement('div');
        item.className = 'option-item';
        item.dataset.key = key;
        item.innerHTML = `
            <span class="option-label ${tg.colorClass}"><span class="tg-icon">${tg.icon}</span><span class="tg-text">${tg.text}</span></span>
            <span class="option-text">${question.options[key]}</span>
        `;
        item.addEventListener('click', () => selectOption(item, key, isMulti));
        container.appendChild(item);
    });

    // 重置按钮状态
    document.getElementById('btn-submit').disabled = true;
    document.getElementById('btn-submit').classList.remove('hidden');
    document.getElementById('btn-next').classList.add('hidden');

    // 隐藏反馈
    const feedbackArea = document.getElementById('feedback-area');
    feedbackArea.classList.add('hidden');
    feedbackArea.className = 'feedback-area hidden';

    // 更新进度
    updateGameHeader();

    // 多选提示
    if (isMulti) {
        document.getElementById('question-stem').textContent += '\n（多选题，请选择所有正确答案）';
    }
}

function selectOption(item, key, isMulti) {
    if (isMulti) {
        const idx = GameState.selectedOptions.indexOf(key);
        if (idx > -1) {
            GameState.selectedOptions.splice(idx, 1);
            item.classList.remove('selected');
        } else {
            GameState.selectedOptions.push(key);
            item.classList.add('selected');
        }
    } else {
        document.querySelectorAll('.option-item').forEach(el => el.classList.remove('selected'));
        GameState.selectedOptions = [key];
        item.classList.add('selected');
    }

    document.getElementById('btn-submit').disabled = GameState.selectedOptions.length === 0;
}

function submitAnswer() {
    const question = GameState.currentQuestions[GameState.currentQuestionIndex];
    const correctAnswers = question.answer.split('').filter(c => c.trim());
    const userAnswers = GameState.selectedOptions.sort();
    const isCorrect = arraysEqual(userAnswers, correctAnswers.sort());

    // 禁用选项点击
    document.querySelectorAll('.option-item').forEach(el => {
        el.classList.add('disabled');
    });

    // 标记正确和错误选项
    document.querySelectorAll('.option-item').forEach(el => {
        const key = el.dataset.key;
        if (correctAnswers.includes(key)) {
            el.classList.add('correct');
        }
        if (userAnswers.includes(key) && !correctAnswers.includes(key)) {
            el.classList.add('wrong');
        }
    });

    // 显示反馈
    const feedbackArea = document.getElementById('feedback-area');
    feedbackArea.classList.remove('hidden');

    if (isCorrect) {
        feedbackArea.className = 'feedback-area correct';
        document.getElementById('feedback-icon').textContent = '✓';
        document.getElementById('feedback-text').textContent = getCorrectMessage();
        GameState.score += getScoreForLevel(GameState.currentLevel);
        GameState.correctCount++;
        GameState.levelStats[GameState.currentLevel - 1].correct++;
        createParticles('success');
    } else {
        feedbackArea.className = 'feedback-area wrong';
        document.getElementById('feedback-icon').textContent = '✗';
        document.getElementById('feedback-text').textContent = `答错了！正确答案是：${correctAnswers.join('')}`;
        GameState.wrongCount++;
        GameState.levelStats[GameState.currentLevel - 1].wrong++;
        document.querySelector('.question-card').classList.add('shake');
        setTimeout(() => document.querySelector('.question-card').classList.remove('shake'), 400);

        // 记录错题
        const tianGanMap = { 'A': '甲', 'B': '乙', 'C': '丙', 'D': '丁', 'E': '戊' };
        GameState.wrongBook.push({
            stem: question.stem,
            options: question.options,
            correctAnswer: correctAnswers.map(a => tianGanMap[a] || a).join(''),
            userAnswer: userAnswers.map(a => tianGanMap[a] || a).join(''),
            correctKeys: correctAnswers,
            userKeys: userAnswers,
            analysis: question.analysis || '',
            category: question.category,
            level: GameState.levels[GameState.currentLevel - 1].name
        });
    }

    // 解析
    const analysis = question.analysis;
    document.getElementById('feedback-analysis').textContent = analysis ? `解析：${analysis}` : '';

    // 更新UI
    updateGameHeader();

    // 按钮切换
    document.getElementById('btn-submit').classList.add('hidden');
    document.getElementById('btn-next').classList.remove('hidden');

    // 启动自动跳转倒计时
    startAutoNext();
}

// ============ 自动跳转 ============
function startAutoNext() {
    let seconds = GameState.countdownSeconds;
    const countdownEl = document.getElementById('feedback-countdown');
    countdownEl.textContent = `${seconds}秒后自动进入下一题...`;

    GameState.countdownTimer = setInterval(() => {
        seconds--;
        if (seconds > 0) {
            countdownEl.textContent = `${seconds}秒后自动进入下一题...`;
        } else {
            countdownEl.textContent = '';
            clearInterval(GameState.countdownTimer);
            GameState.countdownTimer = null;
        }
    }, 1000);

    GameState.autoNextTimer = setTimeout(() => {
        GameState.autoNextTimer = null;
        nextQuestion();
    }, GameState.countdownSeconds * 1000);
}

function clearAutoNext() {
    if (GameState.autoNextTimer) {
        clearTimeout(GameState.autoNextTimer);
        GameState.autoNextTimer = null;
    }
    if (GameState.countdownTimer) {
        clearInterval(GameState.countdownTimer);
        GameState.countdownTimer = null;
    }
    const countdownEl = document.getElementById('feedback-countdown');
    if (countdownEl) countdownEl.textContent = '';
}

function handleNextClick() {
    clearAutoNext();
    nextQuestion();
}

// ============ 关卡流转 ============
function nextQuestion() {
    GameState.currentQuestionIndex++;

    // 检查当前关卡是否结束
    if (GameState.currentQuestionIndex >= GameState.currentQuestions.length) {
        checkLevelResult();
        return;
    }

    showQuestion();
}

function checkLevelResult() {
    const level = GameState.levels[GameState.currentLevel - 1];
    const stat = GameState.levelStats[GameState.currentLevel - 1];
    const accuracy = stat.total > 0 ? stat.correct / stat.total : 0;
    const passed = accuracy >= level.passRate;

    if (passed) {
        if (GameState.currentLevel >= 3) {
            // 全部通关
            showEndScreen(true);
        } else {
            // 显示过渡界面
            showTransitionScreen();
        }
    } else {
        // 未通过，显示失败过渡界面并重试当前关卡
        showLevelFailScreen();
    }
}

function showLevelFailScreen() {
    const level = GameState.levels[GameState.currentLevel - 1];
    const stat = GameState.levelStats[GameState.currentLevel - 1];
    const accuracy = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
    const requiredRate = Math.round(level.passRate * 100);

    document.getElementById('transition-icon').textContent = '😥';
    document.getElementById('transition-title').textContent = `「${level.name}」未通过`;
    document.getElementById('transition-desc').textContent = `需要答对率达到${requiredRate}%才能过关，本次${accuracy}%`;

    document.getElementById('transition-stats').innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${stat.correct}</span>
            <span class="stat-label">答对</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${stat.wrong}</span>
            <span class="stat-label">答错</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${accuracy}%</span>
            <span class="stat-label">正确率</span>
        </div>
    `;

    document.getElementById('btn-next-level').textContent = `重新挑战「${level.name}」`;
    showScreen('screen-transition');
}

function showTransitionScreen() {
    const levelStat = GameState.levelStats[GameState.currentLevel - 1];
    const level = GameState.levels[GameState.currentLevel - 1];
    const nextLevel = GameState.levels[GameState.currentLevel];

    document.getElementById('transition-icon').textContent = '🎊';
    document.getElementById('transition-title').textContent = `「${level.name}」通过！`;
    document.getElementById('transition-desc').textContent = `即将进入「${nextLevel.name}」`;

    const accuracy = levelStat.total > 0 ? Math.round((levelStat.correct / levelStat.total) * 100) : 0;
    document.getElementById('transition-stats').innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${levelStat.correct}</span>
            <span class="stat-label">答对</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${levelStat.wrong}</span>
            <span class="stat-label">答错</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${accuracy}%</span>
            <span class="stat-label">正确率</span>
        </div>
    `;

    document.getElementById('btn-next-level').textContent = `进入「${nextLevel.name}」`;
    showScreen('screen-transition');
    createParticles('transition');
}

function startNextLevel() {
    const level = GameState.levels[GameState.currentLevel - 1];
    const stat = GameState.levelStats[GameState.currentLevel - 1];
    const accuracy = stat.total > 0 ? stat.correct / stat.total : 0;
    const passed = accuracy >= level.passRate;

    if (passed) {
        // 通过了，进入下一关
        GameState.currentLevel++;
        startLevel();
    } else {
        // 未通过，重试当前关卡
        startLevel();
    }
}

function showEndScreen(success) {
    const endIcon = document.getElementById('end-icon');
    const endTitle = document.getElementById('end-title');
    const endSubtitle = document.getElementById('end-subtitle');

    if (success) {
        endIcon.textContent = '🏆';
        endTitle.textContent = '恭喜通关！';
        endSubtitle.textContent = '你已经完成了所有关卡的挑战，堪称药王传人！';
        createParticles('victory');
    } else {
        endIcon.textContent = '💊';
        endTitle.textContent = '闯关失败';
        endSubtitle.textContent = '继续努力学习吧！';
    }

    const totalQuestions = GameState.correctCount + GameState.wrongCount;
    const accuracy = totalQuestions > 0 ? Math.round((GameState.correctCount / totalQuestions) * 100) : 0;

    document.getElementById('end-stats').innerHTML = `
        <div class="stat-item">
            <span class="stat-value">${GameState.score}</span>
            <span class="stat-label">总得分</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${accuracy}%</span>
            <span class="stat-label">正确率</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${GameState.correctCount}</span>
            <span class="stat-label">答对题数</span>
        </div>
        <div class="stat-item">
            <span class="stat-value">${GameState.currentLevel}/3</span>
            <span class="stat-label">闯过关卡</span>
        </div>
    `;

    // 错题集按钮：通关成功且有错题时显示
    const wrongBookBtn = document.getElementById('btn-wrong-book');
    if (success && GameState.wrongBook.length > 0) {
        wrongBookBtn.classList.remove('hidden');
    } else {
        wrongBookBtn.classList.add('hidden');
    }

    showScreen('screen-end');
}

// ============ 错题集 ============
function showWrongBook() {
    const list = document.getElementById('wrong-book-list');
    list.innerHTML = '';

    const tianGanMap = { 'A': '甲', 'B': '乙', 'C': '丙', 'D': '丁', 'E': '戊' };

    GameState.wrongBook.forEach((item, index) => {
        const optionsHtml = Object.entries(item.options).map(([key, val]) => {
            const isCorrect = item.correctKeys.includes(key);
            const isUser = item.userKeys.includes(key);
            let cls = '';
            if (isCorrect) cls = 'wb-correct';
            else if (isUser) cls = 'wb-wrong';
            return `<div class="wb-option ${cls}"><span class="wb-option-key">${tianGanMap[key] || key}</span><span>${val}</span></div>`;
        }).join('');

        const div = document.createElement('div');
        div.className = 'wb-item';
        div.innerHTML = `
            <div class="wb-index">${index + 1}</div>
            <div class="wb-content">
                <div class="wb-meta"><span class="wb-level">${item.level}</span><span class="wb-category">${item.category.split(',').pop().trim()}</span></div>
                <div class="wb-stem">${item.stem}</div>
                <div class="wb-options">${optionsHtml}</div>
                <div class="wb-answer">
                    <span class="wb-your">你的答案：${item.userAnswer}</span>
                    <span class="wb-right">正确答案：${item.correctAnswer}</span>
                </div>
                ${item.analysis ? `<div class="wb-analysis">解析：${item.analysis}</div>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    showScreen('screen-wrong-book');
}

function backToEnd() {
    showScreen('screen-end');
}

function restartGame() {
    startGame();
}

function goHome() {
    showScreen('screen-start');
}

// ============ UI更新 ============
function updateGameHeader() {
    const level = GameState.levels[GameState.currentLevel - 1];

    const badge = document.getElementById('current-level-badge');
    badge.textContent = level.badge;
    badge.className = `level-badge ${level.class}`;
    document.getElementById('current-level-name').textContent = level.name;

    document.getElementById('question-progress').textContent =
        `${GameState.currentQuestionIndex + 1}/${GameState.currentQuestions.length}`;

    // 分数
    document.getElementById('score-text').textContent = `得分: ${GameState.score}`;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ============ 工具函数 ============
function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
}

function getScoreForLevel(level) {
    const scores = [10, 20, 30];
    return scores[level - 1] || 10;
}

function getCorrectMessage() {
    const messages = [
        '妙哉！辨药有方！',
        '正确！医者仁心！',
        '不错！药到病除！',
        '精准！悬壶济世！',
        '好！本草通达！',
        '对了！药理精通！',
        '妙！岐黄之术！',
        '善！药石之言！'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

// ============ 粒子效果 ============
const particleCanvas = document.getElementById('particle-canvas');
const ctx = particleCanvas.getContext('2d');
let particles = [];
let animationId = null;

function resizeCanvas() {
    particleCanvas.width = window.innerWidth;
    particleCanvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function createParticles(type) {
    const colors = {
        success: ['#5a8a4a', '#4a6741', '#c49a6c'],
        transition: ['#c49a6c', '#d4b08a', '#4a6741', '#6b4c35'],
        victory: ['#c49a6c', '#d4b08a', '#e07a5f', '#5a8a4a', '#6b4c35']
    };

    const count = type === 'victory' ? 60 : type === 'transition' ? 40 : 20;
    const particleColors = colors[type] || colors.success;

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * particleCanvas.width,
            y: particleCanvas.height + 10,
            vx: (Math.random() - 0.5) * 4,
            vy: -(Math.random() * 8 + 4),
            size: Math.random() * 6 + 2,
            color: particleColors[Math.floor(Math.random() * particleColors.length)],
            life: 1,
            decay: Math.random() * 0.02 + 0.01,
            gravity: 0.1
        });
    }

    if (!animationId) {
        animateParticles();
    }
}

function animateParticles() {
    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);

    particles = particles.filter(p => {
        p.x += p.vx;
        p.vy += p.gravity;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) return false;

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        return true;
    });

    ctx.globalAlpha = 1;

    if (particles.length > 0) {
        animationId = requestAnimationFrame(animateParticles);
    } else {
        animationId = null;
    }
}

// ============ 启动 ============
document.addEventListener('DOMContentLoaded', initGame);
