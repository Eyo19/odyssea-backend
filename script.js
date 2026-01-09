        let GLOBAL_TAROT_DATA = null; 
        const STORAGE_KEY = 'odyssea_saves_v16_final_polished';
        
        let sessionList = [];
        let currentSessionId = null;
        let gameState = { unlockedLevel: 1, currentLevel: 1, name: "", globalSubject: "", histories: {}, chapterData: {} };
        let tempTasks = [];

        const videoEl = document.getElementById('avatar-video');
        const audioEl = document.getElementById('tts-player');
        const statusDot = document.getElementById('api-status');
        const lightningBtn = document.getElementById('lightning-btn');
        let currentAudioBtn = null; 

        window.onload = async function() {
            try {
                const response = await fetch('tarot_data.json');
                if (!response.ok) throw new Error(`Status: ${response.status}`);
                GLOBAL_TAROT_DATA = await response.json();
                loadSessionList(); renderHub();
            } catch (e) { alert("Erreur chargement JSON. Lancez 'netlify dev'."); }
        };

        videoEl.addEventListener('ended', () => { updateVidBtn(false); });

        // --- SESSIONS ---
        function loadSessionList() {
            const raw = localStorage.getItem(STORAGE_KEY);
            sessionList = raw ? JSON.parse(raw) : [];
        }
        function saveAllSessions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionList)); }
        function saveCurrentState() { 
            if (!currentSessionId) return; 
            const idx = sessionList.findIndex(s => s.id === currentSessionId); 
            if (idx !== -1) { sessionList[idx] = gameState; saveAllSessions(); } 
        }

        function deleteSession(id) {
            if(confirm("Êtes-vous sûr de vouloir supprimer définitivement cette aventure ?")) {
                sessionList = sessionList.filter(s => s.id !== id);
                saveAllSessions();
                renderHub();
            }
        }

        function exportData() {
            const dataStr = JSON.stringify(sessionList, null, 2);
            const blob = new Blob([dataStr], {type: "application/json"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `odyssea_backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        }

        function generatePDFReport() {
            if(!gameState) return;
            const container = document.createElement('div');
            container.style.width = '800px'; container.style.padding = '40px'; container.style.fontFamily = "'Lato', sans-serif"; container.style.color = '#333'; container.style.background = '#fff';
            let htmlContent = `<div style="text-align:center; border-bottom:2px solid #d4af37; padding-bottom:20px; margin-bottom:30px;"><h1 style="font-family:'Cinzel', serif; color:#050511; font-size:2.5rem; margin:0;">${gameState.name}</h1><p style="color:#666; font-size:1rem; margin-top:10px;">Rapport de Projet Odyssea • ${new Date().toLocaleDateString()}</p></div>`;
            if(gameState.globalSubject) htmlContent += `<div style="background:#f9f9f9; border-left:5px solid #d4af37; padding:20px; margin-bottom:30px;"><h2 style="font-family:'Cinzel', serif; color:#d4af37; margin-top:0;">L'Idée Globale</h2><p style="font-size:1.1rem; line-height:1.6;">${gameState.globalSubject}</p></div>`;
            for(let i = 1; i <= 22; i++) {
                const data = gameState.chapterData[i];
                if(data && (data.summary || (data.tasks && data.tasks.length > 0))) {
                    const card = getCardData(i);
                    htmlContent += `<div style="margin-bottom:30px; page-break-inside: avoid;"><h3 style="font-family:'Cinzel', serif; color:#050511; border-bottom:1px solid #eee; padding-bottom:5px;">${toRoman(i)}. ${card.NOM.toUpperCase()}</h3>${data.summary ? `<p style="line-height:1.5; color:#444; margin-bottom:15px;">${data.summary.replace(/\n/g, '<br>')}</p>` : ''}`;
                    if(data.tasks && data.tasks.length > 0) {
                        htmlContent += `<ul style="list-style:none; padding:0;">`;
                        data.tasks.forEach(t => { htmlContent += `<li style="padding:5px 0; color:${t.done ? '#006400' : '#333'}; font-family:monospace; font-size:1rem;">${t.done ? '☑' : '☐'} ${t.text}</li>`; });
                        htmlContent += `</ul>`;
                    }
                    htmlContent += `</div>`;
                }
            }
            container.innerHTML = htmlContent;
            html2pdf().set({ margin: 0.5, filename: `Rapport_${gameState.name.replace(/\s+/g, '_')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' } }).from(container).save();
        }

        function triggerImport() { document.getElementById('import-file').click(); }
        function handleImport(input) {
            const file = input.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (Array.isArray(data)) {
                        if(confirm("Écraser les parties actuelles ?")) { sessionList = data; saveAllSessions(); renderHub(); alert("Import réussi !"); }
                    } else alert("Fichier invalide.");
                } catch (err) { alert("Erreur lecture."); }
            };
            reader.readAsText(file); input.value = '';
        }

        function renderHub() {
            const listEl = document.getElementById('hub-list'); listEl.innerHTML = '';
            sessionList.forEach(session => {
                const card = document.createElement('div'); card.className = 'hub-card';
                card.onclick = () => loadGame(session.id);
                const delBtn = document.createElement('button');
                delBtn.className = 'delete-card-btn'; delBtn.innerHTML = '×'; delBtn.title = "Supprimer"; delBtn.onclick = (e) => { e.stopPropagation(); deleteSession(session.id); };
                card.innerHTML = `<h3>${session.name}</h3><p>${session.globalSubject ? 'Projet: '+session.globalSubject.substring(0,25)+'...' : 'Étape '+session.currentLevel}</p>`;
                card.appendChild(delBtn); listEl.appendChild(card);
            });
        }

        function createNewGame() {
            const name = prompt("Nom du Projet ?"); if (!name) return;
            const newSession = { id: Date.now(), name: name, unlockedLevel: 1, currentLevel: 1, globalSubject: "", histories: {}, chapterData: {} };
            sessionList.push(newSession); saveAllSessions(); loadGame(newSession.id);
        }

        function loadGame(sessionId) {
            currentSessionId = sessionId; gameState = sessionList.find(s => s.id === sessionId);
            if(!gameState.histories) gameState.histories = {};
            if(!gameState.chapterData) gameState.chapterData = {};
            document.getElementById('screen-hub').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('screen-hub').style.display = 'none';
                document.getElementById('screen-game').style.display = 'grid';
                startLevel(gameState.currentLevel, false); 
            }, 500);
        }

        function goHome() { saveCurrentState(); window.location.reload(); }
        function getCardData(levelId) { return GLOBAL_TAROT_DATA ? GLOBAL_TAROT_DATA.find(c => c.ID == levelId) : null; }

        function renderSidebar() {
            const list = document.getElementById('arcana-list'); list.innerHTML = '';
            if (!GLOBAL_TAROT_DATA) return;
            GLOBAL_TAROT_DATA.forEach((card) => {
                const level = card.ID; const li = document.createElement('li'); li.className = 'nav-item';
                const roman = toRoman(level);
                let taskIndicator = "";
                const data = gameState.chapterData[level];
                if (data && data.tasks && data.tasks.length > 0) {
                    const doneCount = data.tasks.filter(t => t.done).length;
                    const color = (doneCount === data.tasks.length) ? "#00C851" : "#ffbb33";
                    taskIndicator = ` <span style='font-size:0.75rem; color:${color}'>[${doneCount}/${data.tasks.length}]</span>`;
                }
                let content = `<span>${roman}.</span> ${card.NOM}${taskIndicator}`;
                let summaryBtn = (data && (data.summary || (data.tasks && data.tasks.length > 0))) ? `<button class="summary-btn-side" onclick="event.stopPropagation(); openValidationModal('view', ${level})" title="Voir le Grimoire">📜</button>` : "";
                if (level === gameState.currentLevel) { li.classList.add('active'); li.innerHTML = `<div>${content}</div>${summaryBtn}`; }
                else if (level <= gameState.unlockedLevel) { li.classList.add('done'); li.innerHTML = `<div>${content} ✓</div>${summaryBtn}`; li.onclick = () => startLevel(level, true); }
                else { li.classList.add('locked'); li.innerHTML = `<div>${content} 🔒</div>`; }
                list.appendChild(li);
            });
        }

        function startLevel(level, manualSwitch) {
            gameState.currentLevel = level; renderSidebar(); stopChatAudio(); checkLightningStatus();
            videoEl.muted = false; videoEl.volume = 1.0; videoEl.src = `videos/${level}.mp4`; 
            const playPromise = videoEl.play();
            if (playPromise !== undefined) { playPromise.then(_ => { updateVidBtn(true); }).catch(error => { updateVidBtn(false); }); }
            if (!gameState.histories[level]) {
                gameState.histories[level] = []; const card = getCardData(level);
                if (card && card["TEXTE INTRO"]) gameState.histories[level].push({ role: "model", parts: [{ text: card["TEXTE INTRO"] }] });
            }
            renderChat(gameState.histories[level]); renderCardInfo(level); saveCurrentState();
        }

        // --- LOGIQUE BULLES/CHIPS ET COULEURS ---
        function parseKeywords(text) {
            if (!text) return [];
            return text.split('/').map(k => k.trim()).filter(k => k.length > 0);
        }

        function toggleKeyword(level, keyword) {
            if (!gameState.chapterData[level]) gameState.chapterData[level] = {};
            if (!gameState.chapterData[level].selectedKeywords) gameState.chapterData[level].selectedKeywords = [];
            const arr = gameState.chapterData[level].selectedKeywords;
            const idx = arr.indexOf(keyword);
            if (idx > -1) arr.splice(idx, 1); else arr.push(keyword);
            saveCurrentState(); renderCardInfo(level);
        }

        function renderCardInfo(level) {
            const container = document.getElementById('card-portrait'); const card = getCardData(level);
            if (!card) return;
            const selected = (gameState.chapterData[level] && gameState.chapterData[level].selectedKeywords) ? gameState.chapterData[level].selectedKeywords : [];
            const createChips = (sourceText, type) => {
                const keywords = parseKeywords(sourceText);
                return `<div class="chips-container">${keywords.map(k => {
                    const isActive = selected.includes(k);
                    return `<span class="keyword-chip ${type} ${isActive ? 'active' : ''}" onclick="toggleKeyword(${level}, '${k.replace(/'/g, "\\'")}')">${k}</span>`;
                }).join('')}</div>`;
            };
            const mots = card["3 MOTS"] || "";
            const lumiere = createChips((card["Il ou elle est plutôt"] || "") + "/" + (card["Et ça le pousse à"] || ""), 'light');
            const ombre = createChips((card["En difficulté (Excès)"] || "") + "/" + (card["Alors ça le pousse à"] || ""), 'shadow');
            const concepts = createChips(card["Concepts associés"] || "", 'concept'); // Concept en bulles bleues

            container.innerHTML = `
                <div class="info-header">
                    <div class="info-title-row">
                        <img src="cartes/${level}.jpg" class="info-card-img" onerror="this.style.display='none'">
                        <div><div class="info-keywords">${mots}</div><div class="info-instruction">Personnalise ton expérience de l'archétype en choisissant les mots qui te parlent actuellement.</div></div>
                    </div>
                </div>
                <div class="info-block"><span class="info-label" style="color:#00C851;">Lumière (Atouts)</span>${lumiere}</div>
                <div class="info-block"><span class="info-label" style="color:#ff4444;">Ombre (Risques)</span>${ombre}</div>
                <div class="info-block"><span class="info-label" style="color:#33b5e5;">Concepts Clés</span>${concepts}</div>
            `;
        }

        function checkLightningStatus() {
            const history = gameState.histories[gameState.currentLevel] || [];
            const userMsgCount = history.filter(m => m.role === 'user').length;
            if (userMsgCount >= 2) { 
                lightningBtn.classList.add('active'); lightningBtn.title = "Ouvrir le Grimoire"; lightningBtn.onclick = () => openValidationModal('analysis');
            } else {
                lightningBtn.classList.remove('active'); lightningBtn.title = `${2 - userMsgCount} échanges restants`; lightningBtn.onclick = null;
            }
        }

        function formatText(text) { 
            if(!text) return "";
            let t = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            t = t.replace(/(^|[^\*])\*([^\s\*][^\*]*[^\s\*])\*(?!\*)/g, '$1<em>$2</em>');
            return t;
        }
        function cleanIAInput(text) { if(!text) return ""; return text.replace(/^[\*\-]\s*/gm, '').trim(); }

        function renderChat(historyArray) {
            const container = document.getElementById('chat-container'); container.innerHTML = '';
            const safeHistory = historyArray || [];
            safeHistory.forEach((msg, index) => {
                const isAi = msg.role === 'model'; const div = document.createElement('div');
                div.className = isAi ? 'message-row' : 'message-row user';
                const formattedText = formatText(msg.parts[0].text); const rawText = msg.parts[0].text;
                if (isAi) {
                    const msgId = 'msg-' + index;
                    let regenBtn = (index === safeHistory.length - 1) ? `<button class="icon-btn-round" onclick="regenerateLastMessage()" title="Régénérer">↻</button>` : "";
                    div.innerHTML = `<div class="logo-wrapper" style="width:35px; height:35px; border-width:1px; flex-shrink:0;"><img src="logoodyssea.jpeg" class="logo-img"></div><div class="message-bubble ai-bubble">${formattedText.replace(/\n/g, '<br>')}<div class="message-actions"><button id="btn-${msgId}" class="icon-btn-round" data-text="${escapeHtml(rawText)}" onclick="toggleChatAudio('${msgId}')">▶</button><button id="stop-${msgId}" class="stop-chat-btn" style="display:none;" onclick="stopChatAudio()">STOP</button>${regenBtn}</div></div>`;
                } else div.innerHTML = `<div class="message-bubble user-bubble">${formattedText}</div>`;
                container.appendChild(div);
            });
            scrollToBottom();
        }
        function escapeHtml(text) { return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }

        // --- MODALE ---
        async function openValidationModal(mode, targetLevel = null) {
            const modal = document.getElementById('validation-modal');
            const body = document.getElementById('modal-body');
            const title = document.getElementById('modal-title');
            
            const lvl = targetLevel || gameState.currentLevel;
            const card = getCardData(lvl);
            const existingData = gameState.chapterData[lvl] || {};
            tempTasks = existingData.tasks ? JSON.parse(JSON.stringify(existingData.tasks)) : []; 

            if (mode === 'analysis' && (existingData.summary || (existingData.tasks && existingData.tasks.length > 0))) {
                if(!confirm("⚠️ Attention !\n\nGénérer une nouvelle analyse écrasera vos données actuelles (Résumé et Tâches).\nContinuer ?")) return;
                tempTasks = [];
            }

            title.innerText = (mode === 'view') ? `Édition : ${card.NOM}` : `Analyse : ${card.NOM}`;
            document.querySelector('.modal-btn.save').style.display = 'block';
            document.querySelector('.modal-btn.next').style.display = (lvl === gameState.currentLevel) ? 'block' : 'none';
            document.querySelector('.modal-btn.cancel').innerText = "Annuler";
            modal.style.display = 'flex';

            if (mode === 'view') { renderModalForm(lvl, existingData.idea || "", existingData.summary || ""); return; }

            body.innerHTML = '<div style="text-align:center; padding:50px; color:var(--accent-gold);">Consultation du Grimoire...<br>L\'IA extrait les tâches...</div>';
            const history = gameState.histories[lvl];
            
            let validationPrompt = `Tu es l'Archiviste d'un Projet (Odyssea). Analyse l'historique de cette étape.
            INSTRUCTIONS STRICTES :
            1. RÉSUMÉ : Synthétise les échanges et décisions.
            2. TÂCHES : Liste les actions concrètes à faire.
            FORMAT OBLIGATOIRE :
            [RESUME]...[/RESUME]
            [TASKS]
            - Tâche 1
            - Tâche 2
            [/TASKS]
            ${lvl === 1 ? '[IDEE]L\'idée du projet...[/IDEE]' : ''}`;

            try {
                const response = await fetch('/.netlify/functions/api-gemini', { method: 'POST', body: JSON.stringify({ systemPrompt: validationPrompt, message: "Analyse maintenant.", fullHistory: history }) });
                const dataResponse = await response.json(); const reply = dataResponse.reply;
                let suggestedResume = cleanIAInput(extractTag(reply, "RESUME"));
                let suggestedIdea = (lvl === 1) ? cleanIAInput(extractTag(reply, "IDEE")) : "";
                
                let tasksBlock = extractTag(reply, "TASKS");
                if (!tasksBlock) {
                    const rawLines = reply.match(/^[\*\-]\s+(.*)$/gm);
                    if(rawLines) tasksBlock = rawLines.join('\n');
                }

                if (tasksBlock) tasksBlock.split('\n').forEach(line => { const cl = cleanIAInput(line); if(cl) addTaskInternal(cl); });
                renderModalForm(lvl, suggestedIdea, suggestedResume);
            } catch (e) { body.innerHTML = `<div style="color:red">Erreur : ${e.message}</div>`; }
        }

        function addTaskInternal(text) { tempTasks.push({ id: Date.now() + Math.random(), text: text, done: false }); }
        function removeTaskInternal(id) { tempTasks = tempTasks.filter(t => t.id !== id); refreshTaskListUI(); checkNextButtonState(); }
        function toggleTaskInternal(id) { const task = tempTasks.find(t => t.id === id); if(task) task.done = !task.done; refreshTaskListUI(); checkNextButtonState(); }
        function addNewTaskFromInput() { const input = document.getElementById('new-task-input'); if(input && input.value.trim()) { addTaskInternal(input.value.trim()); input.value = ''; refreshTaskListUI(); checkNextButtonState(); } }

        function refreshTaskListUI() {
            const listContainer = document.getElementById('modal-task-list-container'); if(!listContainer) return;
            let html = '';
            if(tempTasks.length === 0) html = '<div style="color:#666; font-style:italic; padding:10px;">Aucune tâche.</div>';
            else {
                tempTasks.forEach(t => {
                    html += `<div class="task-item"><div class="task-left"><input type="checkbox" class="task-checkbox" ${t.done ? 'checked' : ''} onchange="toggleTaskInternal(${t.id})"><span class="task-text ${t.done ? 'done' : ''}">${t.text}</span></div><button class="delete-task-btn" onclick="removeTaskInternal(${t.id})">🗑</button></div>`;
                });
            }
            listContainer.innerHTML = html;
        }

        function checkNextButtonState() {
            const nextBtn = document.getElementById('modal-next-btn'); if(!nextBtn) return;
            const allDone = tempTasks.every(t => t.done);
            if (tempTasks.length > 0 && !allDone) { nextBtn.disabled = true; nextBtn.title = "Terminez les tâches !"; nextBtn.innerText = "Tâches en cours..."; } 
            else { nextBtn.disabled = false; nextBtn.title = ""; nextBtn.innerText = "Valider & Étape Suivante ➔"; }
        }

        function renderModalForm(lvl, idea, resume) {
            const body = document.getElementById('modal-body'); const card = getCardData(lvl);
            let html = "";
            
            if (lvl > 1) {
                html += `<div class="modal-section"><span class="modal-label">Précédemment</span><div class="modal-text-static">`;
                let hasPrev = false;
                for (let i = 1; i < lvl; i++) {
                    const prevCard = getCardData(i); const prevData = gameState.chapterData[i];
                    if (prevData) {
                        hasPrev = true;
                        const safeSummary = formatText(cleanIAInput(prevData.summary || ""));
                        let actionsHtml = "";
                        if(prevData.tasks && prevData.tasks.length > 0) {
                            const doneTasks = prevData.tasks.filter(t => t.done);
                            if(doneTasks.length > 0) {
                                actionsHtml = `<div class="prev-action-list">`;
                                doneTasks.forEach(t => { actionsHtml += `<span class="prev-action-item">✅ ${t.text}</span>`; });
                                actionsHtml += `</div>`;
                            }
                        }
                        html += `<div class="chapter-prev-block"><div class="prev-header"><strong>${toRoman(i)}. ${prevCard.NOM}</strong></div><div class="prev-content">${safeSummary}</div>${actionsHtml}</div>`;
                    }
                }
                if(!hasPrev) html += "Début du projet.";
                html += `</div></div>`;
            }

            if (lvl === 1) html += buildEditableSection("L'Idée / Le Projet", "edit-idea", idea);
            html += `<div class="modal-section"><span class="modal-label">Liste des Tâches (ToDo)</span><div class="task-manager"><div class="task-input-row"><input type="text" id="new-task-input" class="task-input" placeholder="Ajouter une tâche..." onkeypress="if(event.key==='Enter') addNewTaskFromInput()"><button class="add-task-btn" onclick="addNewTaskFromInput()">+</button></div><div id="modal-task-list-container" class="task-list"></div></div></div>`;
            html += buildEditableSection(`Synthèse de l'Étape (${card.NOM})`, "edit-resume", resume);
            body.innerHTML = html; refreshTaskListUI(); checkNextButtonState();
        }

        function buildEditableSection(label, id, content) { return `<div class="modal-section"><label class="modal-label" for="${id}">${label}</label><textarea id="${id}" class="modal-textarea">${(content || "").trim()}</textarea></div>`; }
        function extractTag(text, tag) { const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[/${tag}\\]`, 'i'); const match = text.match(regex); return match ? match[1].trim() : null; }
        function closeModal() { document.getElementById('validation-modal').style.display = 'none'; }

        function saveSummaryData(goNext) {
            const lvl = gameState.currentLevel; const resumeEl = document.getElementById('edit-resume'); const ideaEl = document.getElementById('edit-idea');
            if (!gameState.chapterData[lvl]) gameState.chapterData[lvl] = {};
            gameState.chapterData[lvl].tasks = JSON.parse(JSON.stringify(tempTasks));
            gameState.chapterData[lvl].summary = resumeEl ? resumeEl.value.trim() : "";
            if (lvl === 1 && ideaEl) { gameState.chapterData[lvl].idea = ideaEl.value.trim(); gameState.globalSubject = ideaEl.value.trim(); }
            renderSidebar(); saveCurrentState();
            if (goNext) {
                const nextLvl = lvl + 1; if (nextLvl > gameState.unlockedLevel) gameState.unlockedLevel = nextLvl;
                closeModal(); if (getCardData(nextLvl)) startLevel(nextLvl); else alert("Félicitations !");
                saveCurrentState();
            } else closeModal();
        }

        async function sendMessage() {
            const input = document.getElementById('user-input'); const text = input.value.trim(); if (!text) return;
            input.value = ''; addMessageToDOM(text, 'user');
            gameState.histories[gameState.currentLevel].push({ role: "user", parts: [{ text: text }] });
            saveCurrentState(); checkLightningStatus(); stopChatAudio(); videoEl.pause(); updateVidBtn(false);
            await callGemini();
        }

        async function regenerateLastMessage() {
            const history = gameState.histories[gameState.currentLevel];
            if (history.length > 0 && history[history.length - 1].role === 'model') {
                history.pop(); saveCurrentState(); renderChat(history); await callGemini(" (Reformule)");
            }
        }

        async function callGemini(systemInstructionSuffix = "") {
            setApiStatus('loading'); const indicator = document.getElementById('typing-indicator');
            const lvl = gameState.currentLevel; const card = getCardData(lvl); if (!card) return;
            indicator.innerText = `${card.NOM} réfléchit...`; indicator.style.display = 'block';

            let finalSystemPrompt = card["PROMPT JEU"];
            finalSystemPrompt += `\n\nCONTEXTE : Coach Gestion de Projet Tarot.`;
            if (gameState.globalSubject) finalSystemPrompt += `\nPROJET : "${gameState.globalSubject}".`;
            
            // --- INJECTION MOTS CLES ---
            const currentChapter = gameState.chapterData[lvl];
            if (currentChapter && currentChapter.selectedKeywords && currentChapter.selectedKeywords.length > 0) {
                finalSystemPrompt += `\n\nNOTE IMPORTANTE : Le joueur a personnalisé l'archétype. Il se reconnaît spécifiquement dans ces traits : ${currentChapter.selectedKeywords.join(", ")}. Adapte ton ton et tes conseils en fonction de ces aspects précis.`;
            }

            let historyContext = "";
            for (let i = 1; i < lvl; i++) {
                if (gameState.chapterData[i]) {
                    const cData = gameState.chapterData[i]; const cName = getCardData(i).NOM;
                    const doneTasks = cData.tasks ? cData.tasks.filter(t => t.done).map(t => t.text).join(", ") : "";
                    historyContext += `\n[ÉTAPE ${i} - ${cName}]\nRésumé: ${cData.summary || "N/A"}\nActions faites: ${doneTasks || "Aucune"}`;
                }
            }
            if (historyContext) finalSystemPrompt += `\n\nHISTORIQUE DU PROJET (Ne pas répéter, utilise pour contexte) :${historyContext}`;

            try {
                const history = gameState.histories[lvl]; let lastMsg = "Continue.";
                if (history.length > 0 && history[history.length - 1].role === 'user') lastMsg = history[history.length - 1].parts[0].text + systemInstructionSuffix;
                const response = await fetch('/.netlify/functions/api-gemini', { method: 'POST', body: JSON.stringify({ systemPrompt: finalSystemPrompt, message: lastMsg, fullHistory: history }) });
                const data = await response.json(); indicator.style.display = 'none'; setApiStatus('success');
                if (data.reply) { gameState.histories[lvl].push({ role: "model", parts: [{ text: data.reply }] }); saveCurrentState(); renderChat(gameState.histories[lvl]); }
            } catch (err) { indicator.style.display = 'none'; setApiStatus('error'); }
        }

        function addMessageToDOM(text, type) { renderChat(gameState.histories[gameState.currentLevel]); }
        
        async function toggleChatAudio(btnId) {
            const btn = document.getElementById('btn-' + btnId); if (!btn) return;
            const text = btn.getAttribute('data-text'); const stopBtn = document.getElementById('stop-' + btnId);
            if (currentAudioBtn === btn && !audioEl.paused) { audioEl.pause(); btn.innerHTML = "▶"; btn.classList.remove('playing'); return; }
            videoEl.pause(); updateVidBtn(false);
            if (currentAudioBtn && currentAudioBtn !== btn) { currentAudioBtn.innerHTML = "▶"; currentAudioBtn.classList.remove('playing'); if(currentAudioBtn.nextElementSibling) currentAudioBtn.nextElementSibling.style.display = 'none'; }
            currentAudioBtn = btn; btn.innerHTML = "⏳";
            const card = getCardData(gameState.currentLevel);
            try {
                const response = await fetch('/.netlify/functions/api-voice', { method: 'POST', body: JSON.stringify({ text: text, voiceId: card["ID Voix"] }) });
                const data = await response.json();
                if (data.audioContent) { audioEl.src = "data:audio/mpeg;base64," + data.audioContent; audioEl.play(); btn.innerHTML = "⏸"; btn.classList.add('playing'); stopBtn.style.display = 'block'; audioEl.onended = () => { btn.innerHTML = "▶"; btn.classList.remove('playing'); stopBtn.style.display = 'none'; currentAudioBtn = null; }; }
            } catch (e) { btn.innerHTML = "⚠️"; }
        }

        function stopChatAudio() { audioEl.pause(); audioEl.currentTime = 0; if(currentAudioBtn) { currentAudioBtn.innerHTML = "▶"; currentAudioBtn.classList.remove('playing'); if(currentAudioBtn.nextElementSibling) currentAudioBtn.nextElementSibling.style.display = 'none'; currentAudioBtn = null; } }
        function videoControl(a) { if(a==='toggle'){ if(videoEl.paused){ stopChatAudio(); videoEl.play(); updateVidBtn(true); } else { videoEl.pause(); updateVidBtn(false); } } else if(a==='replay'){ stopChatAudio(); videoEl.currentTime=0; videoEl.play(); updateVidBtn(true); } else if(a==='stop'){ videoEl.pause(); videoEl.currentTime=0; updateVidBtn(false); } }
        function updateVidBtn(playing) { document.getElementById('vid-play-btn').innerHTML = playing ? "⏸" : "▶"; }
        function scrollToBottom() { const c = document.getElementById('chat-container'); c.scrollTop = c.scrollHeight; }
        function handleEnter(e) { if(e.key === 'Enter') sendMessage(); }
        function toRoman(n) { const r=["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI","XXII"]; return r[n]||n; }
        function setApiStatus(s) { statusDot.className = 'api-status-dot ' + s; }
        
            // --- GESTION MENU MOBILE ---
            function toggleMobileMenu() {
                const sidebar = document.querySelector('.sidebar');
                const btn = document.getElementById('mobile-menu-btn');
                
                // On bascule la classe 'active'
                sidebar.classList.toggle('active');
                
                // On change l'icône du bouton (☰ ou ×)
                if (sidebar.classList.contains('active')) {
                    btn.innerHTML = "×"; // Croix pour fermer
                    btn.style.zIndex = "201"; // Passe au-dessus du menu
                } else {
                    btn.innerHTML = "☰"; // Burger pour ouvrir
                    btn.style.zIndex = "100";
                }
            }
            
            // Optionnel : Fermer le menu quand on clique sur un lien de navigation
            // Ajoute ceci pour que le menu se ferme automatiquement après avoir choisi une étape
            document.getElementById('arcana-list').addEventListener('click', (e) => {
                if(window.innerWidth <= 900) {
                    // Si on a cliqué sur un élément de liste ou un bouton
                    if(e.target.closest('.nav-item') || e.target.closest('button')) {
                        toggleMobileMenu(); // On referme
                    }
                }
            });
