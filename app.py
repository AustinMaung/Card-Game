from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit, join_room, leave_room, close_room

from game import Card, GameLoop

app = Flask(__name__)
sio = SocketIO(app, cors_allowed_origins=['http://localhost:5000', 'https://abyss-ascendant.onrender.com'])

@app.route("/")
def load_page():
	# print('RENDERING WEBSITE')
	return render_template("game.html")

clients_to_games = {}
clients_to_rooms = {}
rooms_to_clients = {}

cards = {
	"one": Card("one"),
	"two": Card("two"),
	"three": Card("three"),
	"four": Card("four"),
	"five": Card("five"),
	"six": Card("six"),
	"seven": Card("seven"),
	"eight": Card("eight"),
	"nine": Card("nine"),
	"ten": Card("ten"),
}

# @sio.on("connect")
# def join_game():
# 	start_room()

@sio.on('enter-room')
def enter_room(key):
	if key not in rooms_to_clients:
		sio.emit('join-room-failure', room=request.sid)
		return

	sio.emit('join-room-success', key, room=request.sid)
	rooms_to_clients[key].append(request.sid)
	clients_to_rooms[request.sid] = key

	if len(rooms_to_clients[key]) != 2:
		sio.emit('join-room-failure', room=request.sid)
		return

	sio.emit('start-game')
	start_game(key)

@sio.on('create-room')
def create_room():
	key = '9999'
	join_room(key)

	clients_to_rooms[request.sid] = key
	if key in rooms_to_clients:
		sio.emit('join-room-failure', room=request.sid)
	else:
		rooms_to_clients[key] = [request.sid]
		
		sio.emit('join-room-success', key, room=request.sid)

def exit_room(client):
	sio.emit('join-room-failure', room=client)
	if client not in clients_to_rooms:
		return

	room = clients_to_rooms[client]
	rooms_to_clients[room].remove(client)
	clients_to_rooms.pop(client)

	if len(rooms_to_clients[room]) == 0:
		rooms_to_clients.pop(room)
		# sio.close_room(room)

@sio.on('exit-room')
def exit_room_event():
	exit_room(request.sid)

def end_game(room):
	if room not in rooms_to_clients:
		return

	for client in clients_to_rooms:
		sio.emit("end-game", room=client)

	for player in rooms_to_clients[room]:
		if player in clients_to_games:
			clients_to_games.pop(player)

@sio.on("disconnect")
def leave_game():
	if request.sid not in clients_to_rooms:
		return
	room = clients_to_rooms[request.sid]

	exit_room(request.sid)

	if request.sid in clients_to_games:
		end_game(room)
	
def start_game(room):
	# HARD CODED LISTS
	player_one_list = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
	player_two_list = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

	decks = [player_one_list, player_two_list]

	clients_to_decks = {}

	for i, sid in enumerate(rooms_to_clients[room]):
		clients_to_decks[sid] = decks[i % 2]

	game = GameLoop(clients_to_decks)

	for sid in rooms_to_clients[room]:
		clients_to_games[sid] = game

	events = game.run()

	emit_game_state(events, game)

@sio.on('made-choices')
def made_choices(keys):
	player = request.sid
	game = clients_to_games[player]
	move = {
		'player': player,
		'choices': keys
	}
	game_state = game.run(move)
	emit_game_state(game_state, game)

@sio.on("normal-play")
def play_card(key):
	player = request.sid
	game = clients_to_games[player]
	move = {
		"player": player,
		"normal-play": key
	}
	game_state = game.run(move)
	emit_game_state(game_state, game)
	

@sio.on('almost-play')
def almost_play(idx):
	room = clients_to_rooms[request.sid]

	for client in rooms_to_clients[room]:
		if client != request.sid:
			emit('opponent-almost-play', idx, room=client)

@sio.on('took-back')
def took_back():
	room = clients_to_rooms[request.sid]

	for client in rooms_to_clients[room]:
		if client != request.sid:
			emit('opponent-took-back', idx, room=client)

@sio.on('player-hover')
def player_hover(idx):
	if request.sid not in clients_to_rooms:
		return
	room = clients_to_rooms[request.sid]

	for client in rooms_to_clients[room]:
		if client != request.sid:
			emit('opponent-hover', idx, room=client)

def emit_game_state(events, game):
	for player in game.players:
		game_state = {}
		if 'player-won' in events:# LATER: move player out of room
			#update this later to have winner
			end_game(clients_to_rooms[player])
			return

		if 'choices-needed' in events and player == events['choices-needed']['player']:
			game_state['choices-needed'] = {
				'text': events['choices-needed']['text'],
				'amount': events['choices-needed']['amount'],
				'cards': [id(card) for card in events['choices-needed']['cards']]
			}

		if len(game.unresolved) > 0 or player in game.choices_for_play:
			game_state['can-play'] = False
		else:
			game_state['can-play'] = True

		opponent = [plr for plr in game.players if plr != player][0]
		player_card_ids = [id(card) for card in game.players[player]]
		opponent_card_ids = [id(card) for card in game.players[opponent]]
		if "drawn-cards" in events:
			player_drawn_cards = set(player_card_ids).intersection(events["drawn-cards"])
			opponent_drawn_cards = set(opponent_card_ids).intersection(events["drawn-cards"])
			
			if len(player_drawn_cards) > 0:
				game_state["player-drawn-cards"] = [{'name': game.get_card(card_id).name, 'id': card_id} for card_id in player_drawn_cards]

			if len(opponent_drawn_cards) > 0:
				game_state["opponent-drawn-cards"] = ['opponent' for card_id in opponent_drawn_cards]

		if "played-cards" in events:
			player_played_card = list(set(player_card_ids).intersection(events['played-cards']))[0]
			game_state['player-played-card'] = {'name': game.get_card(player_played_card).name, 'id': player_played_card}
			opponent_played_card = list(set(opponent_card_ids).intersection(events['played-cards']))[0]
			game_state['opponent-played-card'] = {'name': game.get_card(opponent_played_card).name, 'id': opponent_played_card}
		if "dropped-cards" in events:
			game_state["player-dropped-cards"] = list(set(player_card_ids).intersection(events["dropped-cards"]))
			game_state["opponent-dropped-cards"] = list(set(opponent_card_ids).intersection(events["dropped-cards"]))

		if len(game.unresolved) > 0:
			if player == list(game.players)[game.priority]:
				game_state['prio'] = 'player'
			elif opponent == list(game.players)[game.priority]:
				game_state['prio'] = 'opponent'
		else:
			game_state['prio'] = ''

		emit("new-game-state", game_state, room=player)

if __name__ == "__main__":
	app.run(debug=True)

# @sio.on("make-room")
# def client_make_room():
#   print("making room")
#   join_room(key)

#   clients_to_rooms[request.sid] = key
#   rooms_to_clients[key] = [request.sid]

# def enough_players(room, min_players=2, max_players=2):
#   if room not in rooms_to_clients:
#       return False

#   amount_players = len(rooms_to_clients[room])
#   return amount_players >= min_players and amount_players <= max_players

# @sio.on("join-room")
# def client_join(room):
#   print("attempting to join", room)
#   if room in rooms_to_clients:
#       print("joined", room)
#       join_room(room)

#       clients_to_rooms[request.sid] = room
#       rooms_to_clients[room].append(request.sid)

#   if enough_players(room):
#       print("starting game")
#       start_game(room)


