let socket;
let game_state;

let scenes = {
	'room': true,
	"game": false,
	"end": false
}

let canvasWidth = 0
let canvasHeight = 0
let leftEdge = 0
let rightEdge = 0
let MAXGAMEWIDTH = 950
let MAXGAMEHEIGHT = 600
let gameWidth = 0
let gameHeight = 0
let topEdge = 0
let botEdge = 0
let HOVERSCALE = 2
let BORDER = 3
let CORNER = 5
let CARDMARGIN = 3
let CARDWIDTH = 80
let CARDHEIGHT = (CARDWIDTH*3)/2
let isLoading = true
let countLoaded = 0
let isMobile = false

let sectionOne = initGeom()
let sectionTwo = initGeom()
let sectionThree = initGeom()
let sectionFour = initGeom()

let timeTemplate = {
	"value": 0,
	"duration": 0,
}

let playerToHandAnim = initTime(300)
let opponentToHandAnim = initTime(300)
let toPlayAnim = initTime(300)
let toDropAnim = initTime(200)

let cardTemplate = {
	"name": "",
	"id": null,
	'owner': '',
	'location': '',
	"borderColor": 'white',
	"target": initGeom(),
	"curr": initGeom(),
	"anim": null
}

let images = []
let zoomedImages = []
let playerPlayZone = null
let opponentPlayZone = null
let almostPlayerPlayZone = null
let almostOpponentPlayZone = null
let playCardButton = null
let selectCardButton = null
let backToCarousel = null
let htmlElemContainer;

//RELOAD THESE ON NEW GAME
let hand = {
	"player": [],
	"opponent": []
}
let drop = {
	"player": [],
	"opponent": []
}
let almostPlay = {
	"player": null,
	"opponent": null
}
let play = {
	"player": null,
	"opponent": null
}
let amountInHand = {
	"player": 0,
	"opponent": 0
}
let cardHovered = {
	'player': null,
	'opponent': null
}
let carousel = []
let enableSelectButton = false
let selectCardButtonText = "Select"
let lockedIn = false
let prio = ''

function imageLoaded(img) {
	img = getImage(img, CARDWIDTH, CARDHEIGHT);

	let zoomed = { ...cardTemplate };
	zoomed.curr = setGeom(rightEdge, sectionFour - CARDHEIGHT / 2, CARDWIDTH, CARDHEIGHT);
	let enlargedCard = enlargeCard(zoomed, HOVERSCALE);
	let zoomedImage = getImage(img, enlargedCard.width, enlargedCard.height);

	images.push(img);
	zoomedImages.push(zoomedImage);

	countLoaded++;
	if (countLoaded === 1) {
		isLoading = false;
	}
}

function setup() {
	createCanvas(windowWidth, windowHeight)
	setDataDerivedFromScreenSize()

	loadImage("static/images/test-image.png", (img)=>{
		imageLoaded(img);
	});

	socket = io()
	
	socket.on("end-game", ()=>{
		scenes['room'] = false
		scenes['game'] = false
		scenes['end'] = true	

		resetGame()
	})

	socket.on('opponent-hover', (idx)=>{
		if(idx === -1){
			cardHovered['opponent'] = null
			return
		}
		let adjusted_index = hand['opponent'].length - (idx+1)

		cardHovered['opponent'] = hand['opponent'][adjusted_index]
	})

	socket.on('opponent-almost-play', (idx)=>{
		let adjusted_index = hand['opponent'].length - (idx+1)
		let opponentAlmostPlay = hand["opponent"].splice(adjusted_index, 1)[0]

		amountInHand["opponent"] -= 1
		animateCard(opponentAlmostPlay, toPlayAnim, almostOpponentPlayZone)
		almostPlay["opponent"] = opponentAlmostPlay
	})

	socket.on('opponent-took-back', ()=>{
		hand['opponent'].push(almostPlay['opponent'])
		resetTime(opponentToHandAnim)

		almostPlay["opponent"] = null
	})

	socket.on("new-game-state", (data)=>{
		if(data["player-drawn-cards"]){
			resetTime(playerToHandAnim)	
			for(let i = 0; i < data["player-drawn-cards"].length; i++){
				let newCard = {...cardTemplate}
				newCard.name = data["player-drawn-cards"][i].name
				newCard.id = data["player-drawn-cards"][i].id
				newCard.owner = 'player'
				newCard.location = 'hand'
				newCard.color = random([color('red'),color('green'),color('blue')])
				newCard.curr = setGeom(rightEdge, sectionThree-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
				newCard.anim = playerToHandAnim
				hand["player"].push(newCard)
			}
		}

		if(data["opponent-drawn-cards"]){
			resetTime(opponentToHandAnim)	
			let amountAdded = data["opponent-drawn-cards"].length
			for(let i = 0; i < amountAdded; i++){
				let newCard = {...cardTemplate}
				newCard.color = random([color('red'),color('green'),color('blue')])
				newCard.curr = setGeom(leftEdge, sectionTwo-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
				newCard.anim = playerToHandAnim
				hand["opponent"].push(newCard)
			}
		}

		if(data['player-dropped-cards']){
			data['player-dropped-cards'].forEach((card_id)=>{
				if(play["player"] && card_id == play['player'].id){         
					drop["player"].push(play["player"])
					animateCard(drop["player"][drop["player"].length-1], toDropAnim, playerDropZone)

					drop['player'].owner = 'player'
					drop['player'].location = 'drop'
				}
			})
		}

		if(data['opponent-dropped-cards']){
			data['opponent-dropped-cards'].forEach((card_id)=>{
				if(play["opponent"] && card_id == play['opponent'].id){         
					drop["opponent"].push(play["opponent"])
					animateCard(drop["opponent"][drop["opponent"].length-1], toDropAnim, opponentDropZone)

					drop['opponent'].owner = 'opponent'
					drop['opponent'].location = 'drop'
				}
			})
		}

		if(data["player-played-card"]){
			play["player"] = almostPlay["player"]
			almostPlay["player"] = null
			animateCard(play["player"], toPlayAnim, playerPlayZone)
			
			play['player'].owner = 'player'
			play['player'].location = 'play'
		}

		if(data['opponent-played-card']){
			play["opponent"] = almostPlay["opponent"]
			play["opponent"].name = data['opponent-played-card'].name
			play['opponent'].id = data['opponent-played-card'].id
			almostPlay["opponent"] = null

			animateCard(play["opponent"], toPlayAnim, opponentPlayZone)

			play['opponent'].owner = 'opponent'
			play['opponent'].location = 'play'
		}

		if(data['choices-needed']){
			let cards = []
			data['choices-needed']['cards'].forEach((card_id)=>{
				let cardsToCheck = [...drop['player'], ...drop['opponent'], ...hand['player'],
					play['player'], play['opponent'], almostPlay['player'], almostPlay['opponent']]
				let foundCard = cardsToCheck.find((droppedCard) => droppedCard.id === card_id)
				if(foundCard){
					cards.push(JSON.parse(JSON.stringify(foundCard)))
				}
			})
			amountCanClick = data['choices-needed']['amount']
			carousel = cards
			enableClickCarousel = true
			enableSelectButton = true
		}

		lockedIn = !data['can-play']

		prio = data['prio']
	})

	let joinRoomInput = createInput()
	let joinRoomButton = createButton('Join Room')
	let createRoomButton = createButton('Create Room')
	let createRoomDiv = createDiv()
	createRoomDiv.child(createRoomButton)
	let roomKeyText = createP('Room Key:')
	roomKeyText.style('color', 'white')
	let goBackButton = createButton("Go Back")
	let fullscreenCheckbox = createCheckbox('fullscreen')
	fullscreenCheckbox.style('color', 'white')
	let goBackDiv = createDiv()
	goBackDiv.child(roomKeyText)
	goBackDiv.child(goBackButton)
	goBackDiv.style('display', 'none')

	htmlElemContainer = select('#app-container')
	let joinRoomContainer = createDiv()
	joinRoomContainer.child(joinRoomInput)
	joinRoomContainer.child(joinRoomButton)
	htmlElemContainer.child(joinRoomContainer)
	htmlElemContainer.child(fullscreenCheckbox)
	htmlElemContainer.child(createRoomDiv)
	htmlElemContainer.child(goBackDiv)

	htmlElemContainer.style('position', 'absolute')
	htmlElemContainer.style('width', '100%')
	htmlElemContainer.style('height', '100%')
	htmlElemContainer.style('display', 'flex')
	htmlElemContainer.style('flex-wrap', 'wrap')
	htmlElemContainer.style('justify-content', 'space-around')
	htmlElemContainer.style('align-items', 'center')

	joinRoomButton.mousePressed(()=>{
		if(joinRoomInput.value() === ''){
			return
		}
		socket.emit('enter-room', joinRoomInput.value())
		joinRoomInput.elt.value = ''

		if(fullscreenCheckbox.checked()){
			fullscreen(true)	
		} else if(fullscreen()){
			fullscreen(false)
		}
	})

	joinRoomInput.elt.addEventListener('keydown', ()=>{
		if (event.keyCode === 13) {
			if(joinRoomInput.value() === ''){
				return
			}
			socket.emit('enter-room', joinRoomInput.value())
			joinRoomInput.elt.value = ''

			if(fullscreenCheckbox.checked()){
				fullscreen(true)	
			} else if(fullscreen()){
				fullscreen(false)
			}
		}
	})

	createRoomButton.mousePressed(()=>{
		socket.emit('create-room')

		if(fullscreenCheckbox.checked()){
			fullscreen(true)	
		} else if(fullscreen()){
			fullscreen(false)
		}
	})

	goBackButton.mousePressed(()=>{
		socket.emit('exit-room')
	})

	socket.on('join-room-success', (roomKey)=>{
		createRoomDiv.style('display', 'none')
		joinRoomContainer.style('display', 'none')
		fullscreenCheckbox.style('display', 'none')

		goBackDiv.style('display', 'flex')
		goBackDiv.style('flex-direction', 'column')
		goBackDiv.style('align-items', 'center')

		roomKeyText.elt.innerText = 'Room Key: ' + roomKey
	})

	socket.on('join-room-failure', ()=>{
		goBackDiv.style('display', 'none')

		createRoomDiv.style('display', 'block')
		joinRoomContainer.style('display', 'block')
		fullscreenCheckbox.style('display', 'block')
	})

	socket.on('start-game', ()=>{
		htmlElemContainer.style('display', 'none')

		scenes['room'] = false
		scenes['game'] = true
		scenes['end'] = false	
	})
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
	setDataDerivedFromScreenSize()	
}

function setDataDerivedFromScreenSize() {
	canvasWidth = windowWidth
	canvasHeight = windowHeight

	gameWidth = min(canvasWidth, MAXGAMEWIDTH)
	gameHeight = min(canvasHeight, MAXGAMEHEIGHT)

	topEdge = (canvasHeight-gameHeight)/2
	botEdge = (canvasHeight-gameHeight)/2 + gameHeight

	let halfSectionHeight = 0.25*gameHeight/2
	sectionOne = halfSectionHeight + topEdge
	sectionTwo = 0.25*gameHeight + halfSectionHeight + topEdge
	sectionThree = 0.5*gameHeight + halfSectionHeight + topEdge
	sectionFour = 0.75*gameHeight + halfSectionHeight + topEdge

	rightEdge = ((canvasWidth-gameWidth+1)/2 + gameWidth)-CARDWIDTH-CARDMARGIN-BORDER
	leftEdge = (canvasWidth-gameWidth)/2+CARDMARGIN+BORDER

	playCardButton = setGeom((canvasWidth/2)-(CARDWIDTH/2), sectionOne-CARDHEIGHT/4,
		CARDWIDTH, CARDHEIGHT/2)
	let selectWidth = playCardButton.width + (playCardButton.width/2)
	let selectHeight = playCardButton.height
	selectCardButton = setGeom(canvasWidth/2 - (selectWidth/2), sectionFour-selectHeight/2, selectWidth, selectHeight)

	almostPlayerPlayZone = setGeom(canvasWidth/2, sectionThree-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
	almostOpponentPlayZone = setGeom(canvasWidth/2, sectionTwo-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
	playerDropZone = setGeom(rightEdge, sectionTwo-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
	opponentDropZone = setGeom(leftEdge, sectionThree-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
	playerPlayZone = setGeom(canvasWidth/2-(CARDWIDTH/2), sectionThree-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
	opponentPlayZone = setGeom(canvasWidth/2-(CARDWIDTH/2), sectionTwo-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
}

function draw() {
	background(0)

	if(scenes["game"] && isLoading){
		textSize(16)
		fill(color('white'))
		textAlign(CENTER, CENTER);
		text('Loading', canvasWidth/2, canvasHeight/2)
		noStroke()
	} else if(scenes["game"]){

		fill(color("white"))
		// //player deck
		rect(rightEdge, sectionThree-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
		// //opponent deck
		rect(leftEdge, sectionTwo-CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)

		if(!draggedCard){
			amountInHand["player"] = animateCardToHand(hand["player"], 
				sectionFour-CARDHEIGHT/2, amountInHand["player"], playerToHandAnim)
		}
		
		amountInHand["opponent"] = animateCardToHand(hand["opponent"], 
			sectionOne-CARDHEIGHT/2, amountInHand["opponent"], opponentToHandAnim)
		renderAllCards()

		drawCarousel()

		if((!draggedCard && !isMobile && didTimeFinish(playerToHandAnim)) || 
			(isMobile && canHover && didTimeFinish(playerToHandAnim)))
		{
			findHoveredCard()
			renderHoveredCards()
		} 

		updateTime(playerToHandAnim)
		updateTime(opponentToHandAnim)
		if(didTimeFinish(playerToHandAnim) && didTimeFinish(opponentToHandAnim)){
			updateTime(toDropAnim)
		}
		if(didTimeFinish(toDropAnim)){
			updateTime(toPlayAnim)
		}

		//ready button
		if(almostPlay['player']){
			let lockedInColor = lockedIn ? "orange" : "yellow"
			fill(color('purple'))
			stroke(lockedInColor)
			rect(playCardButton.x-CARDMARGIN*2, playCardButton.y-CARDMARGIN*2,
				playCardButton.width+CARDMARGIN*2, playCardButton.height+CARDMARGIN*2, 10)

			let lockedInText = lockedIn ? "locked in" : 'play card'
			textSize(getFittedTextHeight(lockedInText, playCardButton.width, playCardButton.height))

			fill(lockedInColor)
			textAlign(CENTER, CENTER);
			text(lockedInText, playCardButton.x + (playCardButton.width/2)-CARDMARGIN,
				playCardButton.y + (playCardButton.height/2)-CARDMARGIN)
			noStroke()
		}

		//select button
		if(enableSelectButton){
			fill(color('black'))
			rect(selectCardButton.x, selectCardButton.y, selectCardButton.width, selectCardButton.height)

			noFill()
			stroke(color('white'))
			rect(selectCardButton.x, selectCardButton.y, selectCardButton.width, selectCardButton.height)

			textSize(getFittedTextHeight(selectCardButtonText, selectCardButton.width, selectCardButton.height))
			fill(color('white'))
			textAlign(CENTER, CENTER);
			text(selectCardButtonText, canvasWidth/2, selectCardButton.y + (selectCardButton.height/2))
		}

		if(prio != ""){
			noStroke()
			fill(color(255,255,0,50))
			if(prio == 'player'){
				rect(0, canvasHeight-40, canvasWidth, 50, )
			} else if(prio == 'opponent'){
				rect(0, -10, canvasWidth, 50)
			}
			stroke(1)
		}
	} else if(scenes["end"]){
		background(0)

		let buttonWidth = canvasWidth/4
		let buttonHeight = canvasHeight/5

		fill(color("white"))
		rect(canvasWidth/2 - (buttonWidth/2), canvasHeight/2 - (buttonHeight/2), buttonWidth, buttonHeight)

		textSize(getFittedTextHeight("Go Agin", buttonWidth, buttonHeight))
		fill(color("red"))
		textAlign(CENTER, CENTER);
		text("Go Agin", canvasWidth/2, canvasHeight/2)
	}
}

let recordMouseWheel = false
let mouseWheelCurrent = 0
let mouseWheelMax = 0
let MOUSEWHEELSENS = 0.3
function mouseWheel(event){
	if(!recordMouseWheel){
		mouseWheelCurrent = 0
		return
	}

	let enlargedGeom = enlargeCard(carousel[0], HOVERSCALE)

	if(mouseWheelCurrent + (event.delta * MOUSEWHEELSENS) > -mouseWheelMax*0.5 + enlargedGeom.width/2 &&
		(mouseWheelCurrent + (event.delta * MOUSEWHEELSENS) < mouseWheelMax*0.5 - enlargedGeom.width/2))
	{
		mouseWheelCurrent += (event.delta * MOUSEWHEELSENS)
	}
}

function drawCarousel(){
	if(carousel.length == 0){
		return
	}
	let enlargedGeom = enlargeCard(carousel[0], HOVERSCALE)
	let totalLength = carousel.length * CARDWIDTH

	let spaceTakenByEnlarged = carousel.length * enlargedGeom.width

	let scrollableMax = ((carousel.length*enlargedGeom.width) + ((carousel.length-1)*enlargedGeom.width/3))
	mouseWheelMax = scrollableMax

	let extraSpace = (gameWidth-totalLength)/(carousel.length+1)
	if((gameWidth-spaceTakenByEnlarged)/(carousel.length+1) > enlargedGeom.width/3){
		carousel.forEach((card, i)=>{
			if(i == 0){
				card.curr.x = (extraSpace * (i + 1)) + leftEdge
			}else{
				card.curr.x = (extraSpace * (i + 1)) + (card.curr.width*i) + leftEdge
			}
			card.curr.y = (canvasHeight-card.curr.height)/2

			card.target = {...card.curr}
		})
	} else {
		let leftSide = (canvasWidth/2) - (scrollableMax/2)
		let centerSmallInEnlarge = ((enlargedGeom.width-CARDWIDTH)/2)

		carousel.forEach((card, i)=>{
			let baseX = leftSide + i*enlargedGeom.width + (i*enlargedGeom.width/3) + centerSmallInEnlarge
			card.curr.x = baseX + mouseWheelCurrent 
			card.curr.y = (canvasHeight-card.curr.height)/2

			card.target = {...card.curr}
		})
		recordMouseWheel = true
	}
	carousel.forEach((card)=>{
		//Card
		noStroke()
		fill(color(card.borderColor))
		rect(enlargeCard(card, HOVERSCALE).x-BORDER, enlargeCard(card, 
			HOVERSCALE).y-BORDER, enlargeCard(card, HOVERSCALE).width+2*BORDER, 
			enlargeCard(card, HOVERSCALE).height+2*BORDER, CORNER)
		image(zoomedImages[0], enlargeCard(card, HOVERSCALE).x, enlargeCard(card, HOVERSCALE).y)

		//Extra Info
		let ownerAndLocationText = card.owner + ', ' + card.location
		textSize(getFittedTextHeight(ownerAndLocationText, (enlargeCard(card, HOVERSCALE).width+2*BORDER),
				(enlargeCard(card, HOVERSCALE).width+2*BORDER)/7))

		fill(color('yellow'))
		textAlign(CENTER, BOTTOM)
		text(ownerAndLocationText, enlargeCard(card, HOVERSCALE).x-BORDER + (enlargeCard(card, HOVERSCALE).width+2*BORDER)/2,
			enlargeCard(card, HOVERSCALE).y-BORDER)

		//Clicked Icons
		let indexOfClickedCard = cardsClicked.indexOf(card)
		if(indexOfClickedCard != -1){
			fill(color('purple'))
			circle(enlargeCard(card, HOVERSCALE).x-BORDER, enlargeCard(card, HOVERSCALE).y-BORDER, 
				(enlargeCard(card, HOVERSCALE).width+2*BORDER)/6)

			let displaySelectIndex = (indexOfClickedCard+1).toString()
			textSize(getFittedTextHeight(displaySelectIndex, (enlargeCard(card, HOVERSCALE).width+2*BORDER)/6,
				(enlargeCard(card, HOVERSCALE).width+2*BORDER)/6))
				
			fill(color('yellow'))
			textAlign(CENTER, CENTER);
			text(displaySelectIndex, enlargeCard(card, HOVERSCALE).x-BORDER, enlargeCard(card, HOVERSCALE).y-BORDER)
		}
	})
}



let storeCarousel = []
let enableClickCarousel = false
let cardsClicked = []
let amountCanClick = 0
function mouseClicked(){
	if(scenes["game"]){
		if(mouseX > playCardButton.x &&
			mouseX < playCardButton.x + playCardButton.width &&
			mouseY > playCardButton.y && 
			mouseY < playCardButton.y + playCardButton.height)
		{
			if(!almostPlay['player'] || lockedIn || carousel.length > 0){
				carousel = []
				return
			}
			socket.emit('normal-play', almostPlay['player'].id)
			lockedIn = true
		}

		if(mouseX > selectCardButton.x &&
			mouseX < selectCardButton.x + selectCardButton.width &&
			mouseY > selectCardButton.y && 
			mouseY < selectCardButton.y + selectCardButton.height &&
			enableSelectButton)
		{
			if(carousel.length > 0 && cardsClicked.length > 0){
				socket.emit('made-choices', cardsClicked.map((card)=>card.id))

				storeCarousel = []
				carousel = []
				enableClickCarousel = false
				enableSelectButton = false
				recordMouseWheel = false
			} else {
				carousel = storeCarousel 			//clicked select without choices or while out of carousel
			}

			cardsClicked.forEach((card)=>{card.borderColor = 'white'})
			cardsClicked = []
			selectCardButtonText = "Select"
			cardHovered['player'] = null
			return
		} else if(enableSelectButton){
			selectCardButtonText = "Browse"
		}

		let didClickDrop = false
		if(drop['player'].length > 0 &&
			mouseX > drop['player'][drop['player'].length-1].target.x &&
			mouseX < drop['player'][drop['player'].length-1].target.x + drop['player'][drop['player'].length-1].target.width &&
			mouseY > drop['player'][drop['player'].length-1].target.y && 
			mouseY < drop['player'][drop['player'].length-1].target.y + drop['player'][drop['player'].length-1].target.height &&
			carousel.length == 0)
		{
			carousel = drop['player'].map(obj => Object.assign({}, obj))
			didClickDrop = true
		} else if( drop['opponent'].length > 0 &&
			mouseX > drop['opponent'][drop['opponent'].length-1].target.x &&
			mouseX < drop['opponent'][drop['opponent'].length-1].target.x + drop['opponent'][drop['opponent'].length-1].target.width &&
			mouseY > drop['opponent'][drop['opponent'].length-1].target.y && 
			mouseY < drop['opponent'][drop['opponent'].length-1].target.y + drop['opponent'][drop['opponent'].length-1].target.height &&
			carousel.length == 0)
		{
			carousel = drop['opponent'].map(obj => Object.assign({}, obj))
			didClickDrop = true
		} 

		if(carousel.length == 0 || didClickDrop){
			return
		}

		let didClickAnyCarousel = false
		carousel.forEach((card)=>{
			if(mouseX > enlargeCard(card, HOVERSCALE).x &&
				mouseX < enlargeCard(card, HOVERSCALE).x + enlargeCard(card, HOVERSCALE).width &&
				mouseY > enlargeCard(card, HOVERSCALE).y && 
				mouseY < enlargeCard(card, HOVERSCALE).y + enlargeCard(card, HOVERSCALE).height)
			{
				didClickAnyCarousel = true
				selectCardButtonText = "Select"
				if(!enableClickCarousel){
					return
				}
				card.borderColor = card.borderColor == 'yellow' ? 'white' : 'yellow'

				if(card.borderColor == 'yellow'){
					cardsClicked.push(card)
				} else {
					cardsClicked.splice(cardsClicked.indexOf(card), 1)
				}

				if(cardsClicked.length > amountCanClick) {
					cardsClicked[0].borderColor = 'white'
					cardsClicked.splice(0, 1)
				}
			}
		})
		if(didClickAnyCarousel){
			return
		}

		let didDragCarousel = Math.abs(storeMouseWheelCurrent-mouseWheelCurrent) > 10
		storeMouseWheelCurrent = mouseWheelCurrent

		if(didDragCarousel){
			return
		}
		
		mouseWheelCurrent = 0
		storeCarousel = carousel
		carousel = []
		recordMouseWheel = false
	} else if(scenes["end"]) {
		let buttonWidth = canvasWidth/4
		let buttonHeight = canvasHeight/5

		if(mouseX > (canvasWidth/2 - (buttonWidth/2)) && 
			mouseX < canvasWidth/2 + (buttonWidth/2) && 
			mouseY > canvasHeight/2 - (buttonHeight/2) && 
			mouseY < canvasHeight/2 + (buttonHeight/2))
		{
			scenes['room'] = true
			scenes['game'] = false
			scenes['end'] = false	

			htmlElemContainer.style('position', 'absolute')
			htmlElemContainer.style('width', '100%')
			htmlElemContainer.style('height', '100%')
			htmlElemContainer.style('display', 'flex')
			htmlElemContainer.style('flex-wrap', 'wrap')
			htmlElemContainer.style('justify-content', 'space-around')
			htmlElemContainer.style('align-items', 'center')
		}
	}
}

let draggedCard = null
let canDragCarousel = false
let startMouseX = 0
let storeMouseWheelCurrent = 0
function mousePressed(){
	if(isMobile){
		return
	}

	if(!lockedIn && carousel.length == 0 && !enableSelectButton){
		if(!almostPlay['player']){
			hand["player"].forEach((card)=>{
				if(card && mouseX > card.curr.x && 
					mouseX < card.curr.x + card.curr.width && 
					mouseY > card.curr.y && 
					mouseY < card.curr.y + card.curr.height)
				{
					draggedCard = card
					print('set dragged card')
				}
			})
		} else if(almostPlay['player']){
			if(mouseX > almostPlay['player'].curr.x && 
				mouseX < almostPlay['player'].curr.x + almostPlay['player'].curr.width && 
				mouseY > almostPlay['player'].curr.y && 
				mouseY < almostPlay['player'].curr.y + almostPlay['player'].curr.height)
			{
				draggedCard = almostPlay['player']
			}
		}
	} else if(recordMouseWheel){
		canDragCarousel = true
		startMouseX = mouseX
		storeMouseWheelCurrent = mouseWheelCurrent
	}
}

function mouseDragged(){
	if(isMobile){
		return
	}

	if(draggedCard)
	{
		draggedCard.curr.x = mouseX - (CARDWIDTH/2)
		draggedCard.curr.y = mouseY - (CARDHEIGHT/2)

		draggedCard.target = {...draggedCard.curr}
	} else if(canDragCarousel){
		let enlargedGeom = enlargeCard(carousel[0], HOVERSCALE)
		if(storeMouseWheelCurrent - startMouseX + mouseX > -mouseWheelMax*0.5 + enlargedGeom.width/2 &&
			(storeMouseWheelCurrent - startMouseX + mouseX < mouseWheelMax*0.5 - enlargedGeom.width/2))
		{
			mouseWheelCurrent = storeMouseWheelCurrent - startMouseX + mouseX
		}
	}
}

let backToHand = null
function mouseReleased(){
	if(isMobile){
		return
	}

	socket.emit('player-hover', -1)
	canDragCarousel = false
	startMouseX = 0
	
	if(!draggedCard){
		return
	}

	backToHand = null
	if(hand["player"].includes(draggedCard) && !almostPlay["player"]){
		if(mouseY <= sectionThree){
			let idx = hand['player'].findIndex(element => element === draggedCard)
			hand['player'].splice(idx, 1)

			amountInHand["player"] -= 1

			animateCard(draggedCard, toPlayAnim, almostPlayerPlayZone)
			almostPlay["player"] = draggedCard
		
			socket.emit('almost-play', idx)
		}
		else {
			backToHand = draggedCard
			resetTime(playerToHandAnim)	
		}
	} else if(draggedCard == almostPlay['player'] && !lockedIn){
		if(mouseY > sectionThree+CARDHEIGHT/2){
			hand['player'].push(draggedCard)
			resetTime(playerToHandAnim)

			almostPlay["player"] = null

			socket.emit('took-back')
		} else {
			animateCard(draggedCard, toPlayAnim, almostPlayerPlayZone)
		}
	}
	
	draggedCard = null
	cardHovered['player'] = null
}

let isHandTouched = false
function touchStarted(){
	isMobile = true

	if(mouseX > selectCardButton.x &&
			mouseX < selectCardButton.x + selectCardButton.width &&
			mouseY > selectCardButton.y && 
			mouseY < selectCardButton.y + selectCardButton.height &&
			enableSelectButton)
	{
		cardHovered['player'] = null
		return
	}

	hand["player"].forEach((card)=>{
		if(card && mouseX > card.curr.x-CARDMARGIN-BORDER && 
			mouseX < card.curr.x-CARDMARGIN-BORDER + card.curr.width+2*CARDMARGIN+2*BORDER && 
			mouseY > card.curr.y-CARDMARGIN-BORDER && 
			mouseY < card.curr.y-CARDMARGIN-BORDER + card.curr.height+2*CARDMARGIN+2*BORDER &&
			!(enableSelectButton && selectCardButtonText == 'Select'))
		{	
			cardHovered['player'] = card
			isHandTouched = true
		} 
	})

	if(!isHandTouched){
		cardHovered['player'] = null
	}

	let cards = [almostPlay['player'], almostPlay['opponent'], play['player'], play['opponent']]
	cards.forEach((card)=>{
		if(card && (mouseX > card.curr.x && 
			mouseX < card.curr.x + card.curr.width && 
			mouseY > card.curr.y && 
			mouseY < card.curr.y + card.curr.height))
		{
			 // && !play['player'] == card && !play['opponent'] == card
			if(!enableSelectButton || selectCardButtonText != 'Select'){
				draggedCard = card
				cardHovered['player'] = card
			}
		}
	})

	if(recordMouseWheel){
		canDragCarousel = true
		startMouseX = mouseX
		storeMouseWheelCurrent = mouseWheelCurrent
	}
}

let canHover = true
let isHandStillTouched = false
function touchMoved(event){
	if(isHandTouched && canHover && carousel.length == 0 && 
		!(enableSelectButton && selectCardButtonText == 'Select'))
	{
		let touchedCard = false
		hand["player"].forEach((card, idx)=>{
			if(card && mouseX > card.curr.x-CARDMARGIN-BORDER && 
				mouseX < card.curr.x-CARDMARGIN-BORDER + card.curr.width+2*CARDMARGIN+2*BORDER && 
				mouseY > card.curr.y-CARDMARGIN-BORDER && 
				mouseY < card.curr.y-CARDMARGIN-BORDER + card.curr.height+2*CARDMARGIN+2*BORDER)
			{	
				if(draggedCard != card){
					socket.emit('player-hover', idx)
				}

				draggedCard = card
				touchedCard = true
			} 
		})

		if(touchedCard){
			isHandStillTouched = true
		} else {
			isHandStillTouched = false
		}
	} else if(canDragCarousel){
		let enlargedGeom = enlargeCard(carousel[0], HOVERSCALE)
		if(storeMouseWheelCurrent - startMouseX + mouseX > -mouseWheelMax*0.5 + enlargedGeom.width/2 &&
			(storeMouseWheelCurrent - startMouseX + mouseX < mouseWheelMax*0.5 - enlargedGeom.width/2))
		{
			mouseWheelCurrent = storeMouseWheelCurrent - startMouseX + mouseX
		}
	}

	if(canHover || almostPlay['player'] == draggedCard){
		cardHovered['player'] = draggedCard
	}
	
	if((isHandTouched && !isHandStillTouched && draggedCard != null && !almostPlay['player'] && prio == '') ||
		(draggedCard && draggedCard == almostPlay['player'] && !lockedIn))
	{
		draggedCard.curr.x = mouseX - (CARDWIDTH/2)
		draggedCard.curr.y = mouseY - (CARDHEIGHT/2)

		draggedCard.target = {...draggedCard.curr}

		canHover = false
		cardHovered['player'] = null
	}
}

function touchEnded(){
	if(isHandStillTouched){
		cardHovered['player'] = null
	}

	isHandTouched = false
	canHover = true
	isHandStillTouched = false

	socket.emit('player-hover', -1)
	canDragCarousel = false
	startMouseX = 0
	
	if(!draggedCard){
		return
	}

	backToHand = null
	if(hand["player"].includes(draggedCard) && !almostPlay["player"] && !lockedIn){
		if(mouseY <= sectionThree){
			let idx = hand['player'].findIndex(element => element === draggedCard)
			hand['player'].splice(idx, 1)

			amountInHand["player"] -= 1

			animateCard(draggedCard, toPlayAnim, almostPlayerPlayZone)
			almostPlay["player"] = draggedCard
		
			socket.emit('almost-play', idx)
		}
		else {
			backToHand = draggedCard
			resetTime(playerToHandAnim)	
		}
	} else if(draggedCard == almostPlay['player'] && !lockedIn){
		if(mouseY > sectionThree+CARDHEIGHT/2+BORDER){
			hand['player'].push(draggedCard)
			resetTime(playerToHandAnim)

			almostPlay["player"] = null

			socket.emit('took-back')
		} else {
			animateCard(draggedCard, toPlayAnim, almostPlayerPlayZone)
		}
	}
	
	draggedCard = null
}

function initGeom() {
	return {
		"x": 0,
		"y": 0,
		"width": 0,
		"height": 0
	}
}

function setGeom(x, y, w, h) {
	let geom = initGeom()
	geom.x = x
	geom.y = y
	geom.width = w
	geom.height = h

	return geom
}

function findHandGeom(handCount, section) {
	let handGeom = initGeom()

	handGeom.y = section-CARDHEIGHT/2
	handGeom.width = min(handCount*CARDWIDTH + handCount*(BORDER+CARDMARGIN), gameWidth)
	handGeom.height = CARDHEIGHT+2*BORDER+2*CARDMARGIN

	handGeom.x = canvasWidth/2-handGeom.width/2

	return handGeom
}

function enlargeCard(card, scale){
	let centerX = card.curr.x + card.curr.width / 2;
	let centerY = card.curr.y + card.curr.height / 2;
	let enlargedWidth = card.curr.width * scale;
	let enlargedHeight = card.curr.height * scale;
	let newX = centerX - enlargedWidth / 2;
	let newY = centerY - enlargedHeight / 2;

	let overDrawAmount = 0
	if(newY + enlargedHeight > canvasHeight){
		overDrawAmount = -(newY + enlargedHeight - canvasHeight + CARDMARGIN + BORDER)
	} else if(newY <= 0){
		overDrawAmount = -(newY) + CARDMARGIN + BORDER
	}

	newY += overDrawAmount

	return setGeom(newX, newY, enlargedWidth, enlargedHeight);
}

function renderHoveredCards(){
	if(cardHovered['player']){
		noStroke()
		fill(color(cardHovered['player'].borderColor))
		rect(enlargeCard(cardHovered['player'], HOVERSCALE).x-BORDER, enlargeCard(cardHovered['player'], 
			HOVERSCALE).y-BORDER, enlargeCard(cardHovered['player'], HOVERSCALE).width+2*BORDER, 
			enlargeCard(cardHovered['player'], HOVERSCALE).height+2*BORDER, CORNER)
		image(zoomedImages[0], enlargeCard(cardHovered['player'], HOVERSCALE).x, enlargeCard(cardHovered['player'], HOVERSCALE).y)
	} else if(cardHovered['opponent']){
		noStroke()
		fill(color(cardHovered['opponent'].borderColor))
		rect(enlargeCard(cardHovered['opponent'], HOVERSCALE).x-BORDER, enlargeCard(cardHovered['opponent'], 
			HOVERSCALE).y-BORDER, enlargeCard(cardHovered['opponent'], HOVERSCALE).width+2*BORDER, 
			enlargeCard(cardHovered['opponent'], HOVERSCALE).height+2*BORDER, CORNER)
		image(zoomedImages[0], enlargeCard(cardHovered['opponent'], HOVERSCALE).x, enlargeCard(cardHovered['opponent'], HOVERSCALE).y)
	}	
}

function findHoveredCard(){
	if(carousel.length > 0 || isMobile){
		return
	}
	if(cardHovered['player'] && 
		!((mouseX > cardHovered['player'].x - ((CARDMARGIN/2)+BORDER) &&
		 mouseX < cardHovered['player'].x + cardHovered['player'].width) + ((CARDMARGIN/2)+BORDER)  && 
		(mouseY > cardHovered['player'].y && mouseY < cardHovered['player'].y + cardHovered['player'].height)))
	{
		cardHovered['player'] = null
	}

	if(!cardHovered['player']){
		let cards = allCards()
		
		cards.forEach((card)=>{
			if((card.curr.x != card.target.x) && (card.curr.y != card.target.y)){
				return
			}

			if((mouseX > card.curr.x - ((CARDMARGIN/2)+BORDER) && mouseX < card.curr.x + card.curr.width + ((CARDMARGIN/2)+BORDER)) && 
				(mouseY > card.curr.y && mouseY < card.curr.y + card.curr.height) &&
				!hand['opponent'].includes(card) && !drop['player'].includes(card) && !drop['opponent'].includes(card))
			{
				cardHovered['player'] = card
			}
		})
	}

	if(cardHovered['player']){
		let idx = hand['player'].findIndex(element => element === cardHovered['player'])
		socket.emit('player-hover', idx)
	} else {
		socket.emit('player-hover', -1)
	}
}

function initTime(duration){
	let newTime = {...timeTemplate}
	newTime.duration = duration
	return newTime
}

function updateTime(time){
	time.value += deltaTime
}

function didTimeFinish(time){
	if(!time){
		return false
	}

	return (time.value > time.duration)
}

function resetTime(time){
	time.value = 0
	return time
}

function updatePosAfterAnim(card){
	if(didTimeFinish(card.anim)){
		card.curr = {...card.target}
	}
	
	return card
}

function getLerpValue(time){
	if(didTimeFinish(time)){
		return 1
	}
	return time.value/time.duration
}

function animateHand(hand, handGeom, amountInHand){
	for(let i = 0; i < amountInHand; i++){
		if(!backToHand || (backToHand && hand[i] != backToHand)){
			hand[i].curr = setGeom(hand[i].target.x, hand[i].target.y, hand[i].target.width, hand[i].target.height)
		} 
		hand[i].target = setGeom(max(handGeom.x+(i/amountInHand*handGeom.width), 1),
			handGeom.y+CARDHEIGHT/2, CARDWIDTH, CARDHEIGHT)
	}
}

function animateCardToHand(hand, section, amountInHand, toHandAnim){
	if(didTimeFinish(toHandAnim) && amountInHand < hand.length){
		toHandAnim = resetTime(toHandAnim)
		amountInHand += 1
	}

	let handGeom = findHandGeom(amountInHand, section)
	animateHand(hand, handGeom, amountInHand)

	if(amountInHand == hand.length || !hand[amountInHand]){
		return amountInHand
	}
	hand[amountInHand].target = setGeom(handGeom.x+(amountInHand * CARDWIDTH),
		handGeom.y, CARDWIDTH, CARDHEIGHT)
	hand[amountInHand].anim = toHandAnim

	return amountInHand
}

function animateCard(card, animation, location){
	card.anim = resetTime(animation)

	card.target = {...location}
}

function allCards(){
	let cards = [...hand["player"], ...hand["opponent"]]
	if(play["player"]){
		cards.push(play["player"])
	}
	if(play["opponent"]){
		cards.push(play["opponent"])
	}
	if(drop["player"].length > 0){
		cards.push(drop["player"][drop["player"].length-1])
	}
	if(drop["opponent"].length > 0){
		cards.push(drop["opponent"][drop["opponent"].length-1])
	}
	if(almostPlay["player"]){
		cards.push(almostPlay["player"])
	}
	if(almostPlay["opponent"]){
		cards.push(almostPlay["opponent"])
	}
	return cards
}

function renderAllCards(){
	let cards = allCards()  

	cards.forEach((card)=>{
		if(card.target.x == 0 || card.target.y == 0){
			return
		}

		let t = getLerpValue(card.anim)
		let lerpX = lerp(card.curr.x, card.target.x, t)
		let lerpY = lerp(card.curr.y, card.target.y, t) 

		if(card.anim){
			card = updatePosAfterAnim(card)
		}

		if((almostPlay['player'] == card && draggedCard != card) || 
			almostPlay['opponent'] == card ||
			(almostPlay['player'] == card && draggedCard == card && mouseY < sectionThree + CARDHEIGHT/2) ||
			(draggedCard == card && mouseY < sectionThree))
		{
			tint(255, 128)
			let translucentBackground = color(card.borderColor)
			translucentBackground.setAlpha(128)
			fill(translucentBackground)
		} else {
			fill(color(card.borderColor))
		}
		
		rect(lerpX - BORDER, lerpY - BORDER, CARDWIDTH + 2 * BORDER, CARDHEIGHT + 2 * BORDER, CORNER);

		image(images[0], lerpX, lerpY)
		noTint()
		
	})
}

function getImage(img, width, height){
	let cropWidth = 2/3 * img.width
	let cropHeight = 3/2 * cropWidth

	let maskImage = createGraphics(width, height);
	maskImage.rect(0, 0, width, height, CORNER)

	let croppedImage = img.get((img.width - cropWidth)/2, (img.height - cropHeight)/2, cropWidth, cropHeight);
	croppedImage.resize(width, height);
	croppedImage.mask(maskImage);

	return croppedImage
}

function getFittedTextHeight(text, maxWidth, maxHeight){
	let currentHeight = 0
	textSize(currentHeight)

	while(textWidth(text) < maxWidth && currentHeight < maxHeight){
		currentHeight++
		textSize(currentHeight)
	}

	return currentHeight
}

function resetGame(){
	hand = {
		"player": [],
		"opponent": []
	}
	drop = {
		"player": [],
		"opponent": []
	}
	almostPlay = {
		"player": null,
		"opponent": null
	}
	play = {
		"player": null,
		"opponent": null
	}
	amountInHand = {
		"player": 0,
		"opponent": 0
	}
	cardHovered = {
		'player': null,
		'opponent': null
	}
	carousel = []
	enableSelectButton = false
	selectCardButtonText = "Select"
	lockedIn = false
	prio = ''
}