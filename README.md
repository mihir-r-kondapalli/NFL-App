# 🏈 NFL-App

An end-to-end toolkit for modeling, simulating, and playing NFL football games using real data, statistical modeling, and reinforcement learning.

This project provides:
- An improved Expected Points (EP) metric (both league-wide and team-specific),
- A framework for simulating team-vs-team matchups using probabilistic play outcomes,
- A text-based football game player with strategy decisions,
- A neural network agent trained via reinforcement learning to play the game optimally.

---

## 1. Features

- **Improved EP Modeling**  
  Computes expected points using recursive field position logic with realistic play distributions based on 2024 `nflfastR` data.

- **Team-Specific Matchups**  
  Simulates how two NFL teams match up, blending offense and defense data to get realistic outcomes by down, distance, and yardline.

- **Text-Based Game Player**  
  A command-line football game using real play distributions, where you (or an agent) call plays and see the result unfold.

- **Reinforcement Learning Agent**  
  Trains a neural network that learns the best play to call (run, pass, punt, field goal) in various game situations.

---

## 2. Repository Structure

Agent/ - This directory is where the reinforcement learning agent is trained. \
leage_data/ - The league wide data is retrieved here. Search tree drive simulations occur here to determine NFL EP vs field position. \
team_data/ - Team by Team EP calculations occur here, both for defense and offense. \
TextSim/ - This is where Agents/Humans play against each other. MatchupSim.py simulates large numbers of games and ObjTextPlayer.py provides an interactive game. \
compare_eps.ipynb - This is where the teams are ranked by their EP ranges. \

---

## 4. Goals
1. Provide a robust EP metric for evaluating decision-making in football.
2. Simulate realistic matchups with probabilistic modeling.
3. Train AI agents to develop NFL game strategies.
4. Offer a fun and educational football game environment for testing strategies.

🙏 Acknowledgments
NFL play-by-play data provided by nflfastR
Neural agent inspired by actor-critic RL methods
EP simulation structure inspired by recursive dynamic programming search trees.
Built by @mihir-r-kondapalli

