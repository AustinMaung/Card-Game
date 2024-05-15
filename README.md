# Web-Based Card Game

The Web-Based Card Game is a multiplayer card game prototype focusing on real-time gameplay. While the game currently lacks designated rules beyond the basic premise of players losing when they run out of cards, future development aims to refine the gameplay concept. The project showcases several key technologies to enable multiplayer functionality and smooth gameplay experience.

## Features

- Real-time multiplayer gameplay.
- WebSockets for synchronous gameplay across clients.
- Backend logic implemented with Flask framework.
- Frontend utilizing HTML, CSS, and JavaScript, with p5.js for canvas control.

## Known Issues

1. **Loading Time**: The website takes a while to load due to cold start deployment.
2. **Synchronization Challenges**: Maintaining synchronization between clients was difficult during development.
3. **Smooth Interface**: Recreating game animations and UX to provide a seamless gameplay experience was challenging.

## How to Play

1. Open the website.
2. Wait for the game to load.
3. Connect with other players.
4. Start playing the card game.
5. The player who runs out of cards loses.

## Technologies Used

- Flask
- WebSockets
- HTML, CSS, JavaScript
- p5.js

## Demo

[Link to live demo](https://abyss-ascendant.onrender.com/)

## Getting Started

1. Clone this repository.

2. Create and activate a virtual environment.

     python -m venv venv

   
     source venv/bin/activate # On Windows, use 'venv\Scripts\activate'


4. Install dependencies.

     pip install -r requirements-dev.txt


6. Start the server. 

     python app.py
