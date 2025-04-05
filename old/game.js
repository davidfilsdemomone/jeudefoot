// Récupération du canvas et configuration du contexte
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Paramètres pour la projection isométrique
const isoScaleX = 0.7;
const isoScaleY = 0.35;
const offsetX = canvas.width / 2;
const offsetY = 50;

// Conversion d'une coordonnée terrain (x,y) en coordonnées isométriques sur le canvas
function toIso(x, y) {
  return {
    x: (x - y) * isoScaleX + offsetX,
    y: (x + y) * isoScaleY + offsetY
  };
}

// États du jeu : "kickoff" (coup d'envoi), "play" (en cours), "goal" (but marqué, à développer)
let gameState = "kickoff";
const kickoffDuration = 3000; // Durée du coup d'envoi en millisecondes
let kickoffStart = Date.now();

// Classe représentant un joueur
class Player {
  constructor(id, team, x, y, isGoalkeeper = false, controlled = false) {
    this.id = id;
    this.team = team; // "gauche" ou "droite"
    this.x = x;
    this.y = y;
    this.radius = isGoalkeeper ? 10 : 7;
    this.color = team === "gauche" ? "blue" : "red";
    this.isGoalkeeper = isGoalkeeper;
    this.controlled = controlled; // Pour le joueur du camp de gauche contrôlé par l'utilisateur
    this.speed = 1.5;
    this.hasBall = false;
  }
  
  draw() {
    const pos = toIso(this.x, this.y);
    // Ici, vous pouvez remplacer ce dessin par un sprite personnalisé
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    // Indicateur de possession du ballon
    if (this.hasBall) {
      ctx.strokeStyle = "yellow";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  
  update() {
    // Pour les joueurs non contrôlés (IA), une logique simple pour se rapprocher du ballon
    if (!this.controlled) {
      if (!this.isGoalkeeper) {
        let dx = ball.x - this.x;
        let dy = ball.y - this.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 1) {
          this.x += (dx / dist) * 0.5;
          this.y += (dy / dist) * 0.5;
        }
      } else {
        // Pour les gardiens, rester près de la ligne de but
        if (this.team === "gauche") {
          this.x += (10 - this.x) * 0.1;
        } else {
          this.x += (90 - this.x) * 0.1;
        }
      }
    }
  }
}

// Classe pour le ballon
class Ball {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 4;
    this.vx = 0;
    this.vy = 0;
    this.inAir = false; // Indique si le ballon est en l'air
  }
  
  draw() {
    const pos = toIso(this.x, this.y);
    // Ici aussi, vous pouvez utiliser un sprite de ballon si vous le souhaitez
    ctx.beginPath();
    ctx.fillStyle = "white";
    ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  update() {
    // Mise à jour de la position en fonction de la vélocité
    this.x += this.vx;
    this.y += this.vy;
    
    // Application d'une friction basique
    this.vx *= 0.98;
    this.vy *= 0.98;
    
    if (Math.abs(this.vx) < 0.01) this.vx = 0;
    if (Math.abs(this.vy) < 0.01) this.vy = 0;
  }
}

// Création des objets jeu
const players = [];
const ball = new Ball(50, 50); // Position initiale au centre du terrain

// Création des joueurs pour une formation 4-4-2 pour chaque équipe
let playerId = 0;

// Équipe de gauche (1 gardien, 4 défenseurs, 4 milieux, 2 attaquants)
// Les positions sont données en coordonnées "terrain" (à ajuster selon vos besoins)
const leftPositions = {
  goalkeeper: { x: 10, y: 50 },
  defenders: [{ x: 20, y: 30 }, { x: 20, y: 45 }, { x: 20, y: 55 }, { x: 20, y: 70 }],
  midfielders: [{ x: 40, y: 30 }, { x: 40, y: 45 }, { x: 40, y: 55 }, { x: 40, y: 70 }],
  forwards: [{ x: 60, y: 40 }, { x: 60, y: 60 }]
};
players.push(new Player(playerId++, "gauche", leftPositions.goalkeeper.x, leftPositions.goalkeeper.y, true));
leftPositions.defenders.forEach(pos => {
  players.push(new Player(playerId++, "gauche", pos.x, pos.y));
});
leftPositions.midfielders.forEach(pos => {
  players.push(new Player(playerId++, "gauche", pos.x, pos.y));
});
// Pour les attaquants, le premier est contrôlé par l'utilisateur
leftPositions.forwards.forEach((pos, idx) => {
  const controlled = (idx === 0);
  players.push(new Player(playerId++, "gauche", pos.x, pos.y, false, controlled));
});

// Équipe de droite (entièrement contrôlée par l'IA)
const rightPositions = {
  goalkeeper: { x: 90, y: 50 },
  defenders: [{ x: 80, y: 30 }, { x: 80, y: 45 }, { x: 80, y: 55 }, { x: 80, y: 70 }],
  midfielders: [{ x: 60, y: 30 }, { x: 60, y: 45 }, { x: 60, y: 55 }, { x: 60, y: 70 }],
  forwards: [{ x: 40, y: 40 }, { x: 40, y: 60 }]
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

// Gestion des entrées clavier pour le joueur contrôlé
let keysPressed = {};
document.addEventListener("keydown", (e) => {
  keysPressed[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", (e) => {
  keysPressed[e.key.toLowerCase()] = false;
});

// Retourne le joueur contrôlé du camp de gauche
function getControlledPlayer() {
  return players.find(p => p.team === "gauche" && p.controlled);
}

// Gestion des actions du joueur (déplacement, tir, passe, etc.)
function handlePlayerActions() {
  const player = getControlledPlayer();
  if (!player) return;
  
  // Déplacement avec les flèches
  if (keysPressed["arrowup"]) player.y -= player.speed;
  if (keysPressed["arrowdown"]) player.y += player.speed;
  if (keysPressed["arrowleft"]) player.x -= player.speed;
  if (keysPressed["arrowright"]) player.x += player.speed;
  
  // Si le joueur possède le ballon
  if (player.hasBall) {
    // Touche D : tirer (ou reprise de volley si le ballon est en l'air)
    if (keysPressed["d"]) {
      if (ball.inAir) {
        ball.vx = 3;
        ball.vy = -3;
        ball.inAir = false;
      } else {
        ball.vx = 4;
        ball.vy = -2;
      }
      player.hasBall = false;
    }
    // Touche S : passe courte (ou tentative de récupération si on n'a pas le ballon)
    if (keysPressed["s"]) {
      // On transfère simplement le ballon à un coéquipier proche
      const teammate = players.find(p => p.team === "gauche" && p !== player);
      if (teammate) {
        ball.x = teammate.x;
        ball.y = teammate.y;
        player.hasBall = false;
        teammate.hasBall = true;
      }
    }
    // Touche Q : centre ou reprise de la tête
    if (keysPressed["q"]) {
      ball.vx = 3;
      ball.vy = -3;
      player.hasBall = false;
    }
    // Touche Z : passe en profondeur
    if (keysPressed["z"]) {
      ball.vx = 5;
      ball.vy = 0;
      player.hasBall = false;
    }
  } else {
    // Actions quand le joueur ne possède pas le ballon
    if (keysPressed["d"]) {
      console.log("Tacle sur l'adversaire proche");
      // Ici, vous pourrez définir une logique pour détecter l'adversaire le plus proche du ballon
    }
    if (keysPressed["s"]) {
      console.log("Tentative de récupération sur l'adversaire");
      // Logique à implémenter pour subtiliser le ballon
    }
  }
}

// Boucle de mise à jour du jeu
function update() {
  // Gestion du coup d'envoi
  if (gameState === "kickoff") {
    if (Date.now() - kickoffStart > kickoffDuration) {
      gameState = "play";
      // Au coup d'envoi, le ballon reçoit une impulsion initiale
      ball.vx = 2;
      ball.vy = 1;
    }
  }
  
  if (gameState === "play") {
    handlePlayerActions();
    
    // Mise à jour de tous les joueurs
    players.forEach(player => player.update());
    // Mise à jour du ballon
    ball.update();
    
    // Collision simple pour la possession du ballon
    players.forEach(player => {
      let dx = player.x - ball.x;
      let dy = player.y - ball.y;
      if (Math.sqrt(dx * dx + dy * dy) < player.radius + ball.radius) {
        // Pour le joueur contrôlé du camp de gauche, récupérer le ballon
        if (player.team === "gauche" && player.controlled) {
          player.hasBall = true;
          ball.vx = 0;
          ball.vy = 0;
          ball.x = player.x;
          ball.y = player.y;
        }
      }
    });
  }
}

// Fonction de rendu (dessin du terrain, joueurs, ballon, etc.)
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Dessin du terrain
  ctx.fillStyle = "#006600";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Exemple simplifié de dessin des cages
  // Cage gauche
  ctx.fillStyle = "white";
  let leftGoal = toIso(5, 45);
  ctx.fillRect(leftGoal.x - 10, leftGoal.y - 20, 20, 40);
  // Cage droite
  let rightGoal = toIso(95, 45);
  ctx.fillRect(rightGoal.x - 10, rightGoal.y - 20, 20, 40);
  
  // Pendant le coup d'envoi, afficher le message
  if (gameState === "kickoff") {
    ctx.font = "40px Arial";
    ctx.fillStyle = "yellow";
    ctx.fillText("Coup d'envoi", canvas.width / 2 - 100, canvas.height / 2);
  }
  
  // Dessin du ballon
  ball.draw();
  
  // Dessin des joueurs
  players.forEach(player => player.draw());
}

// Boucle principale du jeu
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

gameLoop();
