/* ===========================
   FlowTask — Premium To-Do App
   Core Application Logic (Part 1)
   =========================== */

(function () {
    'use strict';

    // ===================== DOM REFS =====================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const taskInput = $('#taskInput');
    const addBtn = $('#addBtn');
    const taskList = $('#taskList');
    const emptyState = $('#emptyState');
    const themeToggle = $('#themeToggle');
    const clearCompleted = $('#clearCompleted');
    const progressRing = $('#progressRing');
    const progressPercent = $('#progressPercent');
    const progressTitle = $('#progressTitle');
    const progressSubtitle = $('#progressSubtitle');
    const completedCount = $('#completedCount');
    const pendingCount = $('#pendingCount');
    const dateDisplay = $('#dateDisplay');
    const particleCanvas = $('#particleCanvas');
    const confettiCanvas = $('#confettiCanvas');
    const filterTabs = $$('.filter-tab');
    const priorityBtns = $$('.priority-btn');

    // Profile refs
    const displayAvatarImg = $('#displayAvatarImg');
    const displayAvatarFallback = $('#displayAvatarFallback');
    const greetingTime = $('#greetingTime');
    const userNameDisplay = $('#userNameDisplay');
    const profileModal = $('#profileModal');
    const editAvatarImg = $('#editAvatarImg');
    const editAvatarFallback = $('#editAvatarFallback');
    const profileNameInput = $('#profileNameInput');

    // Voice Note Refs
    const voiceNoteBtn = $('#voiceNoteBtn');
    const voiceNoteModal = $('#voiceNoteModal');
    const startRecordBtn = $('#startRecordBtn');
    const recordTimer = $('#recordTimer');
    const playPreviewBtn = $('#playPreviewBtn');
    const resetRecordBtn = $('#resetRecordBtn');
    const voiceEffects = $('#voiceEffects');
    const voiceNoteCancelBtn = $('#voiceNoteCancelBtn');
    const voiceNoteAttachBtn = $('#voiceNoteAttachBtn');
    const effectBtns = $$('.effect-btn');
    const voiceVisualizer = $('#voiceVisualizer');

    // Focus Timer Refs
    // Focus Timer Refs
    const timeShortcuts = $$('.focus-preset');
    const customTimeBtn = $('#customTimeBtn');
    const customFocusTime = $('#customFocusTime');

    // ===================== STATE =====================
    let tasks = JSON.parse(localStorage.getItem('flowtask_tasks') || '[]');
    let currentFilter = 'all';
    let currentPriority = 'normal';
    let theme = localStorage.getItem('flowtask_theme') || 'auto';
    let draggedItem = null;
    let isRepeat = false;
    let taskLocation = null;
    let taskMusic = 'none';
    let currentView = 'list';
    let calendarDate = new Date();
    let daySort = 'all'; // 'all' or '0'-'6' for Sun-Sat

    // Voice Note State
    let vnRecorder = null;
    let vnStream = null;
    let vnChunks = [];
    let vnPendingAudioData = null;
    let vnPendingEffect = 'normal';
    let vnRecordTimer = null;
    let vnRecordSeconds = 0;
    let vnAudioCtx = null;
    let vnAnalyser = null;
    let vnVisualizerId = null;
    let vnCurrentlyPlayingSource = null;
    let vnCurrentlyPlayingBtn = null;

    // Gamification
    let xp = parseInt(localStorage.getItem('flowtask_xp') || '0');
    let level = parseInt(localStorage.getItem('flowtask_level') || '1');
    let achievements = JSON.parse(localStorage.getItem('flowtask_achievements') || '[]');

    // Habits
    let habitLog = JSON.parse(localStorage.getItem('flowtask_habits') || '{}');

    // Streak
    let streakData = JSON.parse(localStorage.getItem('flowtask_streak') || '{"count":0,"lastDate":""}');

    // Multi-User Profile
    let profiles = JSON.parse(localStorage.getItem('flowtask_profiles') || '[]');
    let activeProfileId = localStorage.getItem('flowtask_active_profile') || null;
    let userProfile = loadActiveProfile();

    function loadActiveProfile() {
        if (activeProfileId) {
            const found = profiles.find(p => p.id === activeProfileId);
            if (found) return found;
        }
        // Migrate old single profile if it exists
        const legacy = JSON.parse(localStorage.getItem('flowtask_profile') || 'null');
        if (legacy && legacy.name !== 'Guest') {
            legacy.id = legacy.id || Date.now().toString(36);
            profiles.push(legacy);
            activeProfileId = legacy.id;
            saveProfilesData();
            return legacy;
        }
        // Default guest
        return { id: 'guest', name: 'Guest', avatar: null };
    }
    function saveProfilesData() {
        localStorage.setItem('flowtask_profiles', JSON.stringify(profiles));
        localStorage.setItem('flowtask_active_profile', activeProfileId || '');
    }

    // Focus
    let focusTimer = null;
    let focusSeconds = 25 * 60;
    let focusRunning = false;
    let focusTotalSeconds = 25 * 60;

    // Voice
    let recognition = null;
    let isListening = false;

    // Audio context for ambient sounds
    let audioCtx = null;
    let currentAudio = null;

    // Geolocation watch
    let geoWatchId = null;

    // Advanced Audio context for girl voice Pitch Shifter (Web Audio API)
    let pitchCtx = null;

    // Expose to window for features.js
    window.FT = {
        $, $$, tasks, xp, level, achievements, habitLog, streakData, theme,
        currentFilter, currentView, calendarDate,
        saveTasks, renderTasks, updateStats, addXP, showReward, launchConfetti,
        escapeHtml, formatTime, toggleTask, deleteTask, editTask, enterFocusMode,
        getFilteredTasks
    };

    // ===================== INIT =====================
    function init() {
        autoTheme();
        updateProfileDisplay();
        updateDate();
        renderTasks();
        updateStats();
        updateGamification();
        updateStreak();
        initParticles();
        initProgressGradient();
        bindEvents();
        initVoice();
        initGeofence();
        setInterval(updateDate, 60000);
    }

    // ===================== THEME =====================
    function autoTheme() {
        if (theme === 'auto') {
            const hour = new Date().getHours();
            const auto = (hour >= 6 && hour < 18) ? 'light' : 'dark';
            applyTheme(auto);
        } else {
            applyTheme(theme);
        }
    }

    function applyTheme(t) {
        document.documentElement.setAttribute('data-theme', t);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const newTheme = current === 'dark' ? 'light' : 'dark';
        theme = newTheme;
        localStorage.setItem('flowtask_theme', newTheme);
        applyTheme(newTheme);
        initParticles();
    }

    // ===================== DATE =====================
    function updateDate() {
        const now = new Date();
        dateDisplay.textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        updateGreetingTime();
    }

    // ===================== PROFILE =====================
    function updateGreetingTime() {
        const hour = new Date().getHours();
        let greeting = 'Good evening,';
        if (hour >= 5 && hour < 12) greeting = 'Good morning,';
        else if (hour >= 12 && hour < 18) greeting = 'Good afternoon,';
        greetingTime.textContent = greeting;
    }

    function updateProfileDisplay() {
        userNameDisplay.textContent = userProfile.name || 'Guest';
        if (userProfile.avatar) {
            displayAvatarImg.src = userProfile.avatar;
            displayAvatarImg.style.display = 'block';
            displayAvatarFallback.style.display = 'none';
        } else {
            displayAvatarImg.style.display = 'none';
            displayAvatarFallback.style.display = 'flex';
            displayAvatarFallback.textContent = (userProfile.name || 'G').charAt(0).toUpperCase();
        }
    }

    function openProfileModal() {
        profileNameInput.value = userProfile.name !== 'Guest' ? userProfile.name : '';
        if (userProfile.avatar) {
            editAvatarImg.src = userProfile.avatar;
            editAvatarImg.style.display = 'block';
            editAvatarFallback.style.display = 'none';
        } else {
            editAvatarImg.style.display = 'none';
            editAvatarFallback.style.display = 'flex';
            editAvatarFallback.textContent = (userProfile.name || 'G').charAt(0).toUpperCase();
        }
        renderProfileList();
        profileModal.classList.add('visible');
    }

    function renderProfileList() {
        let container = $('#profileListContainer');
        if (!container) return;
        container.innerHTML = '';
        if (profiles.length > 0) {
            profiles.forEach(p => {
                const isActive = p.id === activeProfileId;
                const chip = document.createElement('button');
                chip.className = 'profile-chip' + (isActive ? ' active' : '');
                chip.innerHTML = `<span class="profile-chip-avatar">${p.avatar ? '<img src="'+p.avatar+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' : p.name.charAt(0).toUpperCase()}</span><span>${p.name}</span>`;
                chip.addEventListener('click', () => { switchProfile(p.id); });
                container.appendChild(chip);
            });
        }
        const addNew = document.createElement('button');
        addNew.className = 'profile-chip add-new';
        addNew.innerHTML = '<span class="profile-chip-avatar">+</span><span>New</span>';
        addNew.addEventListener('click', () => { createNewProfile(); });
        container.appendChild(addNew);
    }

    function switchProfile(id) {
        const found = profiles.find(p => p.id === id);
        if (!found) return;
        // Save current user's tasks
        if (activeProfileId) {
            localStorage.setItem('flowtask_tasks_' + activeProfileId, JSON.stringify(tasks));
        }
        activeProfileId = id;
        userProfile = found;
        saveProfilesData();
        // Load this user's tasks
        tasks = JSON.parse(localStorage.getItem('flowtask_tasks_' + id) || '[]');
        saveTasks();
        renderTasks();
        updateStats();
        updateProfileDisplay();
        profileNameInput.value = userProfile.name !== 'Guest' ? userProfile.name : '';
        if (userProfile.avatar) {
            editAvatarImg.src = userProfile.avatar;
            editAvatarImg.style.display = 'block';
            editAvatarFallback.style.display = 'none';
        } else {
            editAvatarImg.style.display = 'none';
            editAvatarFallback.style.display = 'flex';
            editAvatarFallback.textContent = (userProfile.name || 'G').charAt(0).toUpperCase();
        }
        renderProfileList();
    }

    function createNewProfile() {
        const newP = { id: Date.now().toString(36), name: 'User ' + (profiles.length + 1), avatar: null };
        profiles.push(newP);
        switchProfile(newP.id);
        profileNameInput.value = '';
        profileNameInput.focus();
    }

    function saveProfile() {
        const name = profileNameInput.value.trim();
        userProfile.name = name || 'Guest';
        // Update in profiles array
        const idx = profiles.findIndex(p => p.id === userProfile.id);
        if (idx > -1) {
            profiles[idx] = { ...userProfile };
        } else {
            userProfile.id = userProfile.id || Date.now().toString(36);
            profiles.push({ ...userProfile });
            activeProfileId = userProfile.id;
        }
        saveProfilesData();
        updateProfileDisplay();
        renderProfileList();
        profileModal.classList.remove('visible');
    }

    function handleAvatarUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 150;
                let width = img.width, height = img.height;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                userProfile.avatar = dataUrl;
                editAvatarImg.src = dataUrl;
                editAvatarImg.style.display = 'block';
                editAvatarFallback.style.display = 'none';
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ===================== PROGRESS GRADIENT =====================
    function initProgressGradient() {
        const svg = document.querySelector('.progress-ring');
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
        grad.setAttribute('id', 'progressGradient');
        grad.setAttribute('x1', '0%'); grad.setAttribute('y1', '0%');
        grad.setAttribute('x2', '100%'); grad.setAttribute('y2', '100%');
        const s1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s1.setAttribute('offset', '0%'); s1.setAttribute('stop-color', '#a78bfa');
        const s2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
        s2.setAttribute('offset', '100%'); s2.setAttribute('stop-color', '#f472b6');
        grad.appendChild(s1); grad.appendChild(s2); defs.appendChild(grad);
        svg.insertBefore(defs, svg.firstChild);
    }

    // ===================== TASKS =====================
    function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function addTask(text) {
        let taskText = text || taskInput.value.trim();
        if (!taskText && !vnPendingAudioData) { shakeElement(taskInput.parentElement); return; }
        if (!taskText && vnPendingAudioData) taskText = '🎤 Voice Note';
        const dayPicker = $('#taskDayPicker');
        const pickedDay = dayPicker ? dayPicker.value : 'auto';
        let assignedDay = null;
        if (pickedDay === 'all') assignedDay = 'all';
        else if (pickedDay !== 'auto') assignedDay = parseInt(pickedDay);
        const task = {
            id: generateId(), text: taskText, completed: false, priority: currentPriority,
            createdAt: new Date().toISOString(), isHabit: isRepeat,
            location: taskLocation, music: taskMusic, streak: 0, lastCompleted: '',
            audioData: vnPendingAudioData, audioEffect: vnPendingEffect,
            assignedDay: assignedDay
        };
        tasks.unshift(task);
        saveTasks();
        if (!text) taskInput.value = '';
        renderTasks(); updateStats();
        addXP(10, 'Task created');
        // Reset toggles
        isRepeat = false; taskLocation = null; taskMusic = 'none';
        vnPendingAudioData = null; vnPendingEffect = 'normal';
        $('#repeatBtn').classList.remove('active');
        $('#locationBtn').classList.remove('active');
        $('#musicBtn').classList.remove('active');
        voiceNoteBtn.classList.remove('active');
        currentPriority = 'normal';
        priorityBtns.forEach(b => b.classList.toggle('active', b.dataset.priority === 'normal'));
        if (dayPicker) dayPicker.value = 'auto';
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        task.completed = !task.completed;
        const el = taskList.querySelector(`[data-id="${id}"]`);
        if (el && task.completed) {
            el.classList.add('completing');
            launchConfetti();
            addXP(25, 'Task completed');
            // Habit streak
            if (task.isHabit) {
                const today = new Date().toISOString().slice(0, 10);
                if (!habitLog[id]) habitLog[id] = [];
                if (!habitLog[id].includes(today)) { habitLog[id].push(today); task.streak = calcStreak(habitLog[id]); }
                localStorage.setItem('flowtask_habits', JSON.stringify(habitLog));
            }
            updateStreak();
            setTimeout(() => el.classList.remove('completing'), 600);
        }
        saveTasks();
        setTimeout(() => { renderTasks(); updateStats(); }, task.completed ? 300 : 0);
    }

    function deleteTask(id) {
        const el = taskList.querySelector(`[data-id="${id}"]`);
        if (el) { el.classList.add('removing'); setTimeout(() => { tasks = tasks.filter(t => t.id !== id); saveTasks(); renderTasks(); updateStats(); }, 500); }
    }

    function editTask(id) {
        const task = tasks.find(t => t.id === id); if (!task) return;
        const el = taskList.querySelector(`[data-id="${id}"]`); if (!el) return;
        el.classList.add('editing');
        const content = el.querySelector('.task-content'), textEl = content.querySelector('.task-text');
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'task-edit-input'; input.value = task.text; input.maxLength = 120;
        content.insertBefore(input, textEl); input.focus(); input.select();
        function saveEdit() {
            const v = input.value.trim();
            if (v && v !== task.text) { task.text = v; saveTasks(); }
            el.classList.remove('editing'); input.remove(); textEl.textContent = task.text;
        }
        input.addEventListener('keydown', e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') { el.classList.remove('editing'); input.remove(); } });
        input.addEventListener('blur', saveEdit);
    }

    function clearCompletedTasks() {
        const els = taskList.querySelectorAll('.task-item.completed');
        if (!els.length) return;
        els.forEach((el, i) => setTimeout(() => el.classList.add('removing'), i * 60));
        setTimeout(() => { tasks = tasks.filter(t => !t.completed); saveTasks(); renderTasks(); updateStats(); }, els.length * 60 + 500);
    }

    function saveTasks() { localStorage.setItem('flowtask_tasks', JSON.stringify(tasks)); window.FT.tasks = tasks; }

    // ===================== RENDER =====================
    function getFilteredTasks() {
        let filtered = tasks;
        if (currentFilter === 'active') filtered = filtered.filter(t => !t.completed);
        else if (currentFilter === 'completed') filtered = filtered.filter(t => t.completed);
        if (daySort !== 'all') {
            const dayNum = parseInt(daySort);
            filtered = filtered.filter(t => {
                if (t.assignedDay === 'all') return true;
                if (t.assignedDay !== null && t.assignedDay !== undefined) return t.assignedDay === dayNum;
                return new Date(t.createdAt).getDay() === dayNum;
            });
        }
        return filtered;
    }

    function renderTasks() {
        const filtered = getFilteredTasks();
        taskList.innerHTML = '';
        emptyState.classList.toggle('visible', filtered.length === 0);
        filtered.forEach((task, i) => taskList.appendChild(createTaskElement(task, i)));
        // Update other views
        if (currentView === 'calendar') renderCalendar();
        if (currentView === 'habits') renderHabits();
    }

    function createTaskElement(task, index) {
        const li = document.createElement('li');
        li.className = `task-item${task.completed ? ' completed' : ''}`;
        li.dataset.id = task.id; li.dataset.priority = task.priority;
        li.style.animationDelay = `${index * 0.04}s`; li.draggable = true;
        const timeStr = formatTime(task.createdAt);
        let badges = '';
        if (task.isHabit) badges += `<span class="task-badge habit">↻ Habit</span>`;
        if (task.location) badges += `<span class="task-badge location">📍 ${escapeHtml(task.location.name || 'Location')}</span>`;
        if (task.music && task.music !== 'none') badges += `<span class="task-badge music">🎵 ${task.music}</span>`;
        if (task.isHabit && task.streak > 0) badges += `<span class="task-badge streak-badge">🔥${task.streak}</span>`;
        const dayNames = ['☀️Sun','🌙Mon','🔥Tue','💧Wed','⚡Thu','🌟Fri','🌊Sat'];
        if (task.assignedDay === 'all') badges += `<span class="task-badge habit">♾️ Daily</span>`;
        else if (task.assignedDay !== null && task.assignedDay !== undefined) badges += `<span class="task-badge">${dayNames[task.assignedDay]}</span>`;
        
        let audioPlayerHtml = '';
        if (task.audioData) {
            audioPlayerHtml = `<div class="task-audio-player"><button class="inline-play-btn" title="Play Voice Note"></button><div class="audio-waveform-mini"></div><span class="audio-effect-badge">${task.audioEffect}</span></div>`;
        }

        li.innerHTML = `
            <div class="drag-handle" title="Drag to reorder"><span></span><span></span><span></span></div>
            <button class="task-checkbox" aria-label="Toggle task">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
            <div class="task-content">
                <p class="task-text">${escapeHtml(task.text)}</p>
                <div class="task-meta"><span class="task-time">${timeStr}</span>${badges}</div>
                ${audioPlayerHtml}
            </div>
            <div class="task-actions">
                <button class="task-action-btn focus-task-btn" title="Focus on this task"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></button>
                <button class="task-action-btn edit-btn" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="task-action-btn delete-btn" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>`;
        li.querySelector('.task-checkbox').addEventListener('click', () => toggleTask(task.id));
        li.querySelector('.edit-btn').addEventListener('click', () => editTask(task.id));
        li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));
        li.querySelector('.focus-task-btn').addEventListener('click', () => enterFocusMode(task));
        
        if (task.audioData) {
            const playBtn = li.querySelector('.inline-play-btn');
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (playBtn.classList.contains('playing')) stopVoiceNotePlayback(playBtn);
                else playVoiceNote(task.audioData, task.audioEffect, playBtn);
            });
        }

        li.addEventListener('dragstart', handleDragStart); li.addEventListener('dragover', handleDragOver);
        li.addEventListener('dragenter', handleDragEnter); li.addEventListener('dragleave', handleDragLeave);
        li.addEventListener('drop', handleDrop); li.addEventListener('dragend', handleDragEnd);
        return li;
    }

    function formatTime(isoStr) {
        const d = new Date(isoStr), now = new Date(), diff = now - d;
        const min = Math.floor(diff/60000), hr = Math.floor(diff/3600000), day = Math.floor(diff/86400000);
        if (min < 1) return 'Just now'; if (min < 60) return `${min}m ago`;
        if (hr < 24) return `${hr}h ago`; if (day < 7) return `${day}d ago`;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

    // ===================== STATS =====================
    function updateStats() {
        const total = tasks.length, done = tasks.filter(t => t.completed).length;
        const pending = total - done, percent = total === 0 ? 0 : Math.round((done / total) * 100);
        animateValue(completedCount, parseInt(completedCount.textContent) || 0, done, 500);
        animateValue(pendingCount, parseInt(pendingCount.textContent) || 0, pending, 500);
        const circ = 2 * Math.PI * 60;
        progressRing.style.strokeDashoffset = circ - (percent / 100) * circ;
        animateValue(progressPercent, parseInt(progressPercent.textContent) || 0, percent, 800);
        if (total === 0) { progressTitle.textContent = 'Ready to start!'; progressSubtitle.textContent = 'Add your first task to get going'; }
        else if (percent === 100) { progressTitle.textContent = '🎉 All done!'; progressSubtitle.textContent = 'Incredible! You finished everything'; }
        else if (percent >= 75) { progressTitle.textContent = 'Almost there!'; progressSubtitle.textContent = `Just ${pending} left to go`; }
        else if (percent >= 50) { progressTitle.textContent = 'Halfway!'; progressSubtitle.textContent = `${done} down, ${pending} to go`; }
        else if (percent > 0) { progressTitle.textContent = 'Great start!'; progressSubtitle.textContent = `${done} of ${total} completed`; }
        else { progressTitle.textContent = `${total} task${total > 1 ? 's' : ''} to conquer`; progressSubtitle.textContent = 'Check off your first task!'; }
        // Check achievements
        checkAchievements(done, total);
    }

    function animateValue(el, start, end, dur) {
        if (start === end) return; const range = end - start, t0 = performance.now();
        function step(t) { const p = Math.min((t - t0) / dur, 1); el.textContent = Math.round(start + range * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); }
        requestAnimationFrame(step);
    }

    // ===================== GAMIFICATION =====================
    function addXP(amount, reason) {
        xp += amount;
        const xpNeeded = level * 100;
        if (xp >= xpNeeded) { xp -= xpNeeded; level++; showLevelUp(); }
        localStorage.setItem('flowtask_xp', xp);
        localStorage.setItem('flowtask_level', level);
        updateGamification();
        showXPPopup(amount);
    }

    function updateGamification() {
        const xpNeeded = level * 100;
        $('#xpCount').textContent = xp;
        $('#levelNum').textContent = level;
        $('#xpBarFill').style.width = `${(xp / xpNeeded) * 100}%`;
        $('#xpBarLabel').textContent = `${xp} / ${xpNeeded} XP`;
        const titles = ['Novice Tasker','Task Apprentice','Focused Worker','Productivity Pro','Task Master','Grand Master','Legendary','Mythical'];
        $('#levelTitle').textContent = titles[Math.min(level - 1, titles.length - 1)];
    }

    function showLevelUp() {
        const toast = $('#levelUpToast');
        $('#levelUpText').textContent = `You reached Level ${level}!`;
        toast.classList.add('visible');
        launchConfetti();
        setTimeout(() => toast.classList.remove('visible'), 3500);
    }

    function showXPPopup(amount) {
        const popup = $('#xpPopup');
        popup.textContent = `+${amount} XP`;
        popup.style.left = `${Math.random() * 60 + 20}%`;
        popup.style.top = '40%';
        popup.classList.remove('visible');
        void popup.offsetHeight;
        popup.classList.add('visible');
        setTimeout(() => popup.classList.remove('visible'), 1300);
    }

    function showReward(icon, title, text) {
        const t = $('#rewardToast');
        $('#rewardIcon').textContent = icon; $('#rewardTitle').textContent = title; $('#rewardText').textContent = text;
        t.classList.add('visible');
        setTimeout(() => t.classList.remove('visible'), 4000);
    }

    function checkAchievements(done, total) {
        const checks = [
            { id: 'first', cond: done >= 1, icon: '🌟', title: 'First Step!', text: 'Completed your first task' },
            { id: 'five', cond: done >= 5, icon: '🏅', title: 'High Five!', text: 'Completed 5 tasks' },
            { id: 'ten', cond: done >= 10, icon: '💎', title: 'Diamond Worker!', text: 'Completed 10 tasks' },
            { id: 'twentyfive', cond: done >= 25, icon: '👑', title: 'Task Royalty!', text: 'Completed 25 tasks' },
            { id: 'allclear', cond: total > 0 && done === total, icon: '🎯', title: 'Perfect Clear!', text: 'All tasks completed' }
        ];
        checks.forEach(c => {
            if (c.cond && !achievements.includes(c.id)) {
                achievements.push(c.id);
                localStorage.setItem('flowtask_achievements', JSON.stringify(achievements));
                addXP(50, 'Achievement');
                setTimeout(() => showReward(c.icon, c.title, c.text), 800);
            }
        });
    }

    // ===================== STREAK =====================
    function updateStreak() {
        const today = new Date().toISOString().slice(0, 10);
        const completed = tasks.filter(t => t.completed);
        if (completed.length > 0) {
            if (streakData.lastDate === today) { /* already counted */ }
            else {
                const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
                streakData.count = streakData.lastDate === yesterday ? streakData.count + 1 : 1;
                streakData.lastDate = today;
            }
        }
        localStorage.setItem('flowtask_streak', JSON.stringify(streakData));
        $('#streakCount').textContent = streakData.count;
    }

    function calcStreak(dates) {
        if (!dates.length) return 0;
        const sorted = [...dates].sort().reverse();
        let streak = 1, prev = new Date(sorted[0]);
        for (let i = 1; i < sorted.length; i++) {
            const d = new Date(sorted[i]), diff = (prev - d) / 86400000;
            if (Math.abs(diff - 1) < 0.5) { streak++; prev = d; } else break;
        }
        return streak;
    }

    // ===================== EVENTS =====================
    function bindEvents() {
        // Profile
        $('#openProfileBtn').addEventListener('click', openProfileModal);
        $('#profileCancelBtn').addEventListener('click', () => profileModal.classList.remove('visible'));
        $('#profileSaveBtn').addEventListener('click', saveProfile);
        $('#uploadAvatarBtn').addEventListener('click', () => $('#avatarFileInput').click());
        $('#avatarFileInput').addEventListener('change', handleAvatarUpload);
        profileNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveProfile(); });

        // Voice Note Recorder
        voiceNoteBtn.addEventListener('click', () => { resetVoiceNote(); voiceNoteModal.classList.add('visible'); });
        voiceNoteCancelBtn.addEventListener('click', () => { resetVoiceNote(); voiceNoteModal.classList.remove('visible'); });
        startRecordBtn.addEventListener('click', startVoiceNote);
        resetRecordBtn.addEventListener('click', resetVoiceNote);
        playPreviewBtn.addEventListener('click', () => {
            if (playPreviewBtn.classList.contains('playing')) stopVoiceNotePlayback(playPreviewBtn);
            else playVoiceNote(vnPendingAudioData, vnPendingEffect, playPreviewBtn);
        });
        effectBtns.forEach(btn => btn.addEventListener('click', () => {
            effectBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
            vnPendingEffect = btn.dataset.effect;
            if (playPreviewBtn.classList.contains('playing')) stopVoiceNotePlayback(playPreviewBtn); 
        }));
        voiceNoteAttachBtn.addEventListener('click', () => {
            voiceNoteModal.classList.remove('visible');
            voiceNoteBtn.classList.add('active');
            taskInput.focus();
        });

        addBtn.addEventListener('click', () => addTask());
        taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
        themeToggle.addEventListener('click', toggleTheme);
        clearCompleted.addEventListener('click', clearCompletedTasks);
        filterTabs.forEach(tab => tab.addEventListener('click', () => {
            filterTabs.forEach(t => t.classList.remove('active')); tab.classList.add('active');
            currentFilter = tab.dataset.filter; renderTasks();
        }));
        priorityBtns.forEach(btn => btn.addEventListener('click', () => {
            priorityBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
            currentPriority = btn.dataset.priority;
        }));
        // Repeat toggle
        $('#repeatBtn').addEventListener('click', () => { isRepeat = !isRepeat; $('#repeatBtn').classList.toggle('active', isRepeat); });
        // Location
        $('#locationBtn').addEventListener('click', () => $('#locationModal').classList.add('visible'));
        $('#locationCancelBtn').addEventListener('click', () => $('#locationModal').classList.remove('visible'));
        $('#locationSaveBtn').addEventListener('click', () => {
            const name = $('#locationName').value.trim();
            if (name) { taskLocation = { name, lat: taskLocation?.lat, lng: taskLocation?.lng }; $('#locationBtn').classList.add('active'); }
            $('#locationModal').classList.remove('visible');
        });
        $('#getLocationBtn').addEventListener('click', () => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(pos => {
                    taskLocation = { ...taskLocation, lat: pos.coords.latitude, lng: pos.coords.longitude };
                    $('#coordsText').textContent = `📍 ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
                }, () => $('#coordsText').textContent = '⚠ Location denied');
            }
        });
        // Music
        $('#musicBtn').addEventListener('click', () => $('#musicModal').classList.add('visible'));
        $('#musicCancelBtn').addEventListener('click', () => $('#musicModal').classList.remove('visible'));
        $$('.music-option').forEach(btn => btn.addEventListener('click', () => {
            $$('.music-option').forEach(b => b.classList.remove('active')); btn.classList.add('active');
        }));
        $('#musicSaveBtn').addEventListener('click', () => {
            const sel = document.querySelector('.music-option.active');
            taskMusic = sel ? sel.dataset.music : 'none';
            if (taskMusic !== 'none') $('#musicBtn').classList.add('active');
            $('#musicModal').classList.remove('visible');
        });
        // View tabs
        $$('.view-tab').forEach(tab => tab.addEventListener('click', () => {
            $$('.view-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
            currentView = tab.dataset.view;
            $$('.view-panel').forEach(p => p.classList.remove('active'));
            $(`#${currentView}View`).classList.add('active');
            if (currentView === 'calendar') renderCalendar();
            if (currentView === 'habits') renderHabits();
        }));
        // Command palette
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
            if (e.key === 'Escape') closeCommandPalette();
        });
        $('#cmdOverlay').addEventListener('click', e => { if (e.target === $('#cmdOverlay')) closeCommandPalette(); });
        $('#cmdInput').addEventListener('input', () => filterCommands($('#cmdInput').value));
        // Focus mode
        $('#focusBtn').addEventListener('click', () => enterFocusMode(null));
        $('#focusStartBtn').addEventListener('click', startFocus);
        $('#focusPauseBtn').addEventListener('click', pauseFocus);
        $('#focusExitBtn').addEventListener('click', exitFocus);
        timeShortcuts.forEach(btn => btn.addEventListener('click', () => {
            if (focusRunning) return;
            timeShortcuts.forEach(b => b.classList.remove('active'));
            customTimeBtn.classList.remove('active');
            btn.classList.add('active');
            setFocusTime(parseInt(btn.dataset.time));
        }));
        customTimeBtn.addEventListener('click', () => {
            if (focusRunning) return;
            const val = parseInt(customFocusTime.value);
            if (val > 0 && val <= 180) {
                timeShortcuts.forEach(b => b.classList.remove('active'));
                customTimeBtn.classList.add('active');
                setFocusTime(val);
            }
        });
        customFocusTime.addEventListener('keydown', e => { if (e.key === 'Enter') customTimeBtn.click(); });
        $$('.music-choice').forEach(b => b.addEventListener('click', () => {
            $$('.music-choice').forEach(c => c.classList.remove('active')); b.classList.add('active');
            playAmbientSound(b.dataset.sound);
        }));
        // Voice
        $('#voiceBtn').addEventListener('click', toggleVoice);
        // Day sort
        $$('.day-sort-tab').forEach(tab => tab.addEventListener('click', () => {
            $$('.day-sort-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active');
            daySort = tab.dataset.day;
            renderTasks();
        }));
        // PDF
        $('#exportPdfBtn').addEventListener('click', exportPDF);
        // Calendar nav
        $('#calPrev').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() - 1); renderCalendar(); });
        $('#calNext').addEventListener('click', () => { calendarDate.setMonth(calendarDate.getMonth() + 1); renderCalendar(); });
    }

    // ===================== DRAG & DROP =====================
    function handleDragStart(e) { draggedItem = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; }
    function handleDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
    function handleDragEnter(e) { e.preventDefault(); this.classList.add('drag-over'); }
    function handleDragLeave() { this.classList.remove('drag-over'); }
    function handleDrop(e) {
        e.preventDefault(); this.classList.remove('drag-over');
        if (draggedItem !== this) {
            const fi = tasks.findIndex(t => t.id === draggedItem.dataset.id);
            const ti = tasks.findIndex(t => t.id === this.dataset.id);
            if (fi > -1 && ti > -1) { const [m] = tasks.splice(fi, 1); tasks.splice(ti, 0, m); saveTasks(); renderTasks(); }
        }
    }
    function handleDragEnd() { this.classList.remove('dragging'); $$('.task-item').forEach(i => i.classList.remove('drag-over')); }

    // ===================== ANIMATIONS =====================
    function shakeElement(el) {
        el.style.animation = 'none'; void el.offsetHeight;
        el.style.animation = 'shake 0.4s ease-in-out';
        setTimeout(() => el.style.animation = '', 400);
        if (!$('#shakeStyle')) {
            const s = document.createElement('style'); s.id = 'shakeStyle';
            s.textContent = `@keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }`;
            document.head.appendChild(s);
        }
    }

    function launchConfetti() {
        const ctx = confettiCanvas.getContext('2d');
        confettiCanvas.width = window.innerWidth; confettiCanvas.height = window.innerHeight;
        const colors = ['#a78bfa','#f472b6','#818cf8','#34d399','#fbbf24','#38bdf8','#fb923c'];
        const particles = [];
        for (let i = 0; i < 50; i++) particles.push({ x: Math.random()*confettiCanvas.width, y: confettiCanvas.height+20, vx:(Math.random()-.5)*8, vy:-(Math.random()*14+8), g:.3, color:colors[Math.floor(Math.random()*colors.length)], size:Math.random()*7+3, rot:Math.random()*360, rs:(Math.random()-.5)*10, op:1, type:Math.random()>.5?'r':'c' });
        let frame = 0;
        (function anim() {
            if (frame > 100) { ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height); return; }
            ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
            particles.forEach(p => { p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.rs; p.op=Math.max(0,1-frame/100); ctx.save(); ctx.globalAlpha=p.op; ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180); ctx.fillStyle=p.color; if(p.type==='r')ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*.6); else{ctx.beginPath();ctx.arc(0,0,p.size/2,0,Math.PI*2);ctx.fill();} ctx.restore(); });
            frame++; requestAnimationFrame(anim);
        })();
    }

    // ===================== PARTICLES =====================
    function initParticles() {
        const ctx = particleCanvas.getContext('2d'); let pts = [], aid;
        function resize() { particleCanvas.width = window.innerWidth; particleCanvas.height = window.innerHeight; }
        resize(); window.addEventListener('resize', resize);
        const cnt = Math.min(40, Math.floor((window.innerWidth*window.innerHeight)/30000));
        for (let i = 0; i < cnt; i++) pts.push({ x:Math.random()*particleCanvas.width, y:Math.random()*particleCanvas.height, vx:(Math.random()-.5)*.3, vy:(Math.random()-.5)*.3, size:Math.random()*2+.5, op:Math.random()*.3+.05 });
        const getColor = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'rgba(124,58,237,' : 'rgba(167,139,250,';
        if (aid) cancelAnimationFrame(aid);
        (function anim() {
            ctx.clearRect(0,0,particleCanvas.width,particleCanvas.height); const c = getColor();
            pts.forEach((p,i) => { p.x+=p.vx; p.y+=p.vy; if(p.x<0)p.x=particleCanvas.width; if(p.x>particleCanvas.width)p.x=0; if(p.y<0)p.y=particleCanvas.height; if(p.y>particleCanvas.height)p.y=0; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fillStyle=`${c}${p.op})`; ctx.fill();
                for(let j=i+1;j<pts.length;j++){const q=pts[j],dx=p.x-q.x,dy=p.y-q.y,d=Math.sqrt(dx*dx+dy*dy);if(d<120){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.strokeStyle=`${c}${(1-d/120)*.08})`;ctx.lineWidth=.5;ctx.stroke();}}
            });
            aid = requestAnimationFrame(anim);
        })();
    }

    // ===================== VOICE CONTROL =====================
    function initVoice() {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { 
            $('#voiceBtn').title = 'Voice not supported in this browser'; 
            showReward('❌', 'Not Supported', 'Voice commands require Chrome/Edge');
            return false; 
        }
        recognition = new SR(); 
        recognition.continuous = false; 
        recognition.interimResults = false; 
        recognition.lang = navigator.language || 'en-US';
        recognition.onresult = e => {
            const transcript = e.results[0][0].transcript.toLowerCase().trim();
            if (transcript.startsWith('add task') || transcript.startsWith('add ')) {
                const text = transcript.replace(/^add\s*task[:\s]*/i, '').replace(/^add\s*/i, '');
                if (text) addTask(text.charAt(0).toUpperCase() + text.slice(1));
            } else if (transcript.startsWith('complete') || transcript.startsWith('finish') || transcript.startsWith('done')) {
                const name = transcript.replace(/^(complete|finish|done)\s*task[:\s]*/i, '').replace(/^(complete|finish|done)\s*/i, '');
                const found = tasks.find(t => !t.completed && t.text.toLowerCase().includes(name));
                if (found) toggleTask(found.id);
            } else if (transcript.includes('focus')) { enterFocusMode(null); }
            else if (transcript.includes('dark') || transcript.includes('night')) { theme = 'dark'; applyTheme('dark'); localStorage.setItem('flowtask_theme','dark'); }
            else if (transcript.includes('light') || transcript.includes('day')) { theme = 'light'; applyTheme('light'); localStorage.setItem('flowtask_theme','light'); }
            else { addTask(transcript.charAt(0).toUpperCase() + transcript.slice(1)); }
            stopVoice();
        };
        recognition.onerror = (e) => {
            console.error('Speech recognition error:', e.error);
            if (e.error === 'not-allowed') showReward('🎤', 'Mic Blocked', 'Allow microphone access in browser settings');
            else if (e.error === 'network') showReward('📶', 'Network Error', 'Voice recognition requires an internet connection');
            else showReward('⚠', 'Voice Error', 'Could not hear you clearly');
            stopVoice();
        };
        recognition.onend = () => stopVoice();
        return true;
    }

    function toggleVoice() { isListening ? stopVoice() : startVoice(); }
    function startVoice() {
        if (!recognition) { 
            const success = initVoice(); 
            if (!success || !recognition) return; 
        }
        try { 
            recognition.start(); 
            isListening = true;
            $('#voiceBtn').classList.add('listening');
            const ind = $('#voiceIndicator');
            if (ind) ind.classList.add('visible');
        } catch(e) { 
            console.error('Failed to start voice:', e);
            showReward('⚠', 'Voice Error', 'Could not start voice recognition. You may need HTTPS.');
            stopVoice();
        }
    }
    function stopVoice() {
        if (!recognition) return;
        try { recognition.stop(); } catch(e) {}
        isListening = false;
        $('#voiceBtn').classList.remove('listening');
        const ind = $('#voiceIndicator');
        if (ind) ind.classList.remove('visible');
    }

    // ===================== COMMAND PALETTE =====================
    const commands = [
        { icon: '➕', label: 'Add a new task', action: () => { closeCommandPalette(); taskInput.focus(); }, shortcut: '' },
        { icon: '🎯', label: 'Enter Focus Mode', action: () => { closeCommandPalette(); enterFocusMode(null); }, shortcut: '' },
        { icon: '🎙️', label: 'Voice Command', action: () => { closeCommandPalette(); toggleVoice(); }, shortcut: '' },
        { icon: '🌙', label: 'Toggle Dark/Light Theme', action: () => { closeCommandPalette(); toggleTheme(); }, shortcut: 'Ctrl+,' },
        { icon: '📅', label: 'Calendar View', action: () => { closeCommandPalette(); switchView('calendar'); }, shortcut: '' },
        { icon: '🧬', label: 'Habits View', action: () => { closeCommandPalette(); switchView('habits'); }, shortcut: '' },
        { icon: '📋', label: 'List View', action: () => { closeCommandPalette(); switchView('list'); }, shortcut: '' },
        { icon: '🧾', label: 'Export as PDF', action: () => { closeCommandPalette(); exportPDF(); }, shortcut: '' },
        { icon: '🗑️', label: 'Clear Completed Tasks', action: () => { closeCommandPalette(); clearCompletedTasks(); }, shortcut: '' },
        { icon: '☰', label: 'Show All Tasks', action: () => { closeCommandPalette(); setFilter('all'); }, shortcut: '' },
        { icon: '◉', label: 'Show Active Tasks', action: () => { closeCommandPalette(); setFilter('active'); }, shortcut: '' },
        { icon: '✓', label: 'Show Completed Tasks', action: () => { closeCommandPalette(); setFilter('completed'); }, shortcut: '' },
    ];

    function openCommandPalette() { $('#cmdOverlay').classList.add('visible'); $('#cmdInput').value = ''; filterCommands(''); $('#cmdInput').focus(); }
    function closeCommandPalette() { $('#cmdOverlay').classList.remove('visible'); }
    function filterCommands(query) {
        const list = $('#cmdResults'); list.innerHTML = '';
        const q = query.toLowerCase();
        const filtered = commands.filter(c => c.label.toLowerCase().includes(q));
        filtered.forEach((c, i) => {
            const li = document.createElement('li'); li.className = `cmd-result${i === 0 ? ' selected' : ''}`;
            li.innerHTML = `<span class="cmd-result-icon">${c.icon}</span><span class="cmd-result-text">${c.label}</span>${c.shortcut ? `<span class="cmd-result-shortcut">${c.shortcut}</span>` : ''}`;
            li.addEventListener('click', c.action);
            list.appendChild(li);
        });
    }
    function switchView(v) {
        $$('.view-tab').forEach(t => { t.classList.toggle('active', t.dataset.view === v); });
        currentView = v; $$('.view-panel').forEach(p => p.classList.remove('active'));
        $(`#${v}View`).classList.add('active');
        if (v === 'calendar') renderCalendar();
        if (v === 'habits') renderHabits();
    }
    function setFilter(f) {
        currentFilter = f; filterTabs.forEach(t => t.classList.toggle('active', t.dataset.filter === f));
        renderTasks();
    }

    // ===================== FOCUS MODE =====================
    function enterFocusMode(task) {
        $('#focusOverlay').classList.add('visible');
        $('#focusTaskName').textContent = task ? task.text : 'General Focus Session';
        focusSeconds = 25 * 60; focusTotalSeconds = focusSeconds; focusRunning = false;
        // Reset shortcut buttons
        timeShortcuts.forEach(b => b.classList.toggle('active', b.dataset.time === '25'));
        if (customTimeBtn) customTimeBtn.classList.remove('active');
        if (customFocusTime) customFocusTime.value = '';
        updateFocusDisplay();
        $('#focusStartBtn').style.display = ''; $('#focusPauseBtn').style.display = 'none';
        $('#focusStartBtn').textContent = '▶ Start';
        if (task && task.music && task.music !== 'none') {
            $$('.music-choice').forEach(b => b.classList.toggle('active', b.dataset.sound === task.music));
        }
    }
    function setFocusTime(minutes) {
        if (focusRunning) return;
        focusSeconds = minutes * 60;
        focusTotalSeconds = focusSeconds;
        updateFocusDisplay();
    }
    function startFocus() {
        focusRunning = true;
        $('#focusStartBtn').style.display = 'none'; $('#focusPauseBtn').style.display = '';
        const totalMin = Math.round(focusTotalSeconds / 60);
        focusTimer = setInterval(() => {
            if (focusSeconds <= 0) { clearInterval(focusTimer); focusRunning = false; addXP(50, 'Focus session'); launchConfetti(); showReward('🧠', 'Focus Complete!', totalMin + ' min session done'); return; }
            focusSeconds--; updateFocusDisplay();
        }, 1000);
    }
    function pauseFocus() { clearInterval(focusTimer); focusRunning = false; $('#focusStartBtn').style.display = ''; $('#focusPauseBtn').style.display = 'none'; $('#focusStartBtn').textContent = '▶ Resume'; }
    function exitFocus() { clearInterval(focusTimer); focusRunning = false; stopAmbient(); $('#focusOverlay').classList.remove('visible'); $('#focusStartBtn').textContent = '▶ Start'; }
    function updateFocusDisplay() {
        const m = Math.floor(focusSeconds/60), s = focusSeconds%60;
        $('#focusTimeDisplay').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        const circ = 2 * Math.PI * 100, pct = focusSeconds / focusTotalSeconds;
        $('#focusRing').setAttribute('stroke-dasharray', circ);
        $('#focusRing').setAttribute('stroke-dashoffset', circ * (1 - pct));
    }

    // ===================== AMBIENT SOUND =====================
    function playAmbientSound(type) {
        stopAmbient();
        if (type === 'none') return;
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            // Generate simple ambient noise procedurally
            const dur = 4, sr = audioCtx.sampleRate, buf = audioCtx.createBuffer(2, dur * sr, sr);
            for (let ch = 0; ch < 2; ch++) {
                const data = buf.getChannelData(ch);
                for (let i = 0; i < data.length; i++) {
                    let v = (Math.random() * 2 - 1) * 0.15;
                    if (type === 'rain') v *= (1 + Math.sin(i / sr * 8) * 0.3);
                    else if (type === 'nature') v *= (1 + Math.sin(i / sr * 2) * 0.5) * 0.7;
                    else if (type === 'cafe') v *= 0.4 * (1 + Math.sin(i / sr * 12) * 0.2);
                    else if (type === 'fire') v *= 0.5 * (1 + Math.sin(i / sr * 4) * 0.4);
                    else if (type === 'lofi') {
                        const freq = [261.6, 329.6, 392, 523.2][Math.floor(i / sr / 0.5) % 4];
                        v = Math.sin(2 * Math.PI * freq * i / sr) * 0.08 + v * 0.06;
                    }
                    data[i] = v;
                }
            }
            const src = audioCtx.createBufferSource();
            src.buffer = buf; src.loop = true;
            const gain = audioCtx.createGain(); gain.gain.value = 0.5;
            // Low-pass filter for smoother sound
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = type === 'lofi' ? 800 : 2000;
            src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
            src.start(); currentAudio = { src, gain };
        } catch (e) { console.warn('Audio error:', e); }
    }
    function stopAmbient() { if (currentAudio) { try { currentAudio.src.stop(); } catch(e){} currentAudio = null; } }

    // ===================== CALENDAR =====================
    function renderCalendar() {
        const grid = $('#calendarGrid'); grid.innerHTML = '';
        const y = calendarDate.getFullYear(), m = calendarDate.getMonth();
        $('#calMonth').textContent = new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
        days.forEach(d => { const h = document.createElement('div'); h.className = 'cal-day-header'; h.textContent = d; grid.appendChild(h); });
        const first = new Date(y, m, 1).getDay(), daysInMonth = new Date(y, m + 1, 0).getDate();
        const prevDays = new Date(y, m, 0).getDate();
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        // Previous month filler
        for (let i = first - 1; i >= 0; i--) { const d = document.createElement('div'); d.className = 'cal-day other-month'; d.textContent = prevDays - i; grid.appendChild(d); }
        // Current month
        for (let day = 1; day <= daysInMonth; day++) {
            const d = document.createElement('div'); d.className = 'cal-day';
            const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            if (dateStr === todayStr) d.classList.add('today');
            const dayTasks = tasks.filter(t => {
                const tDate = new Date(t.createdAt);
                return tDate.getFullYear() === y && tDate.getMonth() === m && tDate.getDate() === day;
            });
            if (dayTasks.length > 0) {
                d.classList.add('has-tasks');
                d.title = dayTasks.length + ' task' + (dayTasks.length > 1 ? 's' : '');
            }
            d.textContent = day;
            // Click to filter by this day's tasks
            d.addEventListener('click', () => {
                const dayOfWeek = new Date(y, m, day).getDay();
                $$('.day-sort-tab').forEach(t => t.classList.toggle('active', t.dataset.day === String(dayOfWeek)));
                daySort = String(dayOfWeek);
                switchView('list');
                renderTasks();
            });
            grid.appendChild(d);
        }
        // Fill rest
        const totalCells = first + daysInMonth, remaining = 42 - totalCells;
        for (let i = 1; i <= remaining; i++) { const d = document.createElement('div'); d.className = 'cal-day other-month'; d.textContent = i; grid.appendChild(d); }
    }

    // ===================== HABITS =====================
    function renderHabits() {
        const container = $('#habitsContainer'); container.innerHTML = '';
        const habits = tasks.filter(t => t.isHabit);
        if (habits.length === 0) {
            container.innerHTML = `<div class="habits-empty"><span class="habits-empty-icon">🧬</span><h3>No habits yet</h3><p>Toggle ↻ when adding a task to create a daily habit</p></div>`;
            return;
        }
        const dayNames = ['S','M','T','W','T','F','S'];
        habits.forEach(task => {
            const card = document.createElement('div'); card.className = 'habit-card';
            const log = habitLog[task.id] || [];
            const streak = calcStreak(log);
            let weekHtml = '';
            for (let i = 6; i >= 0; i--) {
                const d = new Date(Date.now() - i * 86400000);
                const dateStr = d.toISOString().slice(0, 10);
                const done = log.includes(dateStr);
                const isToday = i === 0;
                weekHtml += `<div class="habit-day${done ? ' done' : ''}${isToday ? ' today' : ''}">${dayNames[d.getDay()]}</div>`;
            }
            card.innerHTML = `<div class="habit-header"><span class="habit-name">${escapeHtml(task.text)}</span><span class="habit-streak">🔥 ${streak}</span></div><div class="habit-week">${weekHtml}</div>`;
            container.appendChild(card);
        });
    }

    // ===================== VOICE NOTE RECORDER & PLAYBACK =====================
    async function startVoiceNote() {
        if (vnRecorder && vnRecorder.state === 'recording') { vnRecorder.stop(); return; }
        try {
            vnStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            vnRecorder = new MediaRecorder(vnStream);
            vnChunks = [];
            vnRecorder.ondataavailable = e => { if (e.data.size > 0) vnChunks.push(e.data); };
            vnRecorder.onstop = () => {
                const blob = new Blob(vnChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    vnPendingAudioData = reader.result;
                    startRecordBtn.style.display = 'none';
                    playPreviewBtn.style.display = '';
                    resetRecordBtn.style.display = '';
                    voiceEffects.style.opacity = '1';
                    voiceEffects.style.pointerEvents = 'auto';
                    voiceNoteAttachBtn.disabled = false;
                };
                clearInterval(vnRecordTimer);
                if (vnStream) vnStream.getTracks().forEach(t => t.stop());
                startRecordBtn.classList.remove('recording');
                cancelAnimationFrame(vnVisualizerId);
                const cvs = voiceVisualizer; const ctx = cvs.getContext('2d');
                ctx.clearRect(0,0,cvs.width,cvs.height);
                ctx.fillStyle = '#a78bfa'; ctx.fillRect(0, cvs.height/2 - 1, cvs.width, 2);
            };
            
            vnRecorder.start(100);
            startRecordBtn.classList.add('recording');
            vnRecordSeconds = 0; recordTimer.textContent = '00:00';
            vnRecordTimer = setInterval(() => {
                vnRecordSeconds++;
                const m = Math.floor(vnRecordSeconds/60); const s = vnRecordSeconds%60;
                recordTimer.textContent = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
                if (vnRecordSeconds >= 30) vnRecorder.stop();
            }, 1000);
            
            if (!vnAudioCtx) vnAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (vnAudioCtx.state === 'suspended') await vnAudioCtx.resume();
            const source = vnAudioCtx.createMediaStreamSource(vnStream);
            vnAnalyser = vnAudioCtx.createAnalyser();
            vnAnalyser.fftSize = 256;
            source.connect(vnAnalyser);
            drawVisualizer();
            
        } catch (e) {
            alert('Microphone access denied or not available.');
            console.error(e);
        }
    }

    function drawVisualizer() {
        if (!vnAnalyser) return;
        const cvs = voiceVisualizer; const ctx = cvs.getContext('2d');
        const bufferLength = vnAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function draw() {
            if (vnRecorder && vnRecorder.state === 'recording') vnVisualizerId = requestAnimationFrame(draw);
            else return;
            vnAnalyser.getByteFrequencyData(dataArray);
            ctx.clearRect(0, 0, cvs.width, cvs.height);
            const barWidth = (cvs.width / bufferLength) * 2.5;
            let x = 0;
            for(let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2;
                const r = barHeight + Math.floor(25 * (i/bufferLength));
                const g = 139; const b = 250;
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, cvs.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        }
        draw();
    }

    function resetVoiceNote() {
        if (vnRecorder && vnRecorder.state === 'recording') vnRecorder.stop();
        if (vnStream) vnStream.getTracks().forEach(t => t.stop());
        stopVoiceNotePlayback();
        vnPendingAudioData = null; vnPendingEffect = 'normal';
        startRecordBtn.style.display = '';
        playPreviewBtn.style.display = 'none';
        resetRecordBtn.style.display = 'none';
        voiceEffects.style.opacity = '0.4';
        voiceEffects.style.pointerEvents = 'none';
        voiceNoteAttachBtn.disabled = true;
        effectBtns.forEach(b => b.classList.toggle('active', b.dataset.effect === 'normal'));
        recordTimer.textContent = '00:00';
        const ctx = voiceVisualizer.getContext('2d');
        ctx.clearRect(0,0,voiceVisualizer.width,voiceVisualizer.height);
        ctx.fillStyle = '#a78bfa'; ctx.fillRect(0, voiceVisualizer.height/2 - 1, voiceVisualizer.width, 2);
    }

    async function playVoiceNote(base64Data, effect, btnEl) {
        if (!vnAudioCtx) vnAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (vnAudioCtx.state === 'suspended') await vnAudioCtx.resume();
        stopVoiceNotePlayback(btnEl); 
        
        try {
            const raw = window.atob(base64Data.split(',')[1]);
            const rawLength = raw.length;
            const arrayBuffer = new Uint8Array(new ArrayBuffer(rawLength));
            for(let i = 0; i < rawLength; i++) arrayBuffer[i] = raw.charCodeAt(i);
            const audioBuffer = await vnAudioCtx.decodeAudioData(arrayBuffer.buffer);
            
            const source = vnAudioCtx.createBufferSource();
            source.buffer = audioBuffer;
            
            let lastNode = source;
            let extraOscillator = null;
            
            if (effect === 'helium') {
                source.playbackRate.value = 1.6;
            } else if (effect === 'monster') {
                source.playbackRate.value = 0.65;
            } else if (effect === 'robot') {
                const osc = vnAudioCtx.createOscillator();
                osc.type = 'sawtooth'; osc.frequency.value = 50;
                const gain = vnAudioCtx.createGain();
                gain.gain.value = 0;
                osc.connect(gain.gain);
                lastNode.connect(gain);
                lastNode = gain;
                extraOscillator = osc;
            } else if (effect === 'cave') {
                const delay = vnAudioCtx.createDelay();
                delay.delayTime.value = 0.3;
                const feedback = vnAudioCtx.createGain();
                feedback.gain.value = 0.4;
                delay.connect(feedback); feedback.connect(delay);
                lastNode.connect(delay);
                delay.connect(vnAudioCtx.destination); 
            } else if (effect === 'radio') {
                const bp = vnAudioCtx.createBiquadFilter();
                bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 3;
                lastNode.connect(bp); lastNode = bp;
            } else if (effect === 'female') {
                // Girl voice: Realistic formant shift
                source.playbackRate.value = 1.35; // Pitch up
                // 1. High-pass to remove male chest resonance
                const hp = vnAudioCtx.createBiquadFilter();
                hp.type = 'highpass'; hp.frequency.value = 250;
                // 2. Peaking filter to boost female formants
                const pk1 = vnAudioCtx.createBiquadFilter();
                pk1.type = 'peaking'; pk1.frequency.value = 3200; pk1.Q.value = 1.5; pk1.gain.value = 8;
                // 3. High-shelf for breathiness/air
                const hs = vnAudioCtx.createBiquadFilter();
                hs.type = 'highshelf'; hs.frequency.value = 6000; hs.gain.value = 6;
                // 4. Low-pass to curb harshness
                const lp = vnAudioCtx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 10000;
                
                lastNode.connect(hp); hp.connect(pk1); pk1.connect(hs); hs.connect(lp); lastNode = lp;
            } else if (effect === 'male') {
                // Boy voice: Deeper pitch + bass boost
                source.playbackRate.value = 0.72;
                const lowShelf = vnAudioCtx.createBiquadFilter();
                lowShelf.type = 'lowshelf'; lowShelf.frequency.value = 200; lowShelf.gain.value = 8;
                const pk = vnAudioCtx.createBiquadFilter();
                pk.type = 'peaking'; pk.frequency.value = 2500; pk.Q.value = 1.5; pk.gain.value = -4; // Cut nasal
                lastNode.connect(lowShelf); lowShelf.connect(pk); lastNode = pk;
            }
            
            lastNode.connect(vnAudioCtx.destination);
            if (extraOscillator) extraOscillator.start(0);
            source.start(0);
            
            btnEl.classList.add('playing');
            vnCurrentlyPlayingSource = source;
            vnCurrentlyPlayingBtn = btnEl;
            
            source.onended = () => {
                if (extraOscillator) { try{extraOscillator.stop();}catch(e){} }
                btnEl.classList.remove('playing');
                if (vnCurrentlyPlayingSource === source) vnCurrentlyPlayingSource = null;
            };
        } catch (e) { console.error('Audio play error:', e); btnEl.classList.remove('playing'); }
    }

    function stopVoiceNotePlayback(btnEl) {
        if (vnCurrentlyPlayingSource) {
            try { vnCurrentlyPlayingSource.stop(); } catch(e){}
            vnCurrentlyPlayingSource = null;
        }
        if (vnCurrentlyPlayingBtn) vnCurrentlyPlayingBtn.classList.remove('playing');
        if (btnEl) btnEl.classList.remove('playing');
        $$('.inline-play-btn.playing, .play-preview-btn.playing').forEach(b => b.classList.remove('playing'));
    }

    // ===================== GEOFENCE =====================
    function initGeofence() {
        if (!navigator.geolocation) return;
        const locTasks = tasks.filter(t => t.location && t.location.lat && !t.completed);
        if (locTasks.length === 0) return;
        if (geoWatchId) navigator.geolocation.clearWatch(geoWatchId);
        geoWatchId = navigator.geolocation.watchPosition(pos => {
            locTasks.forEach(task => {
                const dist = haversine(pos.coords.latitude, pos.coords.longitude, task.location.lat, task.location.lng);
                if (dist < 200) { // 200 meters
                    showReward('📍', 'Location Reminder!', `You're near: ${task.text}`);
                }
            });
        }, null, { enableHighAccuracy: false, maximumAge: 30000, timeout: 10000 });
    }
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    // ===================== PDF EXPORT =====================
    function exportPDF() {
        const win = window.open('', '_blank');
        const styles = `body{font-family:Arial,sans-serif;padding:40px;color:#1e1b4b}h1{color:#7c3aed;margin-bottom:4px}h2{color:#6b7280;font-size:14px;font-weight:400;margin-bottom:24px}.task{padding:10px 0;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}.dot{width:8px;height:8px;border-radius:50%}.normal{background:#818cf8}.important{background:#fbbf24}.urgent{background:#f87171}.done{text-decoration:line-through;color:#9ca3af}.badge{font-size:11px;padding:2px 8px;border-radius:100px;background:#f5f3ff;color:#7c3aed;margin-left:8px}`;
        const taskHtml = tasks.map(t => `<div class="task"><span class="dot ${t.priority}"></span><span class="${t.completed ? 'done' : ''}">${escapeHtml(t.text)}</span>${t.isHabit ? '<span class="badge">Habit</span>' : ''}${t.location ? '<span class="badge">📍</span>' : ''}</div>`).join('');
        const done = tasks.filter(t=>t.completed).length;
        win.document.write(`<!DOCTYPE html><html><head><title>FlowTask Export</title><style>${styles}</style></head><body><h1>📋 FlowTask</h1><h2>${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})} — ${done}/${tasks.length} completed</h2>${taskHtml}<script>setTimeout(()=>{window.print()},500)<\/script></body></html>`);
        win.document.close();
    }

    // ===================== START =====================
    init();
})();
