from compressed_model import CompressedStrategyModel

# Initialize the model once
model = CompressedStrategyModel()

def predict_action(down, distance, loc, time, score_diff):
    """
    Predict the best football strategy action based on the current game state.
    
    Args:
        down: Current down (1-4)
        distance: Distance to first down
        loc: Current yard line
        time: Remaining time
        score_diff: Score difference
        
    Returns:
        int: Action code (1=RUN, 2=PASS, 3=KICK, 4=PUNT)
    """
    return model.predict(down, distance, loc, time, score_diff)