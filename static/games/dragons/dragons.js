var myX = 500, myY = 300;
var enemyX=[-252, -278],enemyY=[100, 300];
var curDragon = 0,curEnemy = 0, back = new Image();
var numDragons = 13, numEnemies = 19, fireball=new Image(), fireballX=[],fireballY=[];
var dragons = [], enemies = [], AmountOfFiresOnTheScreen=0, points=0;
var down=false, up=false, alive=true, attack=new Audio(), wings = new Audio(), scream=[], death= new Audio();
death.src = "Death.mp3";
function startScream() {
    newScream = new Audio();
    newScream.src = "Scream.mp3";
    newScream.play();
}

attack.src = "Attack.mp3";
wings.src = "Wings.mp3";
for (var i = 0; i < numDragons; i++) {
    dragons[i] = new Image();
    dragons[i].src = i + ".gif";
}
for(var e = 0; e < numEnemies; e++) {
    enemies[e] = new Image();
    enemies[e].src = e + "enemy.gif";
}
fireball.src = "Fireball.png";
back.src = "back.jpg";
function update() {
    if(alive){
        wings.play();
        if (enemyX.length == 0) {
            enemyX.push(-252 - Math.random() * 200);
            enemyY.push(-100 + Math.random() * (800 - 252));
        }
        if(down==true){
            myY=myY+3;
        }
        if(up==true){
            myY=myY-3;
        }
        for (i = 0; i < enemyX.length; i++) {
            enemyX[i] += 2;
            if (enemyX[i] > 800) {
                enemyX[i] = -252;
                enemyX.push(-252 - Math.random() * 200);
                enemyY.push(-100 + Math.random() * (800 - 252));
                ++points;
            }
            if(areColliding(myX,myY,111,160,enemyX[i],enemyY[i],207,140)){
                alive=false;
                wings.pause();
                death.play();
            }
            for(e=0;e<1000;++e){
                if(areColliding(fireballX[AmountOfFiresOnTheScreen-e],fireballY[AmountOfFiresOnTheScreen-e],90,59,enemyX[i],enemyY[i],252,252)){
                    startScream();
                    enemyX.splice(i, 1);
                    enemyY.splice(i, 1);
                    ++points;
                }
            }
        }
        for(i=0;i<1000;++i){
                fireballX[AmountOfFiresOnTheScreen-i]=fireballX[AmountOfFiresOnTheScreen-i]-10;
        }
    }
	if (!localStorage.highscore){
		localStorage.highscore = 0;
	}
}
function draw() {
    context.drawImage(back,0,0,800,600);
    context.fillStyle = "#ff0000";
    context.font = "50px Tribal Dragon";
    context.fillText("Score:"+points, 25, 55)
   if(localStorage.highscore>0){
        context.fillText("Highscore:"+localStorage.highscore, 25, 110);
   }
    if(alive){
        context.drawImage(dragons[Math.floor(curDragon)], myX, myY, 172, 179);
        curDragon += 1 / 3;
        if (curDragon >= dragons.length) {
            curDragon = 0;
        }
        for (i = 0; i < enemyX.length; i++) {
            context.drawImage(enemies[Math.floor(curEnemy)], enemyX[i], enemyY[i], 252, 252);
        }
        for(i=0;i<1000;++i){
            context.drawImage(fireball, fireballX[AmountOfFiresOnTheScreen-i], fireballY[AmountOfFiresOnTheScreen-i], 90, 59);
        }
        curEnemy += 1 / 3;
        if (curEnemy >= enemies.length) {
            curEnemy = 0;
        }
    }else{
        context.fillStyle = "green";
        context.font = "50px Tribal Dragon";
        context.fillText("GAME OVER", 175, 300);
        context.fillText("press space to try again", 80, 355);
    }
}    
function keydown(key) {
    if(alive){
        if(key==38){
            up=true;
        }
        if(key==40){
            down=true;
        }
    }
}
function keyup(key) {
    if(alive){
        if(key==32){
            fireballX[AmountOfFiresOnTheScreen+1]=myX;
            fireballY[AmountOfFiresOnTheScreen+1]=myY;
            AmountOfFiresOnTheScreen+=1;
            attack.play();
        }    
        if(key==38){
            up=false;
        }
        if(key==40){
            down=false;
        }
    }
    if(alive==false && key==32){
        alive=true;
        if(localStorage.highscore<points){
            localStorage.highscore=points
        }
        for (i = 0; i < enemyX.length; i++) {
            enemyX[i] = -252;
        }
        myX = 500; 
        myY = 300;
        points=0;
    }
}
