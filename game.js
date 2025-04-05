// Constantes de vitesse
const PLAYER_SPEED = 0.4;     // Vitesse de déplacement par défaut
const PASS_SPEED = 1;         // Vitesse du ballon lors d'une passe
const SHOOT_SPEED = 2;        // Vitesse du ballon lors d'un tir

// Facteur de zoom
const zoom = 12;  // Zoom fixé à 12

// Taille du terrain (en unités de terrain)
const fieldWidth = 150;
const fieldHeight = 100;

// Variables de score
let scoreGauche = 0;
let scoreDroite = 0;

// Variables pour la gestion du kickoff
let firstKickoff = true;
let gameState = "kickoff";            // "kickoff", "play", "out"
let kickoffTeam = Math.random() < 0.5 ? "gauche" : "droite";  // Camp choisi aléatoirement pour le kickoff
let kickoffInitialized = false;
let kickoffStart = Date.now();

// Délai avant que le passeur ne puisse récupérer la balle (en ms)
const PASS_DELAY = 500;

// Seuils pour la sauvegarde du gardien
const GK_SAVE_DISTANCE = 10;        // Distance en unités de terrain
const GK_SAVE_SPEED_THRESHOLD = 2;    // Seuil de vitesse pour qu'un gardien sauve

// Coordonnées des cages (filets) en world units (parallélogrammes)
const leftCagePoints = [
  { x: -5, y: 30 },
  { x: 0, y: 30 },
  { x: 0, y: 70 },
  { x: -5, y: 70 }
];
const rightCagePoints = [
  { x: fieldWidth, y: 30 },
  { x: fieldWidth + 5, y: 30 },
  { x: fieldWidth + 5, y: 70 },
  { x: fieldWidth, y: 70 }
];

// Pour la détection de but, on considère qu’un tir est valide si la balle dépasse d’au moins 5 unités horizontalement
// et que sa position verticale est comprise entre 30 et 70

// Récupération du canvas et configuration du contexte
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// La caméra suit le ballon (en world units)
let camera = { x: fieldWidth / 2, y: fieldHeight / 2 };

// Variables globales pour le ballon et les joueurs (initialisées ci-dessous)
let ball;
let players = [];

// --- Fonctions utilitaires ---
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

function toIsoCamera(x, y) {
  const iso = {
    x: (x - y) * 0.7 * zoom,
    y: (x + y) * 0.35 * zoom
  };
  const cameraIso = {
    x: (camera.x - camera.y) * 0.7 * zoom,
    y: (camera.x + camera.y) * 0.35 * zoom
  };
  return {
    x: iso.x - cameraIso.x + canvas.width / 2,
    y: iso.y - cameraIso.y + canvas.height / 2
  };
}

function lerp(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// --- Dessin du terrain, cages et cercle central ---
function drawPitch() {
  // Terrain
  const p1 = toIsoCamera(0, 0);
  const p2 = toIsoCamera(fieldWidth, 0);
  const p3 = toIsoCamera(fieldWidth, fieldHeight);
  const p4 = toIsoCamera(0, fieldHeight);
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.stroke();
  
  // Ligne médiane
  const midTop = toIsoCamera(fieldWidth / 2, 0);
  const midBottom = toIsoCamera(fieldWidth / 2, fieldHeight);
  ctx.beginPath();
  ctx.moveTo(midTop.x, midTop.y);
  ctx.lineTo(midBottom.x, midBottom.y);
  ctx.stroke();
  
  // Cercle central agrandi (surface de réparation) - Rayon de 40
  const center = toIsoCamera(fieldWidth / 2, fieldHeight / 2);
  ctx.beginPath();
  ctx.arc(center.x, center.y, 40, 0, Math.PI * 2);
  ctx.stroke();
  
  // Dessiner les cages (filets) sous forme de parallélogrammes
  drawGoalNet(leftCagePoints, 5);
  drawGoalNet(rightCagePoints, 5);
}

function drawGoalNet(goalPoints, divisions) {
  const p = goalPoints.map(pt => toIsoCamera(pt.x, pt.y));
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p[0].x, p[0].y);
  p.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.stroke();
  for (let i = 1; i < divisions; i++) {
    const t = i / divisions;
    const leftEdge = lerp(p[0], p[3], t);
    const rightEdge = lerp(p[1], p[2], t);
    ctx.beginPath();
    ctx.moveTo(leftEdge.x, leftEdge.y);
    ctx.lineTo(rightEdge.x, rightEdge.y);
    ctx.stroke();
  }
  for (let i = 1; i < divisions; i++) {
    const t = i / divisions;
    const topEdge = lerp(p[0], p[1], t);
    const bottomEdge = lerp(p[3], p[2], t);
    ctx.beginPath();
    ctx.moveTo(topEdge.x, topEdge.y);
    ctx.lineTo(bottomEdge.x, bottomEdge.y);
    ctx.stroke();
  }
}

// --- Classes ---
// Les gardiens seront affichés en rond noir
class Player {
  constructor(id, team, x, y, isGoalkeeper = false, controlled = false) {
    this.id = id;
    this.team = team;
    this.x = x;
    this.y = y;
    this.baseX = x;
    this.baseY = y;
    this.radius = isGoalkeeper ? 12 : 8;
    this.color = isGoalkeeper ? "black" : (team === "gauche" ? "blue" : "red");
    this.isGoalkeeper = isGoalkeeper;
    this.controlled = controlled;
    this.speed = PLAYER_SPEED;
    this.hasBall = false;
  }
  
  draw() {
    const pos = toIsoCamera(this.x, this.y);
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    if (this.hasBall) {
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  
  update() {
    if (this.controlled) return; // Le joueur contrôlé est géré via handlePlayerActions
    if (this.hasBall) {
      // Pour tirer, on se dirige vers le but adverse
      const target = this.team === "gauche"
        ? { x: fieldWidth - 10, y: this.baseY }  // Pour l'équipe gauche, viser à droite
        : { x: 10, y: this.baseY };             // Pour l'équipe droite, viser à gauche
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        this.x += (dx / dist) * 0.5;
        this.y += (dy / dist) * 0.5;
      }
      this.x = clamp(this.x, 0, fieldWidth);
      this.y = clamp(this.y, 0, fieldHeight);
      return;
    }
    // Pour les joueurs de l'équipe gauche (non contrôlés), rester en formation
    if (this.team === "gauche") {
      const dx = this.baseX - this.x;
      const dy = this.baseY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        this.x += (dx / dist) * 0.3;
        this.y += (dy / dist) * 0.3;
      }
      this.x = clamp(this.x, 0, fieldWidth);
      this.y = clamp(this.y, 0, fieldHeight);
      return;
    }
    // Pour l'équipe droite, on fait courir uniquement le joueur le plus proche du ballon
    if (this.team === "droite") {
      const teamPlayers = players.filter(p => p.team === "droite" && !p.controlled);
      if (teamPlayers.length === 0) return;
      const closest = teamPlayers.reduce((prev, curr) =>
        Math.hypot(prev.x - ball.x, prev.y - ball.y) < Math.hypot(curr.x - ball.x, curr.y - ball.y) ? prev : curr
      );
      if (closest.id === this.id) {
        const dx = ball.x - this.x;
        const dy = ball.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          this.x += (dx / dist) * 0.5;
          this.y += (dy / dist) * 0.5;
        }
      } else {
        const dx = this.baseX - this.x;
        const dy = this.baseY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          this.x += (dx / dist) * 0.3;
          this.y += (dy / dist) * 0.3;
        }
      }
      this.x = clamp(this.x, 0, fieldWidth);
      this.y = clamp(this.y, 0, fieldHeight);
      return;
    }
  }
}

class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 4;
    this.vx = 0;
    this.vy = 0;
    this.inAir = false;
    this.lastPossessor = null;
    this.passTimer = 0;
  }
  
  draw() {
    const pos = toIsoCamera(this.x, this.y);
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy *= 0.98;
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vy) < 0.01) this.vy = 0;
  }
}

// --- Remise en jeu et gestion du kickoff ---
function resetKickoff() {
  gameState = "kickoff";
  kickoffInitialized = false;
  kickoffStart = Date.now();
  ball.x = fieldWidth / 2;
  ball.y = fieldHeight / 2;
  ball.vx = 0;
  ball.vy = 0;
  players.forEach(player => {
    player.x = player.baseX;
    player.y = player.baseY;
    player.hasBall = false;
  });
  kickoffTeam = Math.random() < 0.5 ? "gauche" : "droite";
  firstKickoff = false;
  console.log("Reset kickoff. Nouveau camp :", kickoffTeam);
}

function handleKickoff() {
  if (!kickoffInitialized) {
    if (kickoffTeam === "gauche") {
      let controlled = players.find(p => p.team === "gauche" && p.controlled);
      if (!controlled) controlled = players.find(p => p.team === "gauche");
      if (controlled) {
        controlled.hasBall = true;
        ball.x = controlled.x;
        ball.y = controlled.y;
      }
    } else {
      const rightTeam = players.filter(p => p.team === "droite");
      if (rightTeam.length > 0) {
        const kicker = rightTeam[Math.floor(Math.random() * rightTeam.length)];
        kicker.hasBall = true;
        ball.x = kicker.x;
        ball.y = kicker.y;
      }
    }
    kickoffInitialized = true;
  }
}

function handleBallOut() {
  // Si la balle est hors limites avec une tolérance de 1 unité
  if (ball.x < -1 || ball.x > fieldWidth + 1 || ball.y < -1 || ball.y > fieldHeight + 1) {
    // Côté gauche (filet gauche)
    if (ball.x < -1 && ball.y >= 30 && ball.y <= 70) {
      const defendingGK = players.find(p => p.team === "gauche" && p.isGoalkeeper);
      const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      const distGK = defendingGK ? Math.hypot(defendingGK.x - ball.x, defendingGK.y - ball.y) : Infinity;
      if (defendingGK && distGK < GK_SAVE_DISTANCE && ballSpeed < GK_SAVE_SPEED_THRESHOLD) {
        defendingGK.hasBall = true;
        ball.x = defendingGK.x;
        ball.y = defendingGK.y;
        gameState = "play";
        console.log("Save par le gardien de gauche.");
      } else {
        scoreDroite++;
        console.log("But pour l'équipe droite! Score:", scoreGauche, "-", scoreDroite);
        resetKickoff();
      }
      return true;
    }
    // Côté droit (filet droit)
    if (ball.x > fieldWidth + 1 && ball.y >= 30 && ball.y <= 70) {
      const defendingGK = players.find(p => p.team === "droite" && p.isGoalkeeper);
      const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      const distGK = defendingGK ? Math.hypot(defendingGK.x - ball.x, defendingGK.y - ball.y) : Infinity;
      if (defendingGK && distGK < GK_SAVE_DISTANCE && ballSpeed < GK_SAVE_SPEED_THRESHOLD) {
        defendingGK.hasBall = true;
        ball.x = defendingGK.x;
        ball.y = defendingGK.y;
        gameState = "play";
        console.log("Save par le gardien de droite.");
      } else {
        scoreGauche++;
        console.log("But pour l'équipe gauche! Score:", scoreGauche, "-", scoreDroite);
        resetKickoff();
      }
      return true;
    }
    // Sorties verticales
    if (ball.y < -1 || ball.y > fieldHeight + 1) {
      resetKickoff();
      console.log("Remise en jeu (Haut/Bas).");
      return true;
    }
    // Autres cas : remise en jeu
    resetKickoff();
    console.log("Remise en jeu (Hors limites).");
    return true;
  }
  return false;
}

// --- Gestion des entrées clavier ---
let keysPressed = {};
document.addEventListener("keydown", (e) => { keysPressed[e.key.toLowerCase()] = true; });
document.addEventListener("keyup", (e) => { keysPressed[e.key.toLowerCase()] = false; });

// Fonction utilitaire pour obtenir la direction des flèches
function getDirectionFromArrows(defaultDx = 1, defaultDy = 0) {
  let dx = 0, dy = 0;
  if (keysPressed["arrowup"]) dy -= 1;
  if (keysPressed["arrowdown"]) dy += 1;
  if (keysPressed["arrowleft"]) dx -= 1;
  if (keysPressed["arrowright"]) dx += 1;
  if (dx === 0 && dy === 0) { dx = defaultDx; dy = defaultDy; }
  const mag = Math.sqrt(dx * dx + dy * dy);
  return { dx: dx / mag, dy: dy / mag };
}

// Pour l'équipe de gauche, renvoie le joueur contrôlé s'il a la balle,
// sinon le joueur le plus proche du ballon
function getActivePlayer() {
  const controlled = players.find(p => p.team === "gauche" && p.controlled);
  if (controlled && controlled.hasBall) return controlled;
  const teamPlayers = players.filter(p => p.team === "gauche");
  if (teamPlayers.length === 0) return null;
  return teamPlayers.reduce((prev, curr) =>
    Math.hypot(prev.x - ball.x, prev.y - ball.y) < Math.hypot(curr.x - ball.x, curr.y - ball.y) ? prev : curr
  );
}

// --- Gestion des actions du joueur ---
function handlePlayerActions() {
  const player = getActivePlayer();
  if (!player) return;
  
  if (gameState === "kickoff" && kickoffTeam === "gauche") {
    if (keysPressed["d"] || keysPressed["s"] || keysPressed["q"] || keysPressed["z"]) {
      gameState = "play";
      console.log("Kickoff lancé par le joueur gauche !");
    }
  }
  
  if (keysPressed["arrowup"]) player.y -= PLAYER_SPEED;
  if (keysPressed["arrowdown"]) player.y += PLAYER_SPEED;
  if (keysPressed["arrowleft"]) player.x -= PLAYER_SPEED;
  if (keysPressed["arrowright"]) player.x += PLAYER_SPEED;
  
  if (player.hasBall && (gameState === "play" || (gameState === "kickoff" && kickoffTeam === "gauche"))) {
    if (keysPressed["s"]) {
      const { dx, dy } = getDirectionFromArrows();
      ball.vx = dx * PASS_SPEED;
      ball.vy = dy * PASS_SPEED;
      ball.lastPossessor = player.id;
      ball.passTimer = Date.now();
      player.hasBall = false;
      console.log("Passe S lancée : direction", dx, dy);
    }
    if (keysPressed["d"]) {
      const { dx, dy } = getDirectionFromArrows();
      ball.vx = dx * SHOOT_SPEED;
      ball.vy = dy * SHOOT_SPEED;
      ball.lastPossessor = player.id;
      ball.passTimer = Date.now();
      player.hasBall = false;
      console.log("Tir D lancé : direction", dx, dy);
    }
    if (keysPressed["q"]) {
      const { dx, dy } = getDirectionFromArrows();
      ball.vx = dx * SHOOT_SPEED * 0.8;
      ball.vy = dy * SHOOT_SPEED * 0.8;
      ball.lastPossessor = player.id;
      ball.passTimer = Date.now();
      player.hasBall = false;
      console.log("Action Q lancée : direction", dx, dy);
    }
    if (keysPressed["z"]) {
      const { dx, dy } = getDirectionFromArrows();
      ball.vx = dx * PASS_SPEED;
      ball.vy = 0;
      ball.lastPossessor = player.id;
      ball.passTimer = Date.now();
      player.hasBall = false;
      console.log("Action Z lancée : direction", dx, 0);
    }
  } else {
    if (keysPressed["d"]) console.log("Tacle sur l'adversaire proche");
    if (keysPressed["s"]) console.log("Tentative de récupération sur l'adversaire");
  }
}

// --- Boucle principale ---
function update() {
  if (gameState === "kickoff") {
    handleKickoff();
    if (kickoffTeam === "droite" && Date.now() - kickoffStart > 2000) {
      ball.vx = 2;
      ball.vy = 1;
      gameState = "play";
      console.log("Kickoff lancé par l'ordinateur (droite)");
    }
    if (kickoffTeam === "gauche" && Date.now() - kickoffStart > 5000) {
      gameState = "play";
      console.log("Fallback : kickoff forcé en play pour la gauche après 5 secondes.");
    }
  }
  
  if (handleBallOut()) return;
  
  if (gameState === "play") {
    handlePlayerActions();
    players.forEach(player => player.update());
    ball.update();
    
    // AI pour l'équipe de droite : si un joueur rouge possède la balle depuis plus de 2 secondes, il tire vers la gauche.
    const redHolder = players.find(p => p.team === "droite" && p.hasBall);
    if (redHolder && Date.now() - ball.passTimer > 2000) {
      redHolder.hasBall = false;
      ball.vx = -SHOOT_SPEED;  // Tir vers la gauche
      ball.vy = 0;
      ball.lastPossessor = redHolder.id;
      ball.passTimer = Date.now();
      console.log("AI rouge : Tir lancé par le joueur id", redHolder.id);
    }
    
    // Collision pour récupérer le ballon
    players.forEach(player => {
      const dx = player.x - ball.x;
      const dy = player.y - ball.y;
      if (Math.sqrt(dx * dx + dy * dy) < player.radius + ball.radius) {
        const ballSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (ballSpeed > 0.5) return;
        if (ball.lastPossessor === player.id && Date.now() - ball.passTimer < PASS_DELAY) return;
        player.hasBall = true;
        ball.vx = 0;
        ball.vy = 0;
        ball.x = player.x;
        ball.y = player.y;
        ball.lastPossessor = player.id;
        console.log("Le joueur id", player.id, "de l'équipe", player.team, "a récupéré le ballon.");
      }
    });
  }
  
  camera.x = ball.x;
  camera.y = ball.y;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#006600";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawPitch();
  
  ctx.font = "20px Arial";
  ctx.fillStyle = "white";
  ctx.fillText("Score: " + scoreGauche + " - " + scoreDroite, 10, 30);
  
  if (gameState === "kickoff") {
    ctx.font = "40px Arial";
    ctx.fillStyle = "yellow";
    const message = firstKickoff ? "Coup d'envoi (" + kickoffTeam + ")" : "Remise en jeu";
    ctx.fillText(message, canvas.width / 2 - 150, canvas.height / 2);
  }
  if (gameState === "out") {
    ctx.font = "30px Arial";
    ctx.fillStyle = "yellow";
    ctx.fillText("Ball out! (Touche automatique)", canvas.width / 2 - 250, canvas.height / 2);
  }
  
  players.forEach(player => player.draw());
  ball.draw();
}

function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

// --- Initialisation des objets ---
// Créer le ballon et les joueurs AVANT de lancer la boucle de jeu
ball = new Ball(fieldWidth / 2, fieldHeight / 2);

players = [];
let playerId = 0;
const leftPositions = {
  goalkeeper: { x: 5, y: 50 },
  defenders: [
    { x: 20, y: 20 },
    { x: 20, y: 40 },
    { x: 20, y: 60 },
    { x: 20, y: 80 }
  ],
  midfielders: [
    { x: 40, y: 20 },
    { x: 40, y: 40 },
    { x: 40, y: 60 },
    { x: 40, y: 80 }
  ],
  forwards: [
    { x: 60, y: 35 },
    { x: 60, y: 65 }
  ]
};
players.push(new Player(playerId++, "gauche", leftPositions.goalkeeper.x, leftPositions.goalkeeper.y, true));
leftPositions.defenders.forEach(pos => {
  players.push(new Player(playerId++, "gauche", pos.x, pos.y));
});
leftPositions.midfielders.forEach(pos => {
  players.push(new Player(playerId++, "gauche", pos.x, pos.y));
});
leftPositions.forwards.forEach((pos, idx) => {
  const controlled = (idx === 0);
  players.push(new Player(playerId++, "gauche", pos.x, pos.y, false, controlled));
});

const rightPositions = {
  goalkeeper: { x: fieldWidth - 5, y: 50 },
  defenders: [
    { x: 130, y: 20 },
    { x: 130, y: 40 },
    { x: 130, y: 60 },
    { x: 130, y: 80 }
  ],
  midfielders: [
    { x: 110, y: 20 },
    { x: 110, y: 40 },
    { x: 110, y: 60 },
    { x: 110, y: 80 }
  ],
  forwards: [
    { x: 90, y: 35 },
    { x: 90, y: 65 }
  ]
};
players.push(new Player(playerId++, "droite", rightPositions.goalkeeper.x, rightPositions.goalkeeper.y, true));
rightPositions.defenders.forEach(pos => {
  players.push(new Player(playerId++, "droite", pos.x, pos.y));
});
rightPositions.midfielders.forEach(pos => {
  players.push(new Player(playerId++, "droite", pos.x, pos.y));
});
rightPositions.forwards.forEach(pos => {
  players.push(new Player(playerId++, "droite", pos.x, pos.y));
});

// Lancer la boucle de jeu
gameLoop();
