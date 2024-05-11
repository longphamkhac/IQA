import random
import time

import requests
from loguru import logger


def predict():
    logger.info("Sending requests...")
    files = {
        "image": open(
            "/home/long/Documents/Y_Sinh/Data/Gastrite active/Image_5045.png", "rb"
        )
    }
    response = requests.post(
        "http://iqa.system.com/upload-image",
        headers={"accept": "application/json"},
        files=files,
    )
    print(response)


if __name__ == "__main__":
    while True:
        predict()
        time.sleep((random.random() * 2))

    # predict()
