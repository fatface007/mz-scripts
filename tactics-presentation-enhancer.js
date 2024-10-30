// ==UserScript==
// @name         MZ Tactics Presentation Enhancer (TPE)
// @namespace    https://github.com/fatface007/mz-scripts
// @version      1.0.0
// @description  Displays players details alongside the tactics field.
// @author       fatface007@protonmail.com
// @match        *://www.managerzone.com/*
// @grant        none
// @license      MIT
// ==/UserScript==

class MZTacticsPresentationEnhancer {
    constructor() {
        this.isOverlayVisible = false;
        this.playersAltViewHtmlTable = {};

        const metaLanguage = document.querySelector('meta[name="language"]')?.getAttribute('content') || 'en';
        this.tpeButtonTxt = metaLanguage === 'pl'
            ? { on: "Pokaż szczegóły taktyki", off: "Ukryj szczegóły taktyki" }
            : { on: "Show Tactics Details", off: "Hide Tactics Details" };

        this.tpeBtn = null;
        this.init();
    }

    async init() {
        if (window.location.href.includes('/?p=tactics')) {
            this.playersAltViewHtmlTable = await this.fetchAltViewPlayersHtmlTable();
            this.createOverlayButton();
            this.detectUrlClickAndRemoveOverlay();
        }
    }

    applyStyles(element, styles) {
        Object.assign(element.style, styles);
    }

    cacheStyle(element, stylesObj) {
        Object.keys(stylesObj).forEach(style => {
            stylesObj[style] = element.style[style];
        });
    }

    restoreStyle(element, stylesObj) {
        Object.keys(stylesObj).forEach(style => {
            element.style[style] = stylesObj[style];
        });
    }

    applyOverlayStyles(reset = false) {
        const elements = {
            tacticStable: document.getElementById("tactic-stable"),
            stripes: document.getElementById("stripes"),
            contentDivBazBazCenter: document.querySelector('#contentDiv .baz.bazCenter'),
            tacticsBox: document.getElementById("tactics_box"),
            contentDiv: document.getElementById("contentDiv"),
        };

        const idsToHide = [
            "rightInfoLayer-wrapper", "tactic-stable-wrapper", "slots-container",
            "gkslot", "subslot1", "subslot2", "subslot3", "subslot4", "subslot5"
        ];

        if (!reset) {

            if (!this.cacheMzStyles) {
                this.cacheMzStyles = {};
                Object.entries(elements).forEach(([key, el]) => {
                    this.cacheMzStyles[key] = {};
                    this.cacheStyle(el, this.cacheMzStyles[key]);
                });
            }
            idsToHide.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.style.visibility = "hidden";
            });

            this.applyStyles(elements.tacticStable, { display: "block", clear: "both" });
            this.applyStyles(elements.stripes, { maxWidth: "100%", width: "100%" });
            elements.contentDivBazBazCenter.style.width = "auto";

        } else {
            Object.entries(elements).forEach(([key, el]) => this.restoreStyle(el, this.cacheMzStyles[key]));
            idsToHide.forEach(id => {
                const element = document.getElementById(id);
                if (element) element.style.visibility = "visible";
            });
            document.getElementById("tactic-stable").style.removeProperty("clear");
            const playersDisplay = document.getElementById("players-display");
            if (playersDisplay) playersDisplay.remove();
        }
    }

    showOverlay() {
        const formation = this.getTacticsFormation();
        const tacticsPlayers = this.parseTacticsPlayers();
        const parsedPlayers = this.parseAltViewPlayersTable(this.playersAltViewHtmlTable, tacticsPlayers);
        this.displayPlayerSkillsInOverlay(parsedPlayers, document, formation, tacticsPlayers);
        document.querySelector("#tacticsDetailsId").textContent = this.tpeButtonTxt.off;
        this.applyOverlayStyles(false);
        this.isOverlayVisible = true;
        this.adjustIfMobile()
    }

    cleanUp() {
        this.applyOverlayStyles(true);
        document.querySelector("#tacticsDetailsId").textContent = this.tpeButtonTxt.on;
        this.isOverlayVisible = false;
    }

    createOverlayButton() {
        this.tpeBtn = document.createElement("button");
        this.tpeBtn.id = "tpeBtn";
        this.tpeBtn.style.border = "0";
        this.tpeBtn.classList.add("mzbtn", "buttondiv", "button_account");
        this.tpeBtn.innerHTML = `<span class="buttonClassMiddle"><span id="tacticsDetailsId" style="white-space: nowrap;">${this.tpeButtonTxt.on}</span></span><span class="buttonClassRight">&nbsp;</span>`;
        document.getElementById("rename_tactics_button")?.after(this.tpeBtn);

        this.tpeBtn.addEventListener("click", () => {
            this.isOverlayVisible ? this.cleanUp() : this.showOverlay();
        });
    }

    detectUrlClickAndRemoveOverlay() {
        document.body.addEventListener("click", (event) => {
            const isTacticsTab = event.target.closest("[id^='tacticTab_']");
            const isSetPlaysActive = document.getElementById('tttb')?.classList.contains('ui-tabs-active')
                && document.getElementById('tttb').classList.contains('ui-state-active');

            if (isTacticsTab && this.isOverlayVisible) {
                this.cleanUp();
                this.showOverlay();
            } else if (isSetPlaysActive) {
                this.cleanUp();
                this.tpeBtn.style.visibility = "hidden";
            } else {
                this.tpeBtn.style.visibility = "visible";
            }
        });
    }

    getTacticsFormation() {
        const fields = ['defs', 'mids', 'atts'];
        return Object.fromEntries(
            fields.map(field => [
                field,
                parseInt(document.querySelector(`#formation_text .${field}`)?.textContent, 10) || null
            ])
        );
    }

    async fetchAltViewPlayersHtmlTable() {
        try {
            const response = await fetch('/?p=players&sub=alt');
            const html = await response.text();
            return new DOMParser().parseFromString(html, 'text/html');
        } catch (error) {
            console.error('Failed to fetch content:', error);
            return null;
        }
    }

    parseTacticsPlayers() {
        const pitchElement = document.getElementById('pitch');
        if (!pitchElement) return { firstPlayers: [], subPlayers: [] };

        return Array.from(pitchElement.querySelectorAll('div[id^="drag_n_"]')).reduce(
            (acc, div) => {
                const playerId = div.id.split('_').pop();
                const shirtNo = parseInt(div.querySelector('#shirt-nr')?.textContent, 10) || null;
                const playerObj = { playerId, shirtNo };

                div.classList.contains('substitute')
                    ? acc.subPlayers.push(playerObj)
                    : acc.firstPlayers.push(playerObj);
                return acc;
            },
            { firstPlayers: [], subPlayers: [] }
        );
    }

    parseAltViewPlayersTable(html, tacticsPlayers) {
        const skillNames = ["Speed", "Stamina", "Play I", "Passing", "Shooting", "Heading", "Keeping", "Ball C", "Tackling", "Aerial P", "Set P", "Experience", "Form"];
        const squadSummary = html.getElementById("squad_summary");
        if (!squadSummary) return console.warn("squad_summary div not found"), [];

        return Array.from(squadSummary.querySelectorAll("#playerAltViewTable tbody tr")).map(row => {
            const shirtNoCell = row.querySelector("td:first-child");
            const playerLink = row.querySelector("td:nth-child(2) a");
            if (!shirtNoCell || !playerLink) return null;

            const playerId = playerLink.href.match(/pid=(\d+)/)?.[1];
            if (!playerId || !tacticsPlayers.firstPlayers.some(p => p.playerId === playerId)) return null;

            const skills = Array.from(row.querySelectorAll("td"))
                .slice(6, 6 + skillNames.length)
                .reduce((acc, cell, i) => {
                    acc[skillNames[i]] = { value: cell.textContent.trim(), maxed: cell.classList.contains("maxed") };
                    return acc;
                }, {});

            return {
                playerId,
                shirtNo: shirtNoCell.textContent.trim(),
                name: playerLink.textContent.trim(),
                skills,
            };
        }).filter(Boolean);
    }

    adjustIfMobile() {
        const playersDisplay = document.getElementById("players-display");
        const tacticsBox = document.getElementById("tactics_box");
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
        if (isMobile) {
            if (tacticsBox) {
                tacticsBox.style.width = "auto";
            }
            if (playersDisplay) {
                playersDisplay.style.removeProperty("float");
            }
        }
    }

    displayPlayerSkillsInOverlay(players, doc, formation, tacticsPlayers) {
        
        this.applyOverlayStyles()

        const pitchWrapper = doc.getElementById("pitch-wrapper");
        const tacticsBox = doc.getElementById("tactics_box");
        if (!pitchWrapper || !tacticsBox) return console.warn("Pitch-wrapper or tactics_box div not found.");

        const skillsDisplay = document.createElement("div");
        skillsDisplay.id = "players-display";
        Object.assign(skillsDisplay.style, { display: "block", float: "left", overflowY: "none", });
        pitchWrapper.parentNode.insertBefore(skillsDisplay, pitchWrapper);

        const table = document.createElement("table");
        Object.assign(table.style, { width: "auto", borderCollapse: "collapse" });

        const sortedElements = players
            .filter(p => tacticsPlayers.firstPlayers.some(fp => fp.playerId === p.playerId))
            .map(player => {
                const shirtNrSpan = Array.from(doc.querySelectorAll("span.shirt-nr"))
                    .find(span => span.textContent.trim() === player.shirtNo);
                if (shirtNrSpan) {
                    const dragElement = shirtNrSpan.closest("div[id^='drag_n_']");
                    const dragRect = dragElement.getBoundingClientRect();
                    return { player, top: dragRect.top, left: dragRect.left };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => a.top - b.top || a.left - b.left);

        const rowConfig = [
            { key: 'atts', count: formation.atts || 0 },
            { key: 'mids', count: formation.mids || 0 },
            { key: 'defs', count: formation.defs || 0 },
            { key: 'others', count: 1 },
        ];

        const maxColumns = Math.max(...rowConfig.map(r => r.count));
        let currentIndex = 0;

        rowConfig.forEach(({ count }) => {
            const row = document.createElement("tr");
            row.style.textAlign = "center";

            const elementsInRow = sortedElements.slice(currentIndex, currentIndex + count);
            currentIndex += count;

            elementsInRow.sort((a, b) => a.left - b.left);

            if (elementsInRow.length < maxColumns) {
                const centeredCell = document.createElement("td");
                centeredCell.colSpan = maxColumns;
                centeredCell.style.textAlign = "center";

                const containerDiv = document.createElement("div");
                containerDiv.style.display = "flex";
                containerDiv.style.justifyContent = "center";

                elementsInRow.forEach(({ player }) => containerDiv.appendChild(this.createSkillContainer(player)));
                centeredCell.appendChild(containerDiv);
                row.appendChild(centeredCell);
            } else {
                elementsInRow.forEach(({ player }) => {
                    const cell = document.createElement("td");
                    cell.style.verticalAlign = "top";
                    cell.appendChild(this.createSkillContainer(player));
                    row.appendChild(cell);
                });
            }

            table.appendChild(row);
        });

        skillsDisplay.appendChild(table);
        tacticsBox.style.width = `${pitchWrapper.offsetWidth + skillsDisplay.scrollWidth + 10}px`;

        const contentDiv = document.getElementById("contentDiv");
        contentDiv.style.maxWidth = "100%";
        let leftMenuWidth = document.getElementById("left-wrapper").firstElementChild.offsetWidth;
        contentDiv.style.width = `${pitchWrapper.offsetWidth + skillsDisplay.offsetWidth + leftMenuWidth}px`;

    }

    createSkillContainer(player) {
        const skillContainer = document.createElement("div");
        Object.assign(skillContainer.style, {
            backgroundColor: "rgba(0, 0, 0, 0.85)", color: "white", padding: "2px", borderRadius: "4px",
            width: "auto", fontSize: "10px", textAlign: "left", margin: "1px"
        });

        const nameContainer = document.createElement("div");
        nameContainer.style.display = "flex";
        nameContainer.style.justifyContent = "space-between";

        const playerName = document.createElement("span");
        playerName.textContent = player.name;
        playerName.style.fontWeight = "bold";

        const shirtNum = document.createElement("span");
        shirtNum.textContent = `No ${player.shirtNo}`;
        shirtNum.style.fontWeight = "bold";

        nameContainer.append(playerName, shirtNum);
        skillContainer.append(nameContainer, this.createSkillTable(player.skills));

        return skillContainer;
    }

    createSkillTable(skills) {
        const skillTable = document.createElement("table");
        skillTable.style.width = "100%";

        Object.entries(skills).forEach(([skill, { value, maxed }]) => {
            const row = document.createElement("tr");
            row.style.lineHeight = "0.8";

            const nameCell = document.createElement("td");
            nameCell.textContent = skill;
            nameCell.style.color = "white";

            const ballsCell = document.createElement("td");
            ballsCell.style.whiteSpace = "nowrap";
            for (let i = 1; i <= 10; i++) {
                const ball = document.createElement("span");
                ball.textContent = "⚽";
                ball.style.fontSize = "8px";
                ball.style.visibility = i <= value ? "visible" : "hidden";
                ballsCell.appendChild(ball);
            }

            const valueCell = document.createElement("td");
            valueCell.textContent = `(${value})`;
            valueCell.style.color = maxed ? "red" : "white";

            row.append(nameCell, ballsCell, valueCell);
            skillTable.appendChild(row);
        });

        return skillTable;
    }

}

new MZTacticsPresentationEnhancer();
