import io
import json
import os
import random
import time
from datetime import datetime
from glob import glob

from flask import (
    Flask,
    flash,
    jsonify,
    make_response,
    redirect,
    render_template,
    request,
    url_for,
)
from flask_cors import CORS
from Inference.infer import infer_phase2, inference, processVideo, show_label_modify
from Inference.utils import getModel, getPatches, writeJsonFile
from minio import Minio
from opentelemetry.exporter.prometheus import PrometheusMetricReader
from opentelemetry.metrics import set_meter_provider
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from PIL import Image
from prometheus_client import start_http_server

minio_client = Minio(
    # endpoint="datalake-minio:9000",
    endpoint="iqa-datalake:9000",  # out of container
    access_key="minio_access_key",
    secret_key="minio_secret_key",
    secure=False,
)

### Metrics
start_http_server(port=1234, addr="0.0.0.0")

resource = Resource(attributes={SERVICE_NAME: "iqa-prom-svc"})
reader = PrometheusMetricReader()

provider = MeterProvider(resource=resource, metric_readers=[reader])
set_meter_provider(provider)
meter = provider.get_meter("myiqa", "2.1.0")

counter = meter.create_counter(
    name="iqa_request_counter",
    description="Number of IQA request",
)

histogram = meter.create_histogram(
    name="iqa_response_histogram", description="IQA response histogram", unit="seconds"
)

# Initialize temp folder
if not os.path.isdir("static/temp"):
    os.mkdir("static/temp")

currentMode = "auto"
filepath = ""
confirmJson = None
checkPreprocessVideo = False
isPressOkButton = False
uploadedImagesDict = {}
trackingDict = {}
framesIndex = []
count = 0
saveFramesPath = ""

app = Flask(__name__)
CORS(app)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
app.config["SECRET_KEY"] = "5791628bb0b13ce0c676dfde280ba245"
app.config["PREVIEW_IMG"] = "bg.png"
app.config["TEMP_DATA_SAVE_PATH"] = "static/temp/tempData"  # for temporary data
app.config["STATES_SAVE_PATH"] = "static/temp/states"  # for states
app.config["OUTPUT_SAVE_PATH"] = "static/temp/resultsJson"  # for output of model
app.config["PATH_MODEL_PHASE_1"] = "./Inference/net-epoch-76-0.976.pth.tar"
app.config["PATH_MODEL_PHASE_2"] = "./Inference/net-epoch-155-0.89.pth.tar"
app.config["CURRENT_VIDEO_NAME"] = ""
app.config["VIDEOS_NAME"] = []
app.config["FILE_PATH"] = "userdata"
app.config["VIDEO_FILE_PATH"] = ""

# Initialize states folder
if not os.path.isdir(f"{app.config['STATES_SAVE_PATH']}"):
    os.mkdir(f"{app.config['STATES_SAVE_PATH']}")

# Initialize tempData folder
if not os.path.isdir(f"{app.config['TEMP_DATA_SAVE_PATH']}"):
    os.mkdir(f"{app.config['TEMP_DATA_SAVE_PATH']}")

# Initialize resultsJson folder
if not os.path.isdir(f"{app.config['OUTPUT_SAVE_PATH']}"):
    os.mkdir(f"{app.config['OUTPUT_SAVE_PATH']}")

# Initialize count.json file
if not os.path.exists(f"{app.config['STATES_SAVE_PATH']}/count.json"):
    writeJsonFile(
        f"{app.config['STATES_SAVE_PATH']}", {"count": 0}, save_name="count.json"
    )
with open(f"{app.config['STATES_SAVE_PATH']}/count.json") as f:
    countJson = json.load(f)
count = countJson["count"]

# Initialize trackingDict.json file
if not os.path.exists(f"{app.config['STATES_SAVE_PATH']}/trackingDict.json"):
    writeJsonFile(
        f"{app.config['STATES_SAVE_PATH']}", {}, save_name="trackingDict.json"
    )
with open(f"{app.config['STATES_SAVE_PATH']}/trackingDict.json") as f:
    trackingDictJson = json.load(f)
trackingDict = trackingDictJson

# Initialize the currentMode.json file
writeJsonFile(
    f"{app.config['STATES_SAVE_PATH']}",
    {"currentMode": "auto", "current_image_index": 0},
    save_name="currentMode.json",
)


# Disable images and files cache
@app.after_request
def add_header(response):
    response.headers["Pragma"] = "no-cache"
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = "0"
    return response


model = getModel("resnet18", app.config["PATH_MODEL_PHASE_1"])
model2 = getModel("resnet18_phase2", app.config["PATH_MODEL_PHASE_2"])


@app.route("/")
def main():
    image_file = url_for("static", filename="mats/" + app.config["PREVIEW_IMG"])

    return render_template("main.html", image_file=image_file)


@app.route("/confirm", methods=["POST", "GET"])
def confirm():
    global currentMode

    # Updating the currentMode.json file
    currentMode = "auto"
    writeJsonFile(
        f"{app.config['STATES_SAVE_PATH']}",
        {"currentMode": currentMode, "current_image_index": 0},
        save_name="currentMode.json",
    )

    flash("Confirm successfully !", "success")
    return redirect(url_for("main"))


def clear_file(need_removing_files_patterns=[""]):
    for need_removing_file_pattern in need_removing_files_patterns:
        need_removing_files = glob(need_removing_file_pattern)
        for d_name in need_removing_files:
            os.remove(d_name)


@app.route("/home", methods=["POST", "GET"])
def home():
    global trackingDict, count, currentMode

    # Updating the currentMode.json file
    currentMode = "auto"
    writeJsonFile(
        f"{app.config['STATES_SAVE_PATH']}",
        {"currentMode": currentMode, "current_image_index": 0},
        save_name="currentMode.json",
    )

    # Deleting the frames are already confirmed
    for name in trackingDict.keys():
        save_file = trackingDict[name]
        os.remove(save_file)

    clear_file(
        [
            f'./{app.config["TEMP_DATA_SAVE_PATH"]}/uploaded_image_*.png',
            f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.avi',
            f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.mov',
            f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.mp4',
            f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.mpeg',
        ]
    )

    # Reseting the count.json file (Setting back the count variable to 0 and save as the count.json[countJson] file)
    count = 0
    writeJsonFile(
        f"{app.config['STATES_SAVE_PATH']}", {"count": count}, save_name="count.json"
    )

    # Reseting the trackingDict.json file (Setting back the trackingDict dictionary to empty and save as trackingDict.json[trackingDictJson] file)
    trackingDict = {}
    writeJsonFile(
        f"{app.config['STATES_SAVE_PATH']}", trackingDict, save_name="trackingDict.json"
    )

    return redirect(url_for("main"))


@app.route("/upload-image", methods=["POST", "GET"])
def upload_image():
    global model, model2, confirmJson, count, uploadedImagesDict, trackingDict, currentMode

    if request.method == "POST":
        if request.files["image"].filename != "":
            start_time = time.time()
            # try:
            uploadedImagesDict = {}

            outputs_dict = {}

            images = request.files.getlist("image")

            outputs_dict["number_images"] = len(images)
            outputs_dict["data"] = []

            # folder_save_dir = app.config["FILE_PATH"]
            bucket_name = app.config["FILE_PATH"]

            for _, image in enumerate(images):
                confirmJson = None
                # print(f"Count: {count}")

                skip_iter = False
                splits = image.filename.split(".")  # ['Azoulay 28032018_69', 'png']
                extract = splits[0].split("_frame_")[0]  # Azoulay 28032018

                ### Saving uploaded images ###
                image_file = (
                    app.config["TEMP_DATA_SAVE_PATH"]
                    + "/"
                    + f"uploaded_image_{count}.png"
                )

                ### Checking if an image is already confirmed or not
                isFound = minio_client.bucket_exists(bucket_name=bucket_name)
                if isFound:
                    folders = [
                        obj.object_name
                        for obj in minio_client.list_objects(bucket_name=bucket_name)
                    ]
                    for folder in folders:
                        objects = minio_client.list_objects(
                            bucket_name=bucket_name, prefix=folder, recursive=True
                        )
                        for obj in objects:
                            print(f"[INFO] Object name: {obj.object_name}")
                            if "sessionConfirm" in obj.object_name:
                                jsonFile = json.load(
                                    minio_client.get_object(
                                        bucket_name=bucket_name,
                                        object_name=obj.object_name,
                                    )
                                )
                                if (
                                    image.filename
                                    in jsonFile["data"][currentMode].keys()
                                ):
                                    confirmJson = jsonFile
                            else:
                                continue
                else:
                    pass
                ### Checking if an image is already confirmed or not

                if confirmJson is not None:
                    ### Already confirmed image
                    # if image.filename in confirmJson["data"][currentMode].keys():
                    data_dict = confirmJson["data"][currentMode][image.filename]

                    image.save(image_file)

                    img = Image.open(image_file)
                    if img.size != (640, 512):  # Custom
                        img = img.crop((40, 24, 680, 536))
                    else:
                        pass
                    img.save(image_file)

                    trackingDict[image.filename] = image_file

                    # Update the save_name in the sessionConfirm.json
                    data_dict["save_name"] = f"uploaded_image_{count}.png"

                    # print(f'[INFO] Image {data_dict["name"]} is already processed, load from previous works !')

                    # Changing the "already_confirm" status of this image to 1 if press "END SESSION & SAVE"
                    # data_dict["already_confirm"] = 1

                    outputs_dict["data"].append(data_dict)
                    skip_iter = True
                    count += 1

                # For a list of images and not yet confirmed
                if extract not in app.config["VIDEOS_NAME"] and not skip_iter:
                    # print("Not frame")
                    ## print(request_image) # <FileStorage: 'Image_344915.png' ('image/png')>
                    ## print(image.filename) # Image_344915.png

                    #### Saving uploaded images ####
                    if image.filename not in trackingDict.keys():
                        trackingDict[image.filename] = image_file
                        uploadedImagesDict[image_file] = image.filename

                        image.save(image_file)

                        img = Image.open(image_file)
                        if img.size != (640, 512):  # Custom
                            img = img.crop((40, 24, 680, 536))
                        else:
                            pass
                        img.save(image_file)
                        count += 1
                    else:
                        image_file = trackingDict[image.filename]
                        uploadedImagesDict[image_file] = image.filename
                        img = Image.open(image_file)

                    ### Prediction ###
                    results, image_type = inference(model, model2, image_file)
                    ### Prediction ###

                # For video
                elif extract in app.config["VIDEOS_NAME"] and not skip_iter:
                    # print(f"[INFO] The frame comes from {extract.upper()} video")

                    # uploadedImagesDict[image_file] = image.filename

                    f = open(
                        f"{app.config['OUTPUT_SAVE_PATH']}/logging_{extract}_phase1.json"
                    )
                    data = json.load(f)

                    #### Saving uploaded images into static folder ####
                    if image.filename not in trackingDict.keys():
                        trackingDict[image.filename] = image_file
                        uploadedImagesDict[image_file] = image.filename
                        count += 1

                        image.save(image_file)

                        img = Image.open(image_file)
                        if img.size != (640, 512):  # Custom
                            img = img.crop((40, 24, 680, 536))
                        else:
                            pass
                        img.save(image_file)
                    else:
                        image_file = trackingDict[image.filename]
                        uploadedImagesDict[image_file] = image.filename
                        img = Image.open(image_file)

                    # Getting outputs of the image_file
                    patches = getPatches(img)
                    res = data[image.filename]["res"]
                    image_type = data[image.filename]["image_type"]

                    # Processing phase 2
                    results, _, image_type = show_label_modify(
                        model2, patches, res, image_type
                    )

                if not skip_iter:
                    outputs_dict["data"].append(
                        {
                            "name": image.filename,
                            "have_changed": [
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                                -1,
                            ],
                            "save_name": trackingDict[image.filename].split("/")[-1],
                            "quality_type": image_type,
                            "result": results,
                            "time_saved": time.time(),
                            "already_confirm": 0,
                        }
                    )
            label = {"app_name": "iqa-app", "endpoint": "/upload-image"}
            counter.add(1, label)

            end_time = time.time()
            elapsed_time = end_time - start_time

            # Add histogram
            histogram.record(elapsed_time, label)

            writeJsonFile(
                f"{app.config['OUTPUT_SAVE_PATH']}",
                outputs_dict,
                save_name="logging.json",
            )

            # Updating the count.json file
            writeJsonFile(
                f"{app.config['STATES_SAVE_PATH']}", {"count": count}, "count.json"
            )

            # Updating the trackingDict.json file
            writeJsonFile(
                f"{app.config['STATES_SAVE_PATH']}", trackingDict, "trackingDict.json"
            )

            # Updating the currentMode.json file
            writeJsonFile(
                f"{app.config['STATES_SAVE_PATH']}",
                {"currentMode": "auto", "current_image_index": 0},
                save_name="currentMode.json",
            )

            return render_template("after_predict.html")

            # except Exception as e:
            #     #print(e)
            #     flash("Input image has invalid size !", "danger")
            #     return render_template("main.html")

        else:
            pass

    return redirect(url_for("main"))


@app.route("/get_result", methods=["POST", "GET"])
def get_result():
    global uploadedImagesDict, filepath, count, trackingDict, isPressOkButton

    if request.method == "POST":
        sessionConfirm = {}
        sessionConfirm["data"] = {}

        sessionConfirm["data"]["auto"] = {}
        sessionConfirm["data"]["manual"] = {}

        new_result = request.json

        #### Saving with the "auto" mode ####
        for data_dict in new_result["data"]:
            sessionConfirm["data"]["auto"][data_dict["name"]] = data_dict

        #### Saving with the "manual" mode ####
        if os.path.exists(f"{app.config['OUTPUT_SAVE_PATH']}/loggingManual.json"):
            with open(
                os.path.join(f"{app.config['OUTPUT_SAVE_PATH']}", "loggingManual.json")
            ) as confirm_F_Manual:
                data_dict_manual = json.load(confirm_F_Manual)
            sessionConfirm["data"]["manual"] = data_dict_manual

        #### Saving with a random folder name (yyyymmdd_hms_randomNumber)
        ## Using Minio storage layer
        bucket_name = app.config["FILE_PATH"]
        isFound = minio_client.bucket_exists(bucket_name=bucket_name)
        if not isFound:
            print("[INFO] Not found any buckets, create the new one !!!")
            minio_client.make_bucket(bucket_name)

        current_date = datetime.now().strftime("%Y%m%d")
        current_time = datetime.now().strftime("%H%M%S")
        random_number = random.randint(1, 1000)

        for image_name, image_file in trackingDict.items():
            minio_client.fput_object(
                bucket_name=bucket_name,
                object_name=f"{current_date}_{current_time}_{random_number}/{image_name}",
                file_path=image_file,
            )

        json_string = json.dumps(sessionConfirm)
        json_bytes = io.BytesIO(json_string.encode())
        minio_client.put_object(
            bucket_name=bucket_name,
            object_name=f"{current_date}_{current_time}_{random_number}/sessionConfirm.json",
            data=json_bytes,
            length=len(json_bytes.getvalue()),
            content_type="application/json",
        )

        #### Saving with a random folder name (yyyymmdd_hms_randomNumber)

        # Deleting the frames are already confirmed
        for name in trackingDict.keys():
            save_file = trackingDict[name]
            os.remove(save_file)

        clear_file(
            [
                f'./{app.config["TEMP_DATA_SAVE_PATH"]}/uploaded_image_*.png',
                f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.avi',
                f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.mov',
                f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.mp4',
                f'./{app.config["TEMP_DATA_SAVE_PATH"]}/*.mpeg',
            ]
        )

        # Reseting the count.json file (Setting back the count variable to 0 and save as the count.json[countJson] file)
        count = 0
        writeJsonFile(
            f"{app.config['STATES_SAVE_PATH']}",
            {"count": count},
            save_name="count.json",
        )

        # Reseting the trackingDict.json file (Setting back the trackingDict dictionary to empty and save as trackingDict.json[trackingDictJson] file)
        trackingDict = {}
        writeJsonFile(
            f"{app.config['STATES_SAVE_PATH']}",
            trackingDict,
            save_name="trackingDict.json",
        )

        out = {"response": "save successfully"}
        response = make_response(jsonify(out), 200)

        return response


@app.route("/upload-video", methods=["POST", "GET"])
def upload_video():
    global model
    if request.method == "POST":
        if request.files["video"].filename != "":
            # print("Press Upload Video Button for processing Video")
            video = request.files["video"]

            video_file = (
                app.config["TEMP_DATA_SAVE_PATH"]
                + "/"
                + request.files["video"].filename
            )
            video.save(video_file)

            video_filename = request.files["video"].filename
            app.config["CURRENT_VIDEO_NAME"] = video_filename.split(".")[0]
            app.config["VIDEOS_NAME"].append(app.config["CURRENT_VIDEO_NAME"])
            app.config["VIDEO_FILE"] = video_file

            # print(video_filename)

            # flash("Upload video successfully !", "success")
            return render_template("after_uploadVideo.html")
    else:
        pass

    return redirect(url_for("main"))


@app.route("/preprocess-video", methods=["GET"])
def preprocess_video():
    global model, checkPreprocessVideo, framesIndex, filepath, isPressOkButton, saveFramesPath

    # saveFramesPath = app.config["FILE_PATH"] # userdata
    # if os.path.isdir(saveFramesPath) == False:
    #     os.mkdir(saveFramesPath)

    bucket_name = app.config["FILE_PATH"]
    isFound = minio_client.bucket_exists(bucket_name=bucket_name)
    if not isFound:
        minio_client.make_bucket(bucket_name=bucket_name)

    # if len(filepath) > 0:
    framesIndex = processVideo(
        model,
        minio_client,
        bucket_name=bucket_name,
        video_file=app.config["VIDEO_FILE"],
        temp_json_savepath=app.config["OUTPUT_SAVE_PATH"],
    )

    # Changing the status of "checkPreprocessVideo"
    checkPreprocessVideo = True

    flash("Preprocess and save frames successfully !", "success")
    return render_template("after_uploadVideo.html")


@app.route("/process-frames", methods=["GET"])
def process_frames():
    global model2, count, confirmJson, checkPreprocessVideo, uploadedImagesDict, framesIndex, trackingDict, saveFramesPath

    # print(f"Frames index: {framesIndex}")

    ### Checking if the video is already preprocessed and saved ###
    if checkPreprocessVideo:
        uploadedImagesDict = {}

        # filepath = app.config["VIDEO_FILE_PATH"] # File path: /home/long/Documents/CAD_System_for_NBI_endoscope/uploaded_videos

        video_name = app.config["CURRENT_VIDEO_NAME"]  # Video name: Azoulay 28032018

        # frames_folder = os.path.join(saveFramesPath, f"{video_name}")

        outputs_dict = {}

        num_frames = 0
        bucket_name = app.config["FILE_PATH"]
        objects = minio_client.list_objects(
            bucket_name=bucket_name, prefix=video_name, recursive=True
        )
        for _ in objects:
            num_frames += 1

        # outputs_dict["number_images"] = len(os.listdir(frames_folder))

        outputs_dict["number_images"] = num_frames
        outputs_dict["data"] = []

        # folder_save_dir = app.config["FILE_PATH"]

        # print(f"[INFO] The frame comes from {video_name.upper()} video")
        for frameIndex in framesIndex:
            confirmJson = None

            image_name = f"{video_name}_frame_{frameIndex}.png"

            skip_iter = False

            # print(f"Image name: {image_name}") # Image name: Azoulay 28032018_frame_70.png
            # frame_file = os.path.join(saveFramesPath, video_name, image_name)

            ### Saving uploaded images ###
            image_file = (
                app.config["TEMP_DATA_SAVE_PATH"] + "/" + f"uploaded_image_{count}.png"
            )

            ### Checking if an image is already confirmed or not
            isFound = minio_client.bucket_exists(bucket_name=bucket_name)
            if isFound:
                folders = [
                    obj.object_name for obj in minio_client.list_objects(bucket_name)
                ]
                for folder in folders:
                    objects = minio_client.list_objects(
                        bucket_name=bucket_name, prefix=folder, recursive=True
                    )
                    for obj in objects:
                        if "sessionConfirm" in obj.object_name:
                            jsonFile = json.load(
                                minio_client.get_object(
                                    bucket_name=bucket_name, object_name=obj.object_name
                                )
                            )
                            if image_name in jsonFile["data"][currentMode].keys():
                                confirmJson = jsonFile
                        else:
                            continue

            if confirmJson != None:
                # if image_name in confirmJson["data"]["auto"].keys():
                data_dict = confirmJson["data"]["auto"][image_name]

                img_data = minio_client.get_object(
                    bucket_name=bucket_name, object_name=f"{video_name}/{image_name}"
                )
                img_bytes = img_data.read()
                img = Image.open(io.BytesIO(img_bytes))
                if img.size != (640, 512):  # Custom
                    img = img.crop((40, 24, 680, 536))
                else:
                    pass
                img.save(image_file)

                trackingDict[image_name] = image_file

                # Update the save_name in the sessionConfirm.json
                data_dict["save_name"] = f"uploaded_image_{count}.png"

                # print(f'[INFO] Image {data_dict["name"]} is already processed, load from previous works !')

                # Changing the "already_confirm" status of this image to 1 if press "END SESSION & SAVE"
                # data_dict["already_confirm"] = 1

                outputs_dict["data"].append(data_dict)
                skip_iter = True
                count += 1

            # For video
            if not skip_iter:
                uploadedImagesDict[image_file] = image_name

                f = open(
                    f"{app.config['OUTPUT_SAVE_PATH']}/logging_{video_name}_phase1.json"
                )
                data = json.load(f)

                if image_name not in trackingDict.keys():
                    trackingDict[image_name] = image_file
                    uploadedImagesDict[image_file] = image_name
                    count += 1

                    img_data = minio_client.get_object(
                        bucket_name=bucket_name,
                        object_name=f"{video_name}/{image_name}",
                    )
                    img_bytes = img_data.read()
                    img = Image.open(io.BytesIO(img_bytes))
                    if img.size != (640, 512):  # Custom
                        img = img.crop((40, 24, 680, 536))
                    else:
                        pass
                    img.save(image_file)
                else:
                    print("[INFO] In the trackingDic")
                    image_file = trackingDict[image_name]
                    uploadedImagesDict[image_file] = image_name
                    img = Image.open(image_file)

                # Getting outputs of the image_file
                patches = getPatches(img)
                res = data[image_name]["res"]
                image_type = data[image_name]["image_type"]

                # Process phase 2
                results, _, image_type = show_label_modify(
                    model2, patches, res, image_type
                )

            if not skip_iter:
                outputs_dict["data"].append(
                    {
                        "name": image_name,
                        "have_changed": [
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                            -1,
                        ],
                        "save_name": trackingDict[image_name].split("/")[-1],
                        "quality_type": image_type,
                        "result": results,
                        "time_saved": time.time(),
                        "already_confirm": 0,
                    }
                )
                # count += 1

        writeJsonFile(
            f"{app.config['OUTPUT_SAVE_PATH']}", outputs_dict, save_name="logging.json"
        )

        # Updating the count.json file
        writeJsonFile(
            f"{app.config['STATES_SAVE_PATH']}", {"count": count}, "count.json"
        )

        # Updating the trackingDict.json file
        writeJsonFile(
            f"{app.config['STATES_SAVE_PATH']}", trackingDict, "trackingDict.json"
        )

        # Updating the currentMode.json file
        writeJsonFile(
            f"{app.config['STATES_SAVE_PATH']}",
            {"currentMode": "auto", "current_image_index": 0},
            save_name="currentMode.json",
        )

        # Changing the status of the checkPreprocessVideo variable
        checkPreprocessVideo = False

        # Setting the framesIndex list to the empty list
        framesIndex = []

        return render_template("after_predict.html")

    else:
        pass

    return render_template("after_uploadVideo.html")


@app.route("/handle-mode", methods=["GET", "POST"])
def handle_mode():
    global currentMode

    if request.method == "POST":
        try:
            currentModeDict = request.json

            # print(currentModeDict)
            currentMode = currentModeDict["currentMode"]

            # Updating the currentMode.json file
            writeJsonFile(
                f"{app.config['STATES_SAVE_PATH']}", currentModeDict, "currentMode.json"
            )

            out = {"response": "success"}
            response = make_response(jsonify(out), 200)

        except Exception as e:
            # print(f"ERROR: {e}")
            out = {"response": "fail"}
            response = make_response(jsonify(out), 500)

        return response


@app.route("/handle-logging-file", methods=["GET", "POST"])
def handle_logging_file():
    if request.method == "POST":
        try:
            currentLogging = request.json

            writeJsonFile(
                f"{app.config['OUTPUT_SAVE_PATH']}",
                currentLogging,
                save_name="logging.json",
            )
            # print("[INFO] Update logging.json file successfully!")

            out = {"response": "success"}
            response = make_response(jsonify(out), 200)

        except Exception as e:
            # print(f"ERROR: {e}")
            out = {"response": "fail"}
            response = make_response(jsonify(out), 500)

        return response


@app.route("/handle-logging-manual-file", methods=["GET", "POST"])
def handle_logging_manual_file():
    if request.method == "POST":
        try:
            currentLoggingManual = request.json

            writeJsonFile(
                f"{app.config['OUTPUT_SAVE_PATH']}",
                currentLoggingManual,
                save_name="loggingManual.json",
            )

            out = {"response": "success"}
            response = make_response(jsonify(out), 200)

        except Exception as e:
            # print(f"ERROR: {e}")
            out = {"response": "fail"}
            response = make_response(jsonify(out), 500)

        return response


@app.route("/manual-mode", methods=["GET"])
def manual_mode():
    return render_template("after_predict_manual.html")


@app.route("/auto-mode", methods=["GET"])
def auto_mode():
    return render_template("after_predict.html")


def predictPhase2(imgName, boxCoordinates):
    global model2

    img = Image.open(os.path.join(f"{app.config['TEMP_DATA_SAVE_PATH']}", imgName))
    croppedImg = img.crop(
        (boxCoordinates[0], boxCoordinates[1], boxCoordinates[2], boxCoordinates[3])
    )

    pred, _ = infer_phase2(model2, croppedImg)
    out = pred.item()
    return out


@app.route("/handle-coords", methods=["GET", "POST"])
def handle_coords():
    if request.method == "POST":
        try:
            boxCoordsDict = request.json

            imgName = boxCoordsDict["name"]
            boxCoordinates = boxCoordsDict["boxCoordinates"]

            pred = predictPhase2(imgName, boxCoordinates)

            writeJsonFile(
                f"{app.config['OUTPUT_SAVE_PATH']}",
                {"predPhase2": pred},
                "resultPhase2.json",
            )

            out = {"response": "success"}
            response = make_response(jsonify(out), 200)

        except Exception as e:
            # print(f"ERROR: {e}")
            out = {"response": "fail"}
            response = make_response(jsonify(out), 500)

        return response


if __name__ == "__main__":
    app.run(debug=False, port=6789, host="0.0.0.0")
