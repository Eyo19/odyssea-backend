/**
 * report.js - VERSION "MASTER"
 * - Opacité image : 100% (Rendu HD)
 * - Suppression totale du mode sombre à l'impression
 * - Alignement chirurgical des tâches
 */

function generateSharedPDF(sessionData, tarotData) {
    // 1. SÉCURITÉ DATA
    if (!sessionData) { alert("Aucune donnée à exporter."); return; }
    sessionData.chapterData = sessionData.chapterData || {};
    sessionData.name = sessionData.name || "Projet Sans Nom";
    const safeTarotData = tarotData || [];
    
    const toRoman = (n) => { 
        const r=["","I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII","XIII","XIV","XV","XVI","XVII","XVIII","XIX","XX","XXI","XXII"]; 
        return r[n]||n; 
    };

    // 2. NETTOYAGE
    const old = document.getElementById('printable-area');
    if (old) old.remove();

    // 3. CRÉATION DU CONTENEUR
    const container = document.createElement('div');
    container.id = 'printable-area';
    
    // 4. STYLE "MASTER"
    const styles = `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Lato:wght@300;400;700&display=swap');

        /* --- CONFIGURATION ÉCRAN (Prévisualisation) --- */
        #printable-area {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: #fdfbf7; /* Beige Parchemin */
            z-index: 2147483647; /* Max Z-Index */
            overflow-y: auto;
            color: #1a1a1a;
            font-family: 'Lato', sans-serif;
        }

        /* --- CONFIGURATION IMPRESSION (Le Cœur du système) --- */
        @media print {
            @page { margin: 0; size: auto; }
            
            /* RESET TOTAL DU MODE SOMBRE DU SITE */
            body, html { 
                background-color: #fff !important; 
                background-image: none !important;
                color: #000 !important;
                height: auto !important;
                overflow: visible !important;
            }

            /* On cache tout le site */
            body > *:not(#printable-area) { display: none !important; }

            /* On affiche uniquement le rapport */
            #printable-area {
                position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0;
                display: block !important;
                visibility: visible !important;
                background-color: #fdfbf7 !important; /* Force le fond beige */
                color: #1a1a1a !important;
                overflow: visible !important;
            }
            
            .no-print { display: none !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }

        /* --- PAGE DE GARDE --- */
        .print-cover {
            position: relative;
            width: 100%; height: 100vh;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            text-align: center;
            page-break-after: always;
            overflow: hidden;
            background: #000; /* Fond de sécurité derrière l'image */
        }

        /* Image de fond : OPACITÉ MAXIMALE */
        .cover-bg-img {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            object-fit: cover; z-index: 0; 
            opacity: 1 !important; /* PAS DE TRANSPARENCE */
        }

        .cover-content {
            position: relative; z-index: 10;
            background: rgba(253, 251, 247, 0.95); /* Fond très opaque pour lisibilité */
            padding: 50px;
            border: 4px double #d4af37;
            border-radius: 4px;
            width: 70%;
            box-shadow: 0 0 30px rgba(0,0,0,0.5);
        }

        .print-title { 
            font-family: 'Cinzel', serif; font-size: 3rem; color: #d4af37; 
            margin: 0 0 15px 0; line-height: 1.1; text-transform: uppercase;
            text-shadow: 1px 1px 0 #fff;
        }

        /* --- CONTENU --- */
        .content-wrapper { padding: 40px; max-width: 850px; margin: 0 auto; background: transparent; }

        .print-chapter {
            margin-bottom: 30px; padding-bottom: 20px; 
            border-bottom: 1px dashed #ccc;
            page-break-inside: avoid;
            background: transparent;
        }

        .print-header { 
            display: flex; align-items: center; gap: 20px; 
            margin-bottom: 15px; border-bottom: 2px solid #d4af37; padding-bottom: 10px; 
        }
        
        .print-img { 
            width: 70px; height: auto; border-radius: 4px; 
            border: 1px solid #d4af37;
            background: #fff; /* Évite la transparence noire */
        }
        
        .print-titles h2 { font-family: 'Cinzel', serif; font-size: 1.8rem; color: #d4af37; margin: 0; }
        .print-titles h3 { font-family: 'Cinzel', serif; font-size: 1.1rem; color: #444; margin: 2px 0 0 0; text-transform: uppercase; }

        .print-resume { 
            background: #f0ede6; border-left: 4px solid #d4af37; 
            padding: 15px; font-style: italic; font-size: 0.95rem; 
            line-height: 1.5; margin-bottom: 15px; text-align: justify;
            color: #333;
        }

        /* --- LISTE D'ACTIONS ALIGNÉE --- */
        .print-tasks { 
            background: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 6px; 
        }
        .tasks-label {
            display: block; font-weight: bold; margin-bottom: 15px; 
            color: #d4af37; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px;
            border-bottom: 1px solid #eee; padding-bottom: 5px;
        }
        
        .task-item { 
            display: flex; 
            align-items: flex-start; /* Aligne en haut */
            gap: 15px;
            margin-bottom: 10px; 
        }
        
        /* Case à cocher fixe à gauche */
        .check-box { 
            flex-shrink: 0; /* Empêche le rétrécissement */
            width: 20px; height: 20px;
            border: 1px solid #d4af37; color: #d4af37;
            display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 14px;
            margin-top: 2px;
            background: #fff;
        }
        
        .task-text {
            font-size: 0.95rem; line-height: 1.4; color: #000;
            flex-grow: 1;
        }

        /* BOUTONS (Interface) */
        .action-bar {
            position: fixed; top: 20px; right: 20px; display: flex; gap: 15px; z-index: 2147483648;
        }
        .btn-action {
            padding: 10px 20px; border: none; font-weight: bold; cursor: pointer; border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-family: 'Lato', sans-serif;
            text-transform: uppercase; font-size: 0.8rem;
        }
        .btn-print { background: #d4af37; color: #000; }
        .btn-close { background: #333; color: #fff; }
        .btn-action:hover { transform: translateY(-2px); }

    </style>`;

    // 5. CONSTRUCTION HTML
    let html = styles + `
        <div class="action-bar no-print">
            <button class="btn-action btn-print" onclick="window.print()">🖨️ Imprimer / PDF</button>
            <button class="btn-action btn-close" onclick="document.getElementById('printable-area').remove()">Fermer</button>
        </div>
        
        <div class="print-cover">
            <img src="GardeOdyssea.jpg" class="cover-bg-img" alt="Garde">
            
            <div class="cover-content">
                <h1 class="print-title">${sessionData.name}</h1>
                <div style="letter-spacing:3px; font-size: 1rem; text-transform:uppercase; margin-bottom:10px; color:#555;">Le Grimoire du Projet</div>
                <div style="font-size:0.85rem; color:#777;">Généré le ${new Date().toLocaleDateString()}</div>
            </div>
        </div>

        <div class="content-wrapper">
    `;

    // INTENTION
    if (sessionData.globalSubject) {
        html += `
        <div class="print-chapter" style="text-align:center;">
            <h2 style="font-family:'Cinzel', serif; color:#d4af37; margin-bottom:10px;">L'Intention Initiale</h2>
            <div style="font-size:1.2rem; font-style:italic; color:#222; background:#fff; padding:20px; border-radius:8px; border:1px solid #eee;">
                "${sessionData.globalSubject}"
            </div>
        </div>`;
    }

    // CHAPITRES
    let hasContent = false;
    for (let i = 1; i <= 22; i++) {
        const data = sessionData.chapterData[i];
        if (data && (data.summary || (data.tasks && data.tasks.length > 0))) {
            hasContent = true;
            let cardName = safeTarotData.find(c => c.ID == i)?.NOM || "Étape " + i;

            html += `
            <div class="print-chapter">
                <div class="print-header">
                    <img class="print-img" src="cartes/${i}.jpg" onerror="this.style.display='none'">
                    <div class="print-titles">
                        <h2>${toRoman(i)}</h2>
                        <h3>${cardName}</h3>
                    </div>
                </div>
                
                ${data.summary ? `<div class="print-resume">"${data.summary.replace(/\n/g, '<br>')}"</div>` : ''}
                
                ${(data.tasks && data.tasks.length > 0) ? `
                    <div class="print-tasks">
                        <span class="tasks-label">Plan d'Action Validé</span>
                        ${data.tasks.map(t => `
                            <div class="task-item">
                                <div class="check-box">${t.done ? '✓' : ''}</div>
                                <div class="task-text">${t.text}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>`;
        }
    }

    if (!hasContent) html += `<div class="print-chapter" style="text-align:center;">Aucun contenu validé pour le moment.</div>`;

    html += `</div>`; // Fin wrapper

    container.innerHTML = html;
    document.body.appendChild(container);

    // 6. LANCEMENT AUTO
    setTimeout(() => {
        window.print();
    }, 1000); // 1 seconde pour charger l'image HD
}