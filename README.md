# Multiplayer Card Game

Welcome to the Multiplayer Card Game! This web-based card game allows users to play together in real-time using Web sockets.

To try out a deployed version, you can find it here: https://abyss-ascendant.onrender.com/

## Hosting Information

The game is currently hosted on Render, a platform that may spin down servers when not in use. Please be aware that there might be a noticeable delay when accessing the game if the server needs to spin up.

## Usage

To ensure the best experience, I recommend testing the application with two windows open side by side. This will allow you to observe the real-time interaction implemented using Web sockets.

## Getting Started

1. Clone this repository.

2. Create and activate a virtual environment.

     python -m venv venv

   
     source venv/bin/activate # On Windows, use 'venv\Scripts\activate'


4. Install dependencies.

     pip install -r requirements-dev.txt


6. Start the server. 

     python app.py
