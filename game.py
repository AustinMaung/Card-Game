import random

class Card:
	def __init__(self, name):
		self.name = name
		self.power = 1

		self.abilities = {}

	def reset(self):
		self.power = 1
		self.tap, self.facedown = False, False

	def __repr__(self):
		return self.name

class GameLoop:
	def __init__(self, players: dict):
		self.players = players

		self.deck = []
		self.hand = []
		self.play = []
		self.drop = []

		self.unresolved = []
		self.choices_for_play = {}
		# self.priority = random.randint(0, 1)
		self.priority = 0 #testing, after draw, prio goes to 0
		self.actual_priority = 0

		self.setup_decks()

	def setup_decks(self):
		for player in self.players:
			cards = [Card(name) for name in self.players[player]]
			for card in cards:
				card.abilities = cards_to_abilities[card.name]
			self.players[player] = cards
			self.deck += self.players[player]

	def get_card(self, key):
		players = list(self.players.keys())
		for card in self.players[players[0]]+self.players[players[1]]:
			if id(card) == key:
				return card

	def move_card(self, card ,location, destination):
		location.remove(card)
		destination.append(card)
		card.reset()

	def draw(self, player, amount):
		if amount < 0:
			raise Exception("can't draw negative amount")

		drawn_cards = []
		for card in reversed(self.deck):
			if len(drawn_cards) == amount:
				break

			if not card in self.players[player]:
				continue

			self.move_card(card, self.deck, self.hand)
			drawn_cards.append(card)

		# return {player: drawn_cards}
		return {"drawn-cards": [id(card) for card in drawn_cards]}

	def play_card(self, player, card):
		in_play = set(self.players[player]).intersection(set(self.play))
		power = 0
		if len(in_play) > 0:
			self.move_card(list(in_play)[0], self.play, self.drop)
			power = list(in_play)[0].power

		self.move_card(card, self.hand, self.play)
		card.power += power

		return {
			'played-cards': [id(card)],
			'dropped-cards': {} if len(in_play) == 0 else [id(card) for card in in_play]
		}

	def did_game_end(self):
		players_lost = []
		for player in self.players:
			if len(set(self.players[player]).intersection(set(self.deck).union(set(self.hand)))) == 0:
				players_lost.append(player)

		if len(players_lost) == len(self.players)-1:
			return {"player-won": list(set(self.players).difference(set(players_lost)))[0]}
		elif len(players_lost) == len(self.players):
			return []

	def run(self, data: dict=None):
		recent_events = {
			'drawn-cards': [],
			'played-cards': [],
			'dropped-cards': []
		}

		# def add_events(events, player):
		def add_events(events):
			if not events:
				return
			for event in events:
				recent_events[event] += events[event]
				
		if data and len(self.unresolved) > 0:
			if 'choices' not in data:
				print('error need choice')
				return
			choices = data['choices']
			ability_to_resolve = self.unresolved.pop()
			add_events(ability_to_resolve(choices))
			self.priority = (self.priority + 1) % 2

			while self.unresolved:
				next_ability = self.unresolved.pop()	#dict

				choices_needed = next_ability['choices-needed']
				if choices_needed:
					recent_events['choices-needed'] = choices_needed
					self.unresolved.append(next_ability['callback'])
					break
				
				self.priority = (self.priority + 1) % 2
				add_events(next_ability['callback']())
			
		if data and "normal-play" in data: #players must both choose a card to play
			self.choices_for_play[data["player"]] = self.get_card(data["normal-play"])
			if len(self.choices_for_play) < len(self.players):
				recent_events["waiting-other-play"] = list(set(self.players.keys()).difference(data["player"]))[0]
			else:
				# before play stuff here

				for player in self.choices_for_play:
					add_events(self.play_card(player, self.choices_for_play[player]))

				# after play stuff here

				player = list(self.players)[self.priority]
				self.unresolved += [ability(self, self.choices_for_play[player]) for ability in self.choices_for_play[player].abilities]

				self.priority = (self.priority + 1) % 2
				player = list(self.players)[self.priority]
				self.unresolved += [ability(self, self.choices_for_play[player]) for ability in self.choices_for_play[player].abilities]
				
				while self.unresolved:
					next_ability = self.unresolved.pop()	#dict

					choices_needed = next_ability['choices-needed']
					if choices_needed:
						recent_events['choices-needed'] = choices_needed
						self.unresolved.append(next_ability['callback'])
						break
					
					add_events(next_ability['callback']())

				self.choices_for_play = {}

		if "waiting-other-play" not in recent_events and len(self.unresolved) == 0:
			for player in self.players:
				amount = 5 - len(set(self.players[player]).intersection(set(self.hand)))
				add_events(self.draw(player, amount))

			winning_player = self.did_game_end()
			if winning_player:
				recent_events["player-won"] = winning_player

			self.actual_priority = (self.priority + 1) % 2
			self.priority = self.actual_priority
		
		recent_events = {event: values for event, values in recent_events.items() if len(values) > 0}

		return recent_events

def example_ability(game, card):
	def inner(choices=None):
		if choices:
			print('choice(s) made:', [game.get_card(card_id) for card_id in choices])
		print('activated', card, 'ability')

	return {
		'callback': inner,
		'choices-needed': {
			'player': list(game.players)[game.priority],
			'text': 'choose one card in play',
			'amount': 1,
			'cards': game.play
		}
	}

cards_to_abilities = {
	'one': [example_ability],
	'two': [example_ability],
	'three': [example_ability],
	'four': [example_ability],
	'five': [example_ability],
	'six': [example_ability],
	'seven': [example_ability],
	'eight': [example_ability],
	'nine': [example_ability],
	'ten': [example_ability]
}

if __name__ == "__main__":
	player1 = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
	player2 = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

	players = {"p1": player1, "p2": player2}

	test = GameLoop(players)

	cards = test.players['p1'] + test.players['p2']

	print(test.run())

	print(test.run({"player": "p1", "normal-play": id(cards[9])}))

	print(test.run({"player": "p2", "normal-play": id(cards[19])}))

	# print(test.deck, test.hand, test.play, test.drop)

	print(test.run({'player': 'p1', 'choices': [id(cards[0])]}))

	print(test.run({'player': 'p2', 'choices': [id(cards[2])]}))

	# print(test.run({"player": "p1", "normal-play": id(cards[1])}))

	# print(test.run({"player": "p2", "normal-play": id(cards[3])}))

	# print(test.deck, test.hand, test.play, test.drop)


