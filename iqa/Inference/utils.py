import json
import os
import warnings
from typing import List

import albumentations as A
import cv2
import matplotlib.pyplot as plt
import numpy as np
import torch

# from resnet.resnet import resnet18
# from resnet.resnet_ori import resnet18_ori
import torch.nn as nn
import torch.nn.functional as F
from albumentations.pytorch import ToTensorV2
from Inference.resnet.resnet import resnet18
from Inference.resnet.resnet_ori import resnet18_ori
from PIL import Image
from torch.autograd import Variable

sizeSub = 128
mmean = [0.485, 0.456, 0.406]
sstd = [0.229, 0.224, 0.225]

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

warnings.filterwarnings("ignore")

test_transforms = A.Compose([A.Normalize(mmean, sstd, always_apply=True), ToTensorV2()])

test_transforms_phase2 = A.Compose(
    [
        A.augmentations.crops.transforms.CenterCrop(
            height=112, width=112, always_apply=True
        ),
        A.Normalize(mmean, sstd, always_apply=True),
        ToTensorV2(),
    ]
)

label_map = {0: "Brightness", 1: "Dark", 2: "HQ", 3: "Motion"}

label_map_phase2 = {
    0: "Atrophic gastritis",
    1: "Chronic gastritis",
    2: "Intestinal metaplasia",
    3: "Normal",
    4: "Undefined",
}

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

warnings.filterwarnings("ignore")


def writeJsonFile(save_path, outputs_dict, save_name):
    fileName = os.path.join(save_path, save_name)
    with open(fileName, "w") as fp:
        json.dump(outputs_dict, fp)


def getModel(type_model, PATH_MODEL):
    if type_model == "resnet18":
        model_ft = resnet18(pretrained=False, path_pretrained=None)
        num_ftrs = model_ft.fc.in_features

        model_ft.fc = nn.Sequential(
            nn.Linear(num_ftrs, 96), nn.ReLU(inplace=True), nn.Linear(96, 4)
        )
        model_ft = model_ft.to(device)

        print("Model is loaded! Backbone: ResNet18")

    elif type_model == "resnet18_phase2":
        model_ft = resnet18_ori(pretrained=False, path_pretrained=None)
        num_ftrs = model_ft.fc.in_features

        model_ft.fc = nn.Sequential(
            nn.Linear(num_ftrs, 96), nn.ReLU(inplace=True), nn.Linear(96, 4)
        )
        model_ft = model_ft.to(device)

        print("Model is loaded! Backbone: ResNet18 Phase 2")

    model_ft.load_state_dict(torch.load(PATH_MODEL, map_location=device))
    return model_ft


def getPatches(original):
    # original = original.crop((40, 24, 680, 536))

    width, height = original.size
    Npatch_per_row = height // sizeSub
    Npatch_per_col = width // sizeSub

    coordPatches = [[0, 0]]

    patches = []

    for i in range(0, Npatch_per_row):
        for j in range(0, Npatch_per_col):
            br, bc = coordPatches[-1][0], coordPatches[-1][1]

            patch = original.crop((bc, br, (bc + sizeSub), (br + sizeSub)))

            patches.append(patch)

            if j != (Npatch_per_col - 1):
                coordPatches.append(
                    [coordPatches[-1][0], coordPatches[-1][1] + sizeSub]
                )

        if i != (Npatch_per_row - 1):
            coordPatches.append([coordPatches[-1][0] + sizeSub, 0])

    return patches


def imshow(im):
    plt.imshow(im)
    plt.show()


def threshold_res(nMotion, res):
    types = ["Bad", "Poor", "Fair", "Good", "Excellent"]

    max_regions = extract_hq_regions(res)

    if nMotion > 7:  # Bad
        return types[0]
    else:
        if 7 <= max_regions < 9:  # Good
            return types[3]
        elif max_regions >= 9:  # Excellent
            return types[4]
        elif (5 <= max_regions < 7) or (nMotion < 6):  # Fair
            return types[2]
        elif max_regions < 5:  # Poor
            return types[1]


def getImageType(nMotion, res):
    image_type = threshold_res(nMotion, res)

    return image_type


def extract_hq_regions(res):
    # res.insert(15, -1) # For video
    from collections import deque

    regionsHQ = []
    rows = 4
    cols = 5
    res = np.array(res).reshape(rows, cols)

    q = deque()
    visited = set()
    moves = [[1, 0], [-1, 0], [0, 1], [0, -1]]

    def isvalid(x, y, visited):
        if (
            x < 0
            or y < 0
            or x >= rows
            or y >= cols
            or (x, y) in visited
            or res[x][y] != 2
        ):
            return False

        return True

    def bfs(visited: set, q: deque):
        nHQ = 0
        while q:
            for _ in range(len(q)):
                x, y = q.popleft()
                for i, j in moves:
                    if isvalid(x + i, y + j, visited):
                        q.append((x + i, y + j))
                        visited.add((x + i, y + j))
                        nHQ += 1

        return nHQ

    for i in range(rows):
        for j in range(cols):
            if res[i][j] == 2 and (i, j) not in visited:
                q.append((i, j))
                visited.add((i, j))

                nHQ = bfs(visited, q) + 1

                regionsHQ.append(nHQ)

    return max(regionsHQ) if len(regionsHQ) > 0 else 0


def show_res(image, results, save_path=""):
    offset = 30
    from matplotlib import patches

    fig = plt.figure()
    ax = fig.gca()
    plt.imshow(image)
    for res in results:
        x1, y1, x2, y2, type = (
            res[0][0],
            res[0][1],
            res[0][2],
            res[0][3],
            label_map[res[0][4]],
        )
        p = patches.Rectangle(
            (x1, (y1 + offset)),
            x2 - x1,
            (y2 + offset) - (y1 + offset),
            linewidth=2,
            alpha=0.7,
            linestyle="-",
            edgecolor="green",
            facecolor="none",
        )
        ax.add_patch(p)
        ax.text(
            (x1 + sizeSub // 2),
            (y1 + offset + sizeSub // 2),
            type,
            color="red",
            horizontalalignment="center",
            verticalalignment="center",
        )

    plt.savefig(save_path)
    plt.show()
    # return image


def writeCSVFile(file_path, header):
    import csv

    with open(file_path, "w") as f_object:
        writer = csv.writer(f_object)

        writer.writerow(header)


def saveCSVFile(file_path, nFrame: List):
    from csv import writer

    with open(file_path, "a") as f_object:
        writer_object = writer(f_object)
        writer_object.writerow(nFrame)

        f_object.close()

    print("===== Writing successfully =====")
