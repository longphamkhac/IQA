# from utils import *
from pathlib import Path

from Inference.utils import *

downloads_path = str(Path.home() / "Downloads")
documents_path = str(Path.home() / "Documents")


def inferenceOnPatch(model, image):
    model.eval()

    input = Variable(image).to(device)

    output = model(input)
    output = output.detach().cpu().numpy()

    pred = np.argmax(output, axis=1).tolist()
    return pred


def infer_phase2(model, image):
    model.eval()

    image = np.array(image)
    input = test_transforms_phase2(image=image)["image"].unsqueeze(0)  # Optimize

    # input = test_transforms_phase2(image = image)["image"] # Optimize
    # input = torch.from_numpy(input).permute(2, 1, 0).unsqueeze(0)

    input = Variable(input).to(device)

    output = model(input)

    proba, pred = torch.max(F.softmax(output[0]), dim=0)

    return pred, proba


def inferenceOnFrame(model, original):
    # original = original.crop((40, 24, 680, 536))

    # Saving the cropped image to backend
    # if save_img == True:
    #     original.save(image_file)

    width, height = original.size
    Npatch_per_row = height // sizeSub
    Npatch_per_col = width // sizeSub

    coordPatches = [[0, 0]]

    patches = []
    stackPatches = []
    # draw_res = []

    for i in range(0, Npatch_per_row):
        for j in range(0, Npatch_per_col):
            br, bc = coordPatches[-1][0], coordPatches[-1][1]

            patch = original.crop((bc, br, (bc + sizeSub), (br + sizeSub)))

            ### Preprocessing ###
            patch_transform = np.array(patch)
            patch_transform = test_transforms(image=patch_transform)["image"]

            # patch = torch.from_numpy(patch).permute(2, 1, 0)
            ### Preprocessing ###

            stackPatches.append(patch_transform)
            patches.append(patch)

            # draw_res.append([
            #     (bc, br, bc + sizeSub, br + sizeSub)
            # ])

            if j != (Npatch_per_col - 1):
                coordPatches.append(
                    [coordPatches[-1][0], coordPatches[-1][1] + sizeSub]
                )

        if i != (Npatch_per_row - 1):
            coordPatches.append([coordPatches[-1][0] + sizeSub, 0])

    # Convert list of numpy array to torch tensor
    stackPatches = torch.stack(stackPatches, dim=0)  # torch.Size([20, 3, 128, 128])

    res = inferenceOnPatch(model, stackPatches)  # List of output

    nMotion = 0
    for i in range(len(res)):
        if res[i] == 3:
            nMotion += 1

        # draw_res[i][0] = draw_res[i][0] + (res[i], )

    # return original, draw_res, res, nMotion
    return patches, res, nMotion


def show_label_modify(model2, patches, res, image_type):
    # print(image_type)

    outputs_phase2 = []

    # Optimize2
    if image_type == "Good" or image_type == "Excellent":
        for index, patch in enumerate(patches):
            output = res[index]

            ### Predicting phase 2 ###
            if output == 2:  # HQ patch
                pred, _ = infer_phase2(model2, patch)
                pred = pred.item()
            ### Predicting phase 2 ###
            else:
                pred = 4

            outputs_phase2.append(pred)

    else:
        outputs_phase2 = [4 for _ in range(20)]

    return outputs_phase2, patches, image_type


def inference(model, model2, image_file):
    ### Load image ###
    img = Image.open(image_file)
    ### Load image ###

    patches, res, nMotion = inferenceOnFrame(model, img)
    image_type = getImageType(nMotion, res)
    # outputs, _, image_type = show_label(model2, original, draw_res, res, image_type)
    outputs, _, image_type = show_label_modify(model2, patches, res, image_type)

    # print("====== Finish processing ======")

    return outputs, image_type


def processVideo(model, video_file, save_path):
    video_name = video_file.split("/")[-1].split("\\")[-1]  # Azoulay 28032018.mp4
    prefix = video_name.split(".")[0]  # Azoulay 28032018

    # Create a folder with the name is the video_name
    if not os.path.isdir(os.path.join(save_path, prefix)):
        os.mkdir(os.path.join(save_path, prefix))
    save_path = save_path + "/" + prefix

    phase1_dict = {}

    cap = cv2.VideoCapture(video_file)
    nFrame = 0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    framesIndex = []
    max_num_output_image = 1000
    while True:
        # print(f'{nFrame}/{frame_count}')
        ret, frame = cap.read()

        if not ret:
            break

        img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        # Cropping frames
        img_cropped = img.crop((40, 24, 680, 536))

        # Process
        patches, res, nMotion = inferenceOnFrame(model, img_cropped)
        image_type = getImageType(nMotion, res)

        if image_type in ["Good", "Excellent"]:
            # print(f"{nFrame}: {image_type}")

            ### Insert frames index ###
            framesIndex.append(nFrame)

            img.save(save_path + "/" + f"{prefix}_frame_{nFrame}.png")

            # Saving the outputs of phase 1
            phase1_dict[f"{prefix}_frame_{nFrame}.png"] = {
                "res": res,
                "image_type": image_type,
            }

        nFrame += 1

        if nFrame == max_num_output_image:
            # print(f'[INFO] Max image retrieved from Video: {max_num_output_image}')
            break

    # Saving outputs phase 1
    writeJsonFile("", phase1_dict, save_name=f"logging_{prefix}_phase1.json")

    return framesIndex
