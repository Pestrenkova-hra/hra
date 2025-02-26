// https://pestrenkova-hra.github.io/hra/; https://ivanpavle.itch.io/pestrencihrajs (TEST)
// Menu stavů hry
const GameState = {
    MENU: 'menu',
    INFO: 'info',
    TUTORIAL: 'tutorial',
    PLAYING: 'playing',
    DOTAZNIK: 'dotaznik',
    GAME_OVER: 'gameOver'
};

let gameState = GameState.MENU; // Funkce, která na začátku hry řekne, že chceme menu

// Setup
const config = {
    type: Phaser.AUTO, // Magická funkce, která tomu řekne, ať si vybere nejlepší zobrazování podle toho, kde to užíváme (WebGL/čisté HTML)
    width: 800, // Šířka okna
    height: 600, // Výška okna
    backgroundColor: '#008000', // Barva pozadí
    // Konstruktér stavů, kterými prochází scéna (přednahrání obrázků, samotná tvorba a úpravy)
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const UI_PANEL_HEIGHT = 50; // Výška horního UI panelu
const MAX_HEALTH = 150; // Maximální množství životů
const HEALTH_LOSS_PER_TICK = 1; // Ubývání života za sekundu
const MIN_DISTANCE_FROM_CURSOR = 200; // Minimální vzdálenost startu od kurzoru, aby to hned nezačalo nějak špatně reagovat
const HEALTH_BAR_MAX_WIDTH = 150; // Maximální šířka ukazatele života

const game = new Phaser.Game(config); // Voláme, aby se vytvořila nějaká hra, která pojede podle informací, které jsme jí předepsali v config

// Třída zástupce
class Zastupce {
    constructor(jmeno, rychlost, typ, frame1, frame2, percepce, unikrychlost) {
        this.jmeno = jmeno; // Název druhu
        this.rychlost = rychlost; // Rychlost, která platí při normálním letu
        this.typ = typ; // Typ zástupce, podle kterého se dává nebo ubírá život: Nejedovatý => typ = 1; jedovatý model => typ = 2
        this.frame1 = frame1; // První snímek "animace"
        this.frame2 = frame2; // Druhý snímek "animace"
        this.percepce = percepce; // Vzdálenost v px, kde daná pestřenka začne s únikovou sekvencí, když bude kurzor (počítáno od středu)
        this.unikrychlost = unikrychlost; // Ryhlost, která se využívá při úniku
    }
}

// Seznam zástupců (tady prostě vypíšeme ony vlastnosti do sympatických seznamů [v pořadí, jak je konstruktor chce => jmeno, rychlost, typ, frame1, frame2, percepce, unikrychlost])
const zastupci = [
    new Zastupce("Test1", 300, 1, 'sprite1_a', 'sprite1_b', 100, 400),
    new Zastupce("TestA", 100, 2, 'sprite2_a', 'sprite2_b', 120, 250),
    new Zastupce("TestX", 200, 1, 'sprite3_a', 'sprite3_b', 150, 350),
    new Zastupce("Test9", 150, 2, 'sprite4_a', 'sprite4_b', 130, 300)
];

// Třída otázka
class Otazka {
    constructor(ot_text, ot_typ, ot_moznost1, ot_moznost2, ot_moznost3, ot_moznost4) {
        this.ot_text = ot_text; // Samotný text otázky
        this.ot_typ = ot_typ; // Typ otázky: otevřená dopisovací otázka => typ = 1; výběr z možností => typ = 2
        this.ot_moznost1 = ot_moznost1; // Jen pokud je otázka typu 2; možnosti (nemusí nutně být 4)
        this.ot_moznost2 = ot_moznost2; // Jen pokud je otázka typu 2; možnosti (nemusí nutně být 4)
        this.ot_moznost3 = ot_moznost3; // Jen pokud je otázka typu 2; možnosti (nemusí nutně být 4)
        this.ot_moznost4 = ot_moznost4; // Jen pokud je otázka typu 2; možnosti (nemusí nutně být 4)
    }
}

// Seznam otázek, jejich typů a možností (opět ve stejném pořadí, jako to chce konstruktér [otázky s možnostmi se pak budou v tomto pořadí i zobrazovat])
const otazky = [
    new Otazka("Ohodnoťte na stupnici 1-10 svoje entomologické znalosti", 1),
    new Otazka("Čím jste hru ovládali?", 2, "Myš", "Touchpad", "Dotyková obrazovka", "Trackpoint"),
    new Otazka("Jaká je odpověď na otázku života vesmíru a vůbec?", 1),
    new Otazka("Je otázek už příliš?", 2, "ano", "Ano", "ANO!!!")
];

let shuffledZastupci = []; // Základ seznamu, který se stará o promíchané pořadí vypouštění (až budou fotky, tak bude send systém ještě vylepšen)
let currentZastupceIndex = 0; // Pomocná veličina, která řeší, který zástupce je právě na řadě k letu
let currentOtazkaIndex = 0; // Stejná pomocná veličina, která hlídá, která otázka v dotazníku na konci je na řadě
let tutorialKrok = 1; // Pomocná veličina pro kroky tutoriálu
let health = MAX_HEALTH; // Převadí se veličiny, aby se s tím lépe pracovalo (tj. rychleji se napsal název)
// Připravujeme si nějaké prvky, které později budou užívány při vykreslování
let healthBar;
let healthBarBackground;
let tutorialhealthBarBackground;
let tutorialhealthBar;
let birdSprite;
let uiPanel;
let currentSprite = null;
let tutorialKurzor = null;
let tutorialKurzor2 = null;
let tutorialSprite = null;
let tutorialSprite2 = null;
let tutorialVykricnik = null;
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

// Přednačtení všech obrázků, které budou používány (přičemž jsem k tomu musel přiřadit nějaké pracovní názvy neznámo proč)
function preload() {
    this.load.image('sprite1_a', 'Test1.png');
    this.load.image('sprite1_b', 'Test2.png');
    this.load.image('sprite2_a', 'TestA.png');
    this.load.image('sprite2_b', 'TestB.png');
    this.load.image('sprite3_a', 'TestX.png');
    this.load.image('sprite3_b', 'TestY.png');
    this.load.image('sprite4_a', 'Test9.png');
    this.load.image('sprite4_b', 'Test8.png');
    this.load.image('ptak', 'ptak.png');
    this.load.image('nadpis', 'nadpis.png');
    this.load.image('start', 'start.png');
    this.load.image('info', 'info.png');
    this.load.image('zpet', 'zpet.png');
    this.load.image('dalsi', 'dalsi.png');
    this.load.image('kurzor', 'cursor.png');
    this.load.image('vykricnik', 'vykricnik.png');
}

// Tohle je v podstatě hlavní mozek tvorby hry (a ano, jen zavolá podle toho, která je fáze hry správnou fázi)
function create() {
    if (gameState === GameState.MENU) {
        showMenu.call(this);
    } else if (gameState === GameState.PLAYING) {
        startGame.call(this);
    } else if (gameState === GameState.INFO) {
        showInfo.call(this);
    } else if (gameState === GameState.TUTORIAL) {
        showTutorial.call(this);
    } else if (gameState === GameState.DOTAZNIK) {
        showDotaznik.call(this);
    } else if (gameState === GameState.GAME_OVER) {
        endGame.call(this);
    }
}

// Funkce k vykreslení menu (pravděpodobně to mělo být napsáno nějak pomocí scén, ale to bohužel neumím)
function showMenu() {
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5); // Černý obdélník na pozadí
    this.add.image(config.width / 2, config.height / 3 + 20, "nadpis").setOrigin(0.5); // Přidá nadpis PH
    const buttonStart = this.add.image(config.width / 2, config.height / 2 + 40, "start").setOrigin(0.5); // Vytvoří tlačítko pro start
    const buttonInfo = this.add.image(config.width / 2, config.height / 2 + 130, "info").setOrigin(0.5); // Vytvoří tlačítko pro informace
    buttonStart.setInteractive(); // Naznačíme tomu, že tlačítko bude někdy něco dělat...
    // ... a hned tomu řekneme, že na něj bude klikáno
    buttonStart.on('pointerdown', () => {
        gameState = GameState.TUTORIAL; // Změníme fázi hry
        this.scene.restart(); // Restartuje scénu (, kterou ale máme pouze jednu, takže se to prostě jen hluboce zamyslí a zavolá to znovu funkci create) a přepne na fázi PLAYING
    });
    // Opět stejná situace jako u buttonStart, jenom po kliknutí měníme fázi hry na INFO
    buttonInfo.setInteractive();
    buttonInfo.on("pointerdown", () => {
        gameState = GameState.INFO;
        this.scene.restart();
    });
}

// Funkce k vykreslení informací
function showInfo() {
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5); // Opět černý obdélník na pozadí
    this.add.text(400, 300, 'Informace', {fontSize: '32px', fill: '#FFFFFF'}).setOrigin(0.5); // Placeholder pro nějaký text, který tam snad jednoho dne bude
    const buttonZpet = this.add.image(config.width - 50, 50, "zpet").setOrigin(0.5) // Tlačítko k návratu zpět do menu
    // Stejná situace jako se všemi tlačítky => řekneme tomu, že chceme aby něco dělalo, když na něj klikneme a to něco bude návrat do menu
    buttonZpet.setInteractive();
    buttonZpet.on("pointerdown", () => {
        gameState = GameState.MENU;
        this.scene.restart();
    });
}

// Funkce k vykreslení tutoriálu (text pouze ilustrační, existence také)
function showTutorial() {
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x008000).setOrigin(0.5, 0.5);
    this.add.rectangle(config.width / 2, 50, config.width, config.height/5, 0x000000).setOrigin(0.5, 0.5);
    const buttonKrokD = this.add.image(config.width - 50, 50, "dalsi").setOrigin(0.5) // Tlačítko k dalšímu kroku tutoriálu
    const buttonKrokZ = this.add.image(config.width - 120, 50, "zpet").setOrigin(0.5) // Tlačítko k návratu v tutoriálu zpět
    // Stejná situace jako se všemi tlačítky => řekneme tomu, že chceme aby něco dělalo, když na něj klikneme a to něco bude návrat do menu
    buttonKrokD.setInteractive();
    buttonKrokD.on("pointerdown", () => {
        if (tutorialKrok === 3) {
            gameState = GameState.PLAYING;
            tutorialKrok = 1;
        } else {
            tutorialKrok++;
        }
        tutorialSprite.destroy();
        this.scene.restart();
    });
    // Stejná situace jako se všemi tlačítky => řekneme tomu, že chceme aby něco dělalo, když na něj klikneme a to něco bude návrat do menu 
    buttonKrokZ.setInteractive();
    buttonKrokZ.on("pointerdown", () => {
        if (tutorialKrok === 1) {
            gameState = GameState.MENU;
            tutorialKrok = 1;
        } else {
            tutorialKrok--;
        }
        tutorialSprite.destroy();
        this.scene.restart();
    });

    if (tutorialKrok === 1) {
        this.add.text(333, 50, '1) Cílem hry je ulovit kliknutím jedlé pestřenky a neulovit nebezpečné vosy!', {fontSize: '20px', fill: '#FFFFFF', wordWrap: { width: 650, useAdvancedWrap: true }}).setOrigin(0.5);
        tutorialSprite = this.add.sprite(400, 300, "sprite1_a");
        tutorialSprite.setOrigin(0.5, 0.5);
        tutorialSprite.rotation = Phaser.Math.DegToRad(127);
        tutorialKurzor = this.add.sprite(150, 200, "kurzor");
        tutorialtween = this.tweens.add({
            targets: tutorialSprite,
            x: 600,
            y: 450,
            duration: 3000,
            hold: 250,
            onComplete: () => {
                tutorialKurzor.destroy();
                this.scene.restart();
            }
        });
        tutorialtween2 = this.tweens.add({
            targets: tutorialKurzor,
            x: 600,
            y: 450,
            duration: 3000,
        });
    } else if (tutorialKrok === 2) {
        this.add.text(333, 50, '2) Dané pestřenky/vosy však mohou ulétnout, když si vás všimnou a nejste dost rychlí. (Lze je ale chytit i když začly odlétat)', {fontSize: '20px', fill: '#FFFFFF', wordWrap: { width: 650, useAdvancedWrap: true }}).setOrigin(0.5);
        tutorialSprite = this.add.sprite(400, 300, "sprite1_a");
        tutorialSprite.setOrigin(0.5, 0.5);
        tutorialSprite.rotation = Phaser.Math.DegToRad(127);
        tutorialVykricnik = this.add.sprite(500, 350, "vykricnik");
        tutorialVykricnik.setOrigin(0.5, 0.5);
        tutorialVykricnik.visible = false;
        tutorialKurzor = this.add.sprite(100, 300, "kurzor");
        tutorialtween = this.tweens.add({
            targets: tutorialSprite,
            x: 600,
            y: 450,
            duration: 3000,
            onComplete: () => {
                tutorialSprite.rotation = Phaser.Math.DegToRad(108);
                tutorialVykricnik.visible = true;
                tutorialtween3 = this.tweens.add({
                    targets: [tutorialSprite, tutorialVykricnik],
                    x: 1650,
                    y: 800,
                    duration: 1500,
                    hold: 250,
                    onComplete: () => {
                        tutorialKurzor.destroy();
                        this.scene.restart();
                    }
                });
            }
        });
        tutorialtween2 = this.tweens.add({
            targets: tutorialKurzor,
            x: 450,
            y: 400,
            duration: 3000,
        });
    } else if (tutorialKrok === 3) {
        this.add.text(333, 50, '3) Zkonzumování vosy se výrazně negativně propíše na životu ptáka, pestřenka život přidá. Když život dosáhne nuly, hra končí. Život postupně sám od sebe klesá.', {fontSize: '20px', fill: '#FFFFFF', wordWrap: { width: 650, useAdvancedWrap: true }}).setOrigin(0.5);
        tutorialSprite = this.add.sprite(400, 300, "sprite1_a");
        tutorialSprite.setOrigin(0.5, 0.5);
        tutorialSprite.rotation = Phaser.Math.DegToRad(127);
        tutorialSprite.visible = true;
        tutorialSprite2 = this.add.sprite(400, 300, "sprite2_a");
        tutorialSprite2.setOrigin(0.5, 0.5);
        tutorialSprite2.rotation = Phaser.Math.DegToRad(127);
        tutorialSprite2.visible = false;
        tutorialKurzor = this.add.sprite(150, 200, "kurzor");
        tutorialKurzor.visible = true;
        tutorialKurzor2 = this.add.sprite(150, 200, "kurzor");
        tutorialKurzor2.visible = false;
        tutorialhealthBarBackground = this.add.rectangle(config.width - 10 - HEALTH_BAR_MAX_WIDTH / 2, 150, 150, UI_PANEL_HEIGHT - 10, 0x555555);
        tutorialhealthBarBackground.setOrigin(0.5, 0.5);
        tutorialhealthBar = this.add.rectangle(config.width - 10 - HEALTH_BAR_MAX_WIDTH / 2, 150, 150, UI_PANEL_HEIGHT - 10, 0xFFFFFF);
        tutorialhealthBar.setOrigin(0.5, 0.5);
        tutorialhealthBar.width = 75;
        tutorialtween = this.tweens.add({
            targets: tutorialSprite,
            x: 600,
            y: 450,
            duration: 3000,
        });
        tutorialtween2 = this.tweens.add({
            targets: tutorialKurzor,
            x: 600,
            y: 450,
            hold: 250,
            duration: 3000,
            onComplete: () => {
                tutorialSprite.visible = false;
                tutorialSprite2.visible = true;
                tutorialKurzor.visible = false;
                tutorialKurzor2.visible = true;
                tutorialhealthBar.width = 90;
                tutorialtween3 = this.tweens.add({
                    targets: tutorialSprite2,
                    x: 600,
                    y: 450,
                    duration: 3000,
                    onComplete: () => {
                        tutorialhealthBar.width = 40;
                        tutorialtween5 = this.tweens.add({
                            targets: tutorialSprite,
                            x: 601,
                            y: 451,
                            duration: 250,
                            onComplete: () => {
                                this.scene.restart();
                            }
                        });
                    }
                });
                tutorialtween4 = this.tweens.add({
                    targets: tutorialKurzor2,
                    x: 600,
                    y: 450,
                    duration: 3000,
                });
            }
        });
    }
}

// Hlavní funkce, kde se už řeší hratelná podoba hry
function startGame() {
    // Přidání horního UI panelu
    uiPanel = this.add.rectangle(config.width / 2, UI_PANEL_HEIGHT / 2, config.width, UI_PANEL_HEIGHT, 0x000000);
    uiPanel.setOrigin(0.5, 0.5);

    // Přidání pozadí, které ukazuje maximální možný počet životů
    healthBarBackground = this.add.rectangle(config.width - 10 - HEALTH_BAR_MAX_WIDTH / 2, UI_PANEL_HEIGHT / 2, HEALTH_BAR_MAX_WIDTH, UI_PANEL_HEIGHT - 10, 0x555555);
    healthBarBackground.setOrigin(0.5, 0.5);

    // Přidání měřiče života
    healthBar = this.add.rectangle(config.width - 10 - HEALTH_BAR_MAX_WIDTH / 2, UI_PANEL_HEIGHT / 2, HEALTH_BAR_MAX_WIDTH, UI_PANEL_HEIGHT - 10, 0xFFFFFF);
    healthBar.setOrigin(0.5, 0.5);

    // Přidání obrázku ptáka, který budí lítost a nabádá lid snažit se
    birdSprite = this.add.sprite(config.width - 10 - HEALTH_BAR_MAX_WIDTH - 50, UI_PANEL_HEIGHT / 2, 'ptak');
    birdSprite.setOrigin(0.5, 0.5);
    birdSprite.setScale(0.5); // Zmenšení obrázku pro lepší zarovnání

    shuffledZastupci = Phaser.Utils.Array.Shuffle(zastupci); // Kouzelná funkce, která zamíchá pořadí v array (takový divný seznam, který skrývá více informací naráz než méně divný seznam)
    this.time.addEvent({
        delay: 1000, // Děje se jednou za každou sekundu (lze upravit na rychlejší/pomalejší odpočet)
        callback: () => {
            if (!gameOver) { // Dokud není konec hry...
                health = Math.max(health - HEALTH_LOSS_PER_TICK, 0); // ... odečteme právě teď zdraví (HEALTH_LOSS_PER_TICK kdyžtak umožňuje zrychlit úbytek zdraví za sekundu poměrně snadno -- je to jedna z těch proměnných nahoře myslím)
                updateHealthBar(); // Updatujeme vizualizaci života
                if (health <= 0) { // Pokud je život 0 nebo níž (může k tomu dojít, kvůli tomu, že když odečítáme životy nějak více [třeba po sežrání typu 2] a bylo by to někdy na konci, tak by nás to dostalo do záporných hodnot a to by vše rozbilo)...
                    gameState = GameState.DOTAZNIK; // Přepneme fázi hry na dotazník
                    this.scene.restart(); // Restart scény
                }
            }
        },
        loop: true // A to trvá stále
    });

    spawnZastupce.call(this); // Zavolá zástupce z array (neznámo proč se to volá jako "this")
}

// Mělo by to běžet prakticky pořád a dělat takové ty funkce, které jsou velmi promněnlivé (zejména útěk)
function update() {
    // Řeší problém s UI, kdy zástupci létali nad ním
    ensureUIOnTop(this);
    // Funkce pro útěk => když utíká a má ještě nějaké tyto informace, které si vlastně nejsem jistý proč tam být musí/proč se nevygenerují až někde tady)
    if (isEscaping && currentSprite && escapeVector) {
        currentSprite.x += escapeVector.x; // Pohyb po útěkovém vektoru
        currentSprite.y += escapeVector.y; // Pohyb po útěkovém vektoru
        // Tohle teď ve výsledku hlídá, zda už vylétli z obrazu nebo ne (ty dvě čáry slouží jako logická brána OR [1 1 => 1; 1 0 => 1; 0 1 => 1; 0 0 => 0])
        if (
            currentSprite.x < 0 || currentSprite.x > config.width ||
            currentSprite.y < UI_PANEL_HEIGHT || currentSprite.y > config.height
        ) {
            userData.push(shuffledZastupci[currentZastupceIndex].jmeno + "- nesežral") // Vloží se na seznam, že tento zástupce nebyl sežrán
            // Funkce, které se v zbavují toho starého a volají nového (zástupce)
            cleanupCurrentSprite();
            resetSpawn.call(this);
        }
    }
}

// Samotná funkce, řešící UI
function ensureUIOnTop(scene) {
    scene.children.bringToTop(uiPanel);
    scene.children.bringToTop(healthBarBackground);
    scene.children.bringToTop(healthBar);
    scene.children.bringToTop(birdSprite);
}

// Učíme to matematiku! Funkce na výpočet pythagorovy věty
function calculateDistance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Funkce, která se stará o zástupce a vlastně téměř vše, co s nimi souvisí
function spawnZastupce() {
    // Kontrolujeme spoustu věcí, protože kdyby to tam nebylo, tak se dějí bizarní věci
    if (isProcessing || gameOver || currentZastupceIndex >= shuffledZastupci.length) {
        return;
    }

    // Vypne útěkový stav od minulého zástupce na obrazovce a zapne normální stav
    isProcessing = true;
    isEscaping = false;

    // Příprava a přejmenování některých náramně užitečných věcí
    const zastupce = shuffledZastupci[currentZastupceIndex];
    let startX, startY, distanceToCursor;

    // Vytvoření náhodného místa, kde se na začátku zástupce zjeví (jde to změnit na nějaké předzadané místo kdyžtak)
    do {
        startX = Phaser.Math.Between(50, 750);
        startY = Phaser.Math.Between(UI_PANEL_HEIGHT + 50, 550);
        distanceToCursor = calculateDistance(startX, startY, cursorX, cursorY);
    } while (distanceToCursor < MIN_DISTANCE_FROM_CURSOR); // Kontroluje to, aby start nebyl příliš blízko kurzoru, aby to nezpůsobilo nějaké problémy (bude třeba doladit, ale to počká až na úplný konec)

    let targetX, targetY, distance; // Opět příprava nějakých magických veličin, které se určitě budou hodit

    // Vytvoření náhodného místa, kam zástupce letí (uvažuji o tom, zda to nezměnit spíše na vektor a neudělat stejný systém jako je na ulétávání z obrazovky)
    do {
        targetX = Phaser.Math.Between(50, 750);
        targetY = Phaser.Math.Between(UI_PANEL_HEIGHT + 50, 550);
        distance = calculateDistance(startX, startY, targetX, targetY);
    } while (distance < 450); // Vzdálenost letu musí být nějak velká, jinak se vybere jiná

    currentSprite = this.add.sprite(startX, startY, zastupce.frame1).setInteractive(); // Vloží tam sprite pro právě letícího zástupce a řekneme tomu, že po tom něco budeme chtít
    currentSprite.setOrigin(0.5, 0.5); // Nastavíme střed (v podstatě uprostřed toho obrázku)

    // Výpočet úhlu letu
    const dx = targetX - startX;
    const dy = targetY - startY;
    const angle = Phaser.Math.RadToDeg(Math.atan2(dy, dx)) + 90; // Přepočte to nějakou trigonometrií ten úhel
    currentSprite.rotation = Phaser.Math.DegToRad(angle); // Nastaví rotaci toho zástupce

    // "Animace"
    animationTimer = this.time.addEvent({
        delay: 200, // Střídání snímků po nějakém čase
        callback: () => {
            const currentTexture = currentSprite.texture.key; // Jakási magická funkce, kde si nejsem zcela jist, co dělá a nebudu to zjišťovat
            const newTexture = currentTexture === zastupce.frame1 ? zastupce.frame2 : zastupce.frame1; // Výměna snímku animace na ten, který tam právě není
            currentSprite.setTexture(newTexture); // Reálně to nastaví ten snímek, který to právě vymyslelo
        },
        loop: true //... a to běží pořád
    });

    // Pohybový skript - ze záhadných důvodů to nějak funguje, i když je tween myslím iniciálně pro animace
    tween = this.tweens.add({
        targets: currentSprite, // Animace platí pro právě běžící sprite...
        x: targetX, // ..., který míří sem...
        y: targetY, // ... a sem
        duration: (distance / zastupce.rychlost) * 1000, // Počítá to s délkou animace, ale zatím to nědělalo problémy, takže tomu nebráníme (asi jak to pak stejně přepneme na nějaký jiný systém, tak to jakoby přepíšeme a je to jedno)
        onComplete: () => { // Když to dojde na cílové místo bez toho, aby na toho zástupce bylo kliknuto, ...
            userData.push(zastupce.jmeno + "- nesežral") // ... uložíme do uživatelových dat, že daného zástupce nesežral
            // Příprava na dalšího - smazání současného a poslání dalšího zástupce
            if (!isEscaping) {
                cleanupCurrentSprite();
                resetSpawn.call(this);
            }
        }
    });

    this.input.on('pointermove', (pointer) => { // Toto kontroluje, zda je hýbáno kurzorem
        if (!currentSprite || isEscaping) return; // Nějakým způsobem je tam nahráno více než jen ten zástupce a jeho sprite, než co potřebujeme a tím pádem se musí zkontrolovat, aby se nějak záhadně nedali vyhnat "neexistující"; escape sekvence nemůže začít, pokud už běží

        // Získáme údaje o pozici kurzoru a vypočteme z toho vzdálenost mezi zástupcem (střed jeho sprite) a kurzoru
        const cursorX = pointer.x;
        const cursorY = pointer.y;
        const distanceToCursor = calculateDistance(currentSprite.x, currentSprite.y, cursorX, cursorY);

        if (distanceToCursor <= zastupce.percepce) { // Platí, pokud kurzor vzdáleností spadá do percepčního kruhu daného zástupce
            // Spočítáme útěkový vektor (podle pozici myši a současné pozici zástupce ve chvíli, kdy byla iniciována escape sekvence)
            const escapeDx = currentSprite.x - cursorX;
            const escapeDy = currentSprite.y - cursorY;
            const escapeMagnitude = Math.sqrt(escapeDx ** 2 + escapeDy ** 2);

            // Realizujeme útěk po útěkovém vektoru v útěkové rychlosti (mám pocit, že jde zase o ten animační tween)
            escapeVector = {
                x: (escapeDx / escapeMagnitude) * zastupce.unikrychlost / 60,
                y: (escapeDy / escapeMagnitude) * zastupce.unikrychlost / 60
            };

            const escapeAngle = Phaser.Math.RadToDeg(Math.atan2(escapeDy, escapeDx)) + 90; // Musí se přepočítat úhel letu
            currentSprite.rotation = Phaser.Math.DegToRad(escapeAngle); // A úhel se přidá k rotaci sprite
            // A proč tady převádíme tam a zpátky z radiánů na stupně a ze stupňů zpět na radiány? Odpověď je jednoduchá. Rádo to pracuje s úhly v radiánech (== jinak to nefunguje), ale počítání s nimi tomu moc nejde - takže jelikož potřebujeme připočítat nějaké stupně, abychom vyrovnali letový úhel, nemůžeme počítat jako s běznými radiány, ale je snazší převést si to "zbytečně" tam a zpět (na výkonu to ale nic moc nemění)

            isEscaping = true; // Aktivujeme kontrolní bod pro escape sekvenci, aby s tím mohl počítat i zbytek programu
            tween.stop(); // Zastavíme všechny animace (nejsem si jistý proč)
        }
    });

    currentSprite.on('pointerdown', () => { // Tady řešíme kliknutí na právě aktivního zástupce
        if (zastupce.typ === 1) { // Pokud je typ zástupce 1 (tj. nejedovatý), ...
            health = Math.min(health + 15, MAX_HEALTH); // Přidáme k životu určitý počet bodů (, přičemž ale nemůžeme přesáhnout maximální limit -- dělá to sice optimální strategií počkat si chvíli mezi chytáním každým, ale to snad nevadí (?) -- pokud by tento systém neexistoval, dalo by se hned na začátku všechno rychle vyklikat a pak sedět a čekat, než vůbec začne ubývat vizualizace odpočtu a to je myslím skoro horší)
        } else if (zastupce.typ === 2) { // Pokud je typ zástupce 2 (tj. jedovatý), ...
            health = Math.max(health - 50, 0); // Odebereme život. Až budeme řešit treatmenty, tak se dá nastavit kdyžtak i nějaká dynamičtější síla jedovatosti, kterou právě tady budeme měnit, pokud bychom chtěli počítat s tímto. Hranice je 0
        }
        userData.push(zastupce.jmeno + "- sežral") // Přidáme do uživatelských dat, že byl daný zástupce sežrán
        updateHealthBar(); // Aktualizují se životy, jelikož jsme s nimi něco dělali ještě nad to, co se děje každou sekundu
        if (health <= 0) { // Pokud život dosáhne 0 (opět musíme řešit takový ten bizár, kdy se teoreticky můžeme dostat pod 0), ...
            gameState = GameState.DOTAZNIK; // Přejdeme do další fáze hry, dotazníku
            this.scene.restart(); // A resetujeme scénu, aby to správně vykreslovalo
        } else { // Pokud ještě životy jsou, tak se to pokusí vyklidit scénu a poslat tam dalšího zástupce
            cleanupCurrentSprite();
            resetSpawn.call(this);
        }
    });
}

// Ultimátní funkce, která všem kazí zábavu (== vypíná všechny procesy, které by se mohly krýt s dalšími u dalšího zástuce)
function cleanupCurrentSprite() {
    if (animationTimer) {
        animationTimer.remove(); // Odstraňuje časovač animace od právě aktivního
        animationTimer = null; // A je vynulován
        // Kdyby to tam nebylo, tak by animace (/ty tweeny, které máme jako pohybové skripty) začínaly už dávno na konci
    }
    // Raději vynulujeme i ty tweeny, i když jsme to už myslím dělali
    if (tween) {
        tween.stop();
        tween = null;
    }
    // Zničí to ze světa současnou sprite aktuálního zástupce
    if (currentSprite) {
        currentSprite.destroy();
        currentSprite = null;
    }
    // A vynuluje/vypne to vše spojené s escape sekvencí
    escapeVector = null;
    isEscaping = false;
}

// Funkce, která volá za zjevením dalšího zástupce
function resetSpawn() {
    currentZastupceIndex++; // Tohle posunuje index a je to v podstatě jediné důležité
    isProcessing = false;
    spawnZastupce.call(this); // Tato funkce reálně dělá všechno potřebné (viz výše)
}

//Funkce, která upravuje vizualizaci života (už jsme ji měli výše používanou)
function updateHealthBar() {
    const newWidth = (health / MAX_HEALTH) * HEALTH_BAR_MAX_WIDTH; // Přepočte se, kolik procent maximálního života aktuálně máme a to se promítne na měřidle
    healthBar.width = newWidth; // Aktualizuje se měřidlo
}

// Funkce, která tvoří dotazníkovou část hry
function showDotaznik() {
    gameOver = true; // Voláme konec hry, kdyby chtěly běžet ještě nějaké divoké programovosti, tak aby to předem vzdaly
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5); // Přidání černého obdélníku jako pozadí

    const otazka = otazky[currentOtazkaIndex]; // Určení, která otázka se má právě ukazovat
    // Vkládání textu otázky na stránku a nějaké další nezajímavé údaje k tomu (24 Arial, bílý, zalamování řádek po 740 px [poladit pak s nějakými dalšími texty])
    const otazkaText = this.add.text(30, 150, otazka.ot_text, {
        font: "24px Arial",
        fill: "#FFFFFF",
        wordWrap: { width: 740 }
    });

    if (otazka.ot_typ === 1) { // Řeší agendu pro otázkový typ 1 (= dopisovací)
        inputBox = this.add.rectangle(400, 300, 300, 50, 0xeeeeee).setStrokeStyle(2, 0x000000); // Prostor, kde se bude zjevovat ten uživatelský input
        // Samotný text od uživatele - konkrétně jeho vložení do prostoru
        textDisplay = this.add.text(400, 300, inputText, {
            font: "20px Arial",
            color: "#000"
        }).setOrigin(0.5);

        this.input.keyboard.on("keydown", (event) => { // Kontroluje, zda byla stisknuta kterákoliv klávesa
            if (event.key === "Enter") { // Speciální klávesa č.1: Enter
                userData.push(inputText) // Přidá odpověď do uživatelských dat, která chceme posílat
                inputText = ""; // Vynuluje to text
                handleNextQuestion.call(this); // Vyšle žádost o další otázku
            } else if (event.key === "Backspace") { // Speciální klávesa č.2: Backspace
                inputText = inputText.slice(0, -1); // Musíme tomu říct, jak funguje backspace a jak ořezávat ten uživatelsky zadávaný string
            } else if (event.key.length === 1) { // Pokud je stisknuta kterákoliv jedna normální klávesa, ...
                inputText += event.key; // ... přidá se korespondující znak
            }
            textDisplay.setText(inputText); // Aktualizace zobrazovaného, právě psaného, textu
        });
    } else if (otazka.ot_typ === 2) { // Řeší agendu pro otázkový typ 2 (= výběr z možností)
        const moznosti = [otazka.ot_moznost1, otazka.ot_moznost2, otazka.ot_moznost3, otazka.ot_moznost4].filter(Boolean); // Toto umožňuje mít otázky, kde se ptáme na méně než 4 možnosti => teoreticky jde použít podobný základ systému, abychom měli i více otázek -- toto prostě kontroluje, jestli tam někde je, aby to nevolalo chybu

        moznosti.forEach((moznost, index) => { // Platí to pro každou možnost a budou nějak podle toho vykreslovány (bere si to i pořadí odpovědi)
            const button = this.add.rectangle(400, 200 + index * 60, 300, 40, 0xcccccc).setInteractive(); // Vytvoří tlačítka s pozicemi ovlivněnými indexem
            // Přidá na každé tlačítko text s korespondující možností
            const buttonText = this.add.text(400, 200 + index * 60, moznost, {
                font: "20px Arial",
                color: "#000"
            }).setOrigin(0.5);

            button.on("pointerdown", () => { // Když se klikne na tlačítko, ...
                userData.push(moznost) // .. přidá se do uživatelských dat zvolená možnost ....
                handleNextQuestion.call(this); // ... a objedná to další otázku
            });
        });
    }
}

// Toto se stará o ty další otázky
function handleNextQuestion() {
    currentOtazkaIndex++; // Přidá, že chceme další index otázky
    if (currentOtazkaIndex >= otazky.length) { // Zjistí, zda tam vůbec máme ještě co přidávat
        gameState = GameState.GAME_OVER; // Když ne, tak to pošle do konce hry
    }
    this.scene.restart(); // Když ano, restartuje scénu a bude tam další otázka (tohle se tedy vlastně zavolá na restart scény i když ne, ale tehdy to přehodí na ten konec)
}

// Funkce, která by se měla starat o konec hry - jde o async funkci, protože musíme řešit problém s dvěmi asynchronními procesy (třeba to někdy i bude fungovat)
async function endGame() {
    this.add.rectangle(config.width / 2, config.height / 2, config.width, config.height, 0x000000).setOrigin(0.5, 0.5); // Náš oblíbený černý obdélník místo pozadí
    let resultText = 'Konec hry!'; // Ukazovaný text
    
    try { // Zkouší to uploadovat
        const result = await uploadUserData(); //  Počkáme na výsledek uploadování
        resultText += '\nData nahrána úspěšně!'; // Pokud se všechno nahrálo správně, tak se zjeví toto (testovací funkce)
    } catch (error) {
        resultText += '\nChyba při nahrávání dat: ' + error.message; // Pokud je s tím nějaký problém, tak nám řekne, co je to za problém (samozřejmě velmi krypticky a nic to nebude vypovídat)
    }    
    // Zobrazíme text se zprávou o (ne)úspěchu
    this.add.text(400, 300, resultText, {
        fontSize: '18px',
        fill: '#FFFFFF',
        align: 'center'
    }).setOrigin(0.5);
    this.input.enabled = false; // Vypneme kterýkoliv input do hry
}

// Chaos, aneb druhá async funkce na posílání dat (pokusím se jí popsat, ale nerozumím tomu)
async function uploadUserData() {
    try {
      const response = await fetch("https://drive-proxy.zelenyakolyta.workers.dev", { // Voláme proxyserver
        method: 'POST', // Metoda, kdy vložíme (na rozdíl od třeba GET, kdy bychom vytahovali nějaká data)
        headers: { 
          'Content-Type': 'application/json', // Řekneme tomu, co posíláme
          'X-API-KEY': 'TAJNY_KLIC'
        },
        body: JSON.stringify(userData) // Uděláme z arraye (/funguje v podstatě jako string) JSON
      });
      if (!response.ok) { // Chybový skript, který nám zanalyzuje, kde soudruzi z NDR udělali chybu (ve finální verzi možno odmazat)
        const errorText = await response.text();
        throw new Error(`Server vrátil chybu: ${response.status} - ${errorText}`);
      }
      // Výpis odeslanosti
      const result = await response.json();
      console.log("Úspěšně odesláno:", result);
      return result;
    } catch (error) {
      console.error("Chyba při odesílání dat:", error);
      throw error;
    }
  }