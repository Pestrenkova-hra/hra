// Menu stavů hry
const GameState = {
    MENU: 'menu',
    INFO: 'info',
    PLAYING: 'playing',
    DOTAZNIK: 'dotaznik',
    GAME_OVER: 'gameOver'
};

let gameState = GameState.MENU;

// Setup
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    backgroundColor: '#008000',
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const UI_PANEL_HEIGHT = 50; // Výška horního UI panelu
const MAX_HEALTH = 150; // Maximální množství životů
const HEALTH_LOSS_PER_TICK = 1; // Ubývání života za tick (1 za sekundu)
const MIN_DISTANCE_FROM_CURSOR = 200; // Minimální vzdálenost bodu A od kurzoru
const HEALTH_BAR_MAX_WIDTH = 150; // Maximální šířka ukazatele života

const game = new Phaser.Game(config);

// Třída zástupce
class Zastupce {
    constructor(jmeno, rychlost, typ, frame1, frame2, percepce, unikrychlost) {
        this.jmeno = jmeno;
        this.rychlost = rychlost;
        this.typ = typ;
        this.frame1 = frame1;
        this.frame2 = frame2;
        this.percepce = percepce;
        this.unikrychlost = unikrychlost;
    }
}

// Seznam zástupců
const zastupci = [
    new Zastupce("Test1", 300, 1, 'sprite1_a', 'sprite1_b', 100, 400),
    new Zastupce("TestA", 100, 2, 'sprite2_a', 'sprite2_b', 120, 250),
    new Zastupce("TestX", 200, 1, 'sprite3_a', 'sprite3_b', 150, 350),
    new Zastupce("Test9", 150, 2, 'sprite4_a', 'sprite4_b', 130, 300)
];

class Otazka {
    constructor(ot_text, ot_typ, ot_moznost1, ot_moznost2, ot_moznost3, ot_moznost4) {
        this.ot_text = ot_text;
        this.ot_typ = ot_typ;
        this.ot_moznost1 = ot_moznost1;
        this.ot_moznost2 = ot_moznost2;
        this.ot_moznost3 = ot_moznost3;
        this.ot_moznost4 = ot_moznost4;
    }
}

const otazky = [
    new Otazka("Ohodnoťte na stupnici 1-10 svoje entomologické znalosti", 1),
    new Otazka("Čím jste hru ovládali?", 2, "Myš", "Touchpad", "Dotyková obrazovka", "Trackpoint"),
    new Otazka("Jaká je odpověď na otázku života vesmíru a vůbec?", 1),
    new Otazka("Je otázek už příliš?", 2, "ano", "Ano", "ANO!!!")
];

let shuffledZastupci = [];
let currentZastupceIndex = 0;
let currentOtazkaIndex = 0;
let health = MAX_HEALTH;
let healthBar; // Měřič života
let healthBarBackground; // Šedé pozadí HealthBaru
let birdSprite; // Sprite ptáka
let uiPanel; // Horní panel
let currentSprite = null;
let animationTimer = null;
let tween = null;
let isProcessing = false;
let isEscaping = false;
let escapeVector = null;
let cursorX = config.width / 2;
let cursorY = config.height / 2;
let gameOver = false;
let inputText = "";
let inputBox;
let textDisplay;
let userData = [];

function preload() {
    this.load.image('sprite1_a', 'Test1.png');
    this.load.image('sprite1_b', 'Test2.png');
    this.load.image('sprite2_a', 'TestA.png');
    this.load.image('sprite2_b', 'TestB.png');
    this.load.image('sprite3_a', 'TestX.png');
    this.load.image('sprite3_b', 'TestY.png');
    this.load.image('sprite4_a', 'Test9.png');
    this.load.image('sprite4_b', 'Test8.png');
    this.load.image('ptak', 'ptak.png'); // Načtení sprite ptáka
    this.load.image('nadpis', 'nadpis.png');
    this.load.image('start', 'start.png');
    this.load.image('info', 'info.png');
    this.load.image('zpet', 'zpet.png');
}

function create() {
    if (gameState === GameState.MENU) {
        showMenu.call(this);
    } else if (gameState === GameState.PLAYING) {
        startGame.call(this);
    } else if (gameState === GameState.INFO) {
        showInfo.call(this);
    } else if (gameState === GameState.DOTAZNIK) {
        showDotaznik.call(this);
    } else if (gameState === GameState.GAME_OVER) {
        endGame.call(this);
    }
}

function showMenu() {
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5);
    this.add.image(config.width / 2, config.height / 3 + 30, "nadpis").setOrigin(0.5);
    const buttonStart = this.add.image(config.width / 2, config.height / 2 + 40, "start").setOrigin(0.5);
    const buttonInfo = this.add.image(config.width / 2, config.height / 2 + 130, "info").setOrigin(0.5);
    buttonStart.setInteractive();
    buttonStart.on('pointerdown', () => {
        gameState = GameState.PLAYING;
        this.scene.restart(); // Restartuje hru a přepne na fázi PLAYING
    });
    buttonInfo.setInteractive();
    buttonInfo.on("pointerdown", () => {
        gameState = GameState.INFO;
        this.scene.restart();
    });
}

function showInfo() {
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5);
    this.add.text(400, 300, 'Informace', {fontSize: '32px', fill: '#FFFFFF'}).setOrigin(0.5);
    const buttonZpet = this.add.image(config.width - 50, 50, "zpet").setOrigin(0.5)
    buttonZpet.setInteractive();
    buttonZpet.on("pointerdown", () => {
        gameState = GameState.MENU;
        this.scene.restart();
    });
}

function startGame() {
    // Přidání černého obdélníku jako horního UI panelu
    uiPanel = this.add.rectangle(config.width / 2, UI_PANEL_HEIGHT / 2, config.width, UI_PANEL_HEIGHT, 0x000000);
    uiPanel.setOrigin(0.5, 0.5);

    // Přidání šedého pozadí pod HealthBar
    healthBarBackground = this.add.rectangle(config.width - 10 - HEALTH_BAR_MAX_WIDTH / 2, UI_PANEL_HEIGHT / 2, HEALTH_BAR_MAX_WIDTH, UI_PANEL_HEIGHT - 10, 0x555555);
    healthBarBackground.setOrigin(0.5, 0.5);

    // Přidání měřiče života (bílý obdélník)
    healthBar = this.add.rectangle(config.width - 10 - HEALTH_BAR_MAX_WIDTH / 2, UI_PANEL_HEIGHT / 2, HEALTH_BAR_MAX_WIDTH, UI_PANEL_HEIGHT - 10, 0xFFFFFF);
    healthBar.setOrigin(0.5, 0.5);

    // Přidání sprite ptáka nalevo od HealthBar
    birdSprite = this.add.sprite(config.width - 10 - HEALTH_BAR_MAX_WIDTH - 50, UI_PANEL_HEIGHT / 2, 'ptak');
    birdSprite.setOrigin(0.5, 0.5);
    birdSprite.setScale(0.5); // Zmenšení sprite pro lepší zarovnání

    shuffledZastupci = Phaser.Utils.Array.Shuffle(zastupci);
    this.time.addEvent({
        delay: 1000, // Tick každou sekundu
        callback: () => {
            if (!gameOver) {
                health = Math.max(health - HEALTH_LOSS_PER_TICK, 0);
                updateHealthBar();
                if (health <= 0) {
                    gameState = GameState.DOTAZNIK;
                    this.scene.restart();
                }
            }
        },
        loop: true
    });

    spawnZastupce.call(this);
}

function update() {
    ensureUIOnTop(this);

    if (isEscaping && currentSprite && escapeVector) {
        currentSprite.x += escapeVector.x;
        currentSprite.y += escapeVector.y;

        if (
            currentSprite.x < 0 || currentSprite.x > config.width ||
            currentSprite.y < UI_PANEL_HEIGHT || currentSprite.y > config.height
        ) {
            userData.push(shuffledZastupci[currentZastupceIndex].jmeno + "- sežral")
            cleanupCurrentSprite();
            resetSpawn.call(this);
        }
    }
}

function ensureUIOnTop(scene) {
    scene.children.bringToTop(uiPanel);
    scene.children.bringToTop(healthBarBackground);
    scene.children.bringToTop(healthBar);
    scene.children.bringToTop(birdSprite);
}

function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function spawnZastupce() {
    if (isProcessing || gameOver || currentZastupceIndex >= shuffledZastupci.length) {
        return;
    }

    isProcessing = true;
    isEscaping = false;

    const zastupce = shuffledZastupci[currentZastupceIndex];
    let startX, startY, distanceToCursor;

    do {
        startX = Phaser.Math.Between(50, 750);
        startY = Phaser.Math.Between(UI_PANEL_HEIGHT + 50, 550);
        distanceToCursor = calculateDistance(startX, startY, cursorX, cursorY);
    } while (distanceToCursor < MIN_DISTANCE_FROM_CURSOR);

    let targetX, targetY, distance;

    do {
        targetX = Phaser.Math.Between(50, 750);
        targetY = Phaser.Math.Between(UI_PANEL_HEIGHT + 50, 550);
        distance = calculateDistance(startX, startY, targetX, targetY);
    } while (distance < 450);

    currentSprite = this.add.sprite(startX, startY, zastupce.frame1).setInteractive();
    currentSprite.setOrigin(0.5, 0.5);

    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90;
    currentSprite.rotation = Phaser.Math.DegToRad(angle);

    animationTimer = this.time.addEvent({
        delay: 200,
        callback: () => {
            const currentTexture = currentSprite.texture.key;
            const newTexture = currentTexture === zastupce.frame1 ? zastupce.frame2 : zastupce.frame1;
            currentSprite.setTexture(newTexture);
        },
        loop: true
    });

    tween = this.tweens.add({
        targets: currentSprite,
        x: targetX,
        y: targetY,
        duration: (distance / zastupce.rychlost) * 1000,
        onComplete: () => {
            userData.push(zastupce.jmeno + "- nesežral")
            if (!isEscaping) {
                cleanupCurrentSprite();
                resetSpawn.call(this);
            }
        }
    });

    this.input.on('pointermove', (pointer) => {
        if (!currentSprite || isEscaping) return;

        const cursorX = pointer.x;
        const cursorY = pointer.y;
        const distanceToCursor = calculateDistance(currentSprite.x, currentSprite.y, cursorX, cursorY);

        if (distanceToCursor <= zastupce.percepce) {
            const escapeDx = currentSprite.x - cursorX;
            const escapeDy = currentSprite.y - cursorY;
            const escapeMagnitude = Math.sqrt(escapeDx ** 2 + escapeDy ** 2);

            escapeVector = {
                x: (escapeDx / escapeMagnitude) * zastupce.unikrychlost / 60,
                y: (escapeDy / escapeMagnitude) * zastupce.unikrychlost / 60
            };

            const escapeAngle = Phaser.Math.RadToDeg(Math.atan2(escapeDy, escapeDx)) + 90;
            currentSprite.rotation = Phaser.Math.DegToRad(escapeAngle);

            isEscaping = true;
            tween.stop();
        }
    });

    currentSprite.on('pointerdown', () => {
        if (zastupce.typ === 1) {
            health = Math.min(health + 15, MAX_HEALTH);
        } else if (zastupce.typ === 2) {
            health = Math.max(health - 50, 0);
        }
        userData.push(zastupce.jmeno + "- sežral")
        updateHealthBar();
        if (health <= 0) {
            gameState = GameState.DOTAZNIK;
            this.scene.restart();
        } else {
            cleanupCurrentSprite();
            resetSpawn.call(this);
        }
    });
}

function cleanupCurrentSprite() {
    if (animationTimer) {
        animationTimer.remove();
        animationTimer = null;
    }
    if (tween) {
        tween.stop();
        tween = null;
    }
    if (currentSprite) {
        currentSprite.destroy();
        currentSprite = null;
    }
    escapeVector = null;
    isEscaping = false;
}

function resetSpawn() {
    currentZastupceIndex++;
    isProcessing = false;
    spawnZastupce.call(this);
}

function updateHealthBar() {
    const newWidth = (health / MAX_HEALTH) * HEALTH_BAR_MAX_WIDTH;
    healthBar.width = newWidth;
}

function showDotaznik() {
    gameOver = true;

    // Přidání černého pozadí
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5);

    const otazka = otazky[currentOtazkaIndex];
    const otazkaText = this.add.text(30, 150, otazka.ot_text, {
        font: "24px Arial",
        fill: "#FFFFFF",
        wordWrap: { width: 740 }
    });

    if (otazka.ot_typ === 1) {
        inputBox = this.add.rectangle(400, 300, 300, 50, 0xeeeeee).setStrokeStyle(2, 0x000000);
        textDisplay = this.add.text(400, 300, inputText, {
            font: "20px Arial",
            color: "#000"
        }).setOrigin(0.5);

        this.input.keyboard.on("keydown", (event) => {
            if (event.key === "Enter") {
                userData.push(inputText)
                inputText = "";
                handleNextQuestion.call(this);
            } else if (event.key === "Backspace") {
                inputText = inputText.slice(0, -1);
            } else if (event.key.length === 1) {
                inputText += event.key;
            }
            textDisplay.setText(inputText);
        });
    } else if (otazka.ot_typ === 2) {
        const moznosti = [otazka.ot_moznost1, otazka.ot_moznost2, otazka.ot_moznost3, otazka.ot_moznost4].filter(Boolean);

        moznosti.forEach((moznost, index) => {
            const button = this.add.rectangle(400, 200 + index * 60, 300, 40, 0xcccccc).setInteractive();
            const buttonText = this.add.text(400, 200 + index * 60, moznost, {
                font: "20px Arial",
                color: "#000"
            }).setOrigin(0.5);

            button.on("pointerdown", () => {
                userData.push(moznost)
                handleNextQuestion.call(this);
            });
        });
    }
}

function handleNextQuestion() {
    currentOtazkaIndex++;
    if (currentOtazkaIndex >= otazky.length) {
        gameState = GameState.GAME_OVER;
    }
    this.scene.restart();
}


async function endGame() {
    // Vykreslíme černé pozadí závěrečné obrazovky
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5);
    
    let resultText = 'Konec hry!';
    
    try {
        // Počkáme na dokončení uploadu a získáme výsledek
        const result = await uploadUserData();
        resultText += '\nData nahrána úspěšně!';
        // Pokud chceš výsledek detailněji zobrazit, odkomentuj následující řádek:
        // resultText += '\n' + JSON.stringify(result);
    } catch (error) {
        resultText += '\nChyba při nahrávání dat: ' + error.message;
    }
    
    // Zobrazíme text se zprávou na obrazovce
    this.add.text(400, 300, resultText, {
        fontSize: '18px',
        fill: '#FFFFFF',
        align: 'center'
    }).setOrigin(0.5);
    
    this.input.enabled = false;
}
async function uploadUserData() {
    try {
      const response = await fetch("https://drive-proxy.zelenyakolyta.workers.dev", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        body: JSON.stringify(userData)  // userData je tvé pole, může obsahovat i stringy
      });
  
      // Pokud odpověď není OK, přečteme text a vyhodíme chybu
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server vrátil chybu: ${response.status} - ${errorText}`);
      }
  
      const result = await response.json();
      console.log("Úspěšně odesláno:", result);
      return result;
    } catch (error) {
      console.error("Chyba při odesílání dat:", error);
      throw error;
    }
  }
  