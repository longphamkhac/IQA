const actualBtn = document.getElementById('image');

const fileChosen = document.getElementById('file-chosen');
const btnConfirm = document.getElementById('btn_confirm');
const tagOptionBtns = document.querySelector(".options");
const btnPreImg = document.getElementById('btn_previous_image');
const btnNxtImg = document.getElementById('btn_next_image');
const btnChangeMode = document.getElementById("btn_change_mode");
const previewImg = document.getElementById("endoscope-img");

const btn_bounding_box = document.getElementById("btn_bounding_box");
const btn_remove_box = document.getElementById("btn_remove_box");
const btn_modify_box = document.getElementById("btn_modify_box");

let turn_on_hover = false;
let turnOnRadioBtn = false;
let classes = ["Atrophic gastritis", "Chronic gastritis", "Intestinal metaplasia", "Normal", "Uncertain", "Antrophic metaplasia"];

let image_num = 0;
let current_image_name = "";
let image_quality = ""
let current_image_index = -1;
let json_result = null;
let currentMode = null;
let currentType = null;

let img_canvas = null;
let ctx = null;

var x1MouseLastTime = null;
var y1MouseLastTime = null;
var x2MouseLastTime = null;
var y2MouseLastTime = null;

var mousedown = false;

var canvas = document.getElementById("img-canvas");

// Handling drawing bounding box on the canvas
var xMouse = 0
var yMouse = 0
var xPreviewImg = 0
var yPreviewImg = 0
var x1 = xMouse - xPreviewImg - 64;
var y1 = yMouse - yPreviewImg - 64;
var x2 = x1 + 128;
var y2 = y1 + 128;

var rect = canvas.getBoundingClientRect();
xPreviewImg = rect.left;
yPreviewImg = rect.top;

// ======= Initialize for variables of manual mode =======
let x1_Modified = null;
let y1_Modified = null;
let x2_Modified = null;
let y2_Modified = null;

let x1_Drag = null;
let y1_Drag = null;

let countIndex = 0;
let currentPatchIndex = 0;
let isHovering = false;
let isClick = false;
let isSelect = true;
let isModify = false;
// let allowCreate = true;
let alreadyClick = false;
let user_choice = null
let choice = null;
let results = []; // Data
let boxCoordinates = []; // Data
let firstChoices = [];
let isShowAll = false;
let allowDraging = true;
let mouseEnter = null;
let returnResults = {}; // Store all the resturned data
let currentResults = null; // Store the current data

let resultPhase2 = null;
let resultPhase2Selector = null;

let element = null;
let isShowCoords = false;
let results_update = [];
let already_confirm_clear = null;

var grid_container = document.getElementById("grid-items");

function saveResultV2() {
  var url = "http://" + (location.host).toString() + "/get_result";
  var data_json = JSON.stringify(returnResults);

  $.ajax({
    url: url,
    type: 'POST',
    contentType: "application/json",
    data: data_json,

    success: function (data) {
      console.log(data);
      console.log("SUCCESS");

      currentMode = "auto";
      saveCurrentMode();

      // window.location.replace("http://localhost:5000/save-manual");
      window.location.replace("http://" + (location.host).toString() + "/save-manual");
    },
    error: function (e) {
      console.log(e);
      console.log("ERROR");
    }
  });
}

function readTextFile(file) {
  var url = file;
  var j = [];
  $.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) { j = data; },
    async: false
  });
  image_num = j.number_images;
  json_result = j;
  console.log(j);
}

function readLoggingManual(file) {
  var url = file;
  var j = {};
  $.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) { j = data; },
    async: false
  });

  returnResults = j;
}

function readCurrentModeFile(file) {
  var url = file;
  var j = [];
  $.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) { j = data; },
    async: false
  });
  currentMode = j.currentMode;
  current_image_index = j.current_image_index;
  console.log("Current MODE on Front End: " + currentMode);
}

function confirm_result() {
  console.log("Save result !");
  console.log(returnResults);

  // saveResultV2_Manual();
  saveResultV2();
}

function show_file_name() {
  if (current_image_name.length > 20) {
    fileChosen.textContent = current_image_name.substring(0, 5) + "..." + current_image_name.substring(current_image_name.length - 10, current_image_name.length) + ' (' + (current_image_index+1).toString() + '/' + image_num.toString() + ')'
  } else {
    fileChosen.textContent = current_image_name + ' (' + (current_image_index+1).toString() + '/' + image_num.toString() + ')'

  }
}

function init() {
  readTextFile("http://" + (location.host).toString() + "/static/temp/resultsJson/logging.json");
  readCurrentModeFile("http://" + (location.host).toString() + "/static/temp/states/currentMode.json");
  readLoggingManual("http://" + (location.host).toString() + "/static/temp/resultsJson/loggingManual.json");

  if (Object.keys(returnResults).length === 0) {
    returnResults["data"] = {};
  }

  // Initialize the ctx(canvas) if the currentMode === "manual"
  img_canvas = document.getElementById("img-canvas");
  ctx = img_canvas.getContext("2d");
  ctx.globalAlpha = 1.0;
  img = document.getElementById("endoscope-img");
  ctx.drawImage(img, 0, 0);

  if (image_num > 0) {
      // current_image_index = 0;
      update_image();
  }
}

init();

function update_image() {
  current_image_name = json_result.data[current_image_index].name;
  image_quality = json_result.data[current_image_index].quality_type;

  already_confirm_auto = json_result.data[current_image_index].already_confirm;

  if (returnResults.data[current_image_name] === undefined) {
    already_confirm_manual = 0;

    // Initialize already_confirm
    returnResults["data"][current_image_name] = {}
    returnResults["data"][current_image_name]["name"] = current_image_name;
    returnResults["data"][current_image_name]["already_confirm"] = already_confirm_manual;
  }
  else {
    already_confirm_manual = returnResults.data[current_image_name].already_confirm;
  }

  update_confirm_current_image();

  if (returnResults.data[current_image_name].results === undefined) {
    resetNewImage();
  }
  else {
    getPreviousResult();
  }

  show_file_name();

  // ===== Updating the canvas with updated image =====
  previewImg.src = "./static/temp/tempData/" + json_result.data[current_image_index].save_name;

  var img = document.getElementById("endoscope-img");
  ctx.drawImage(img, 0, 0);
  ctx.clearRect(0, 0, 640, 512);

  document.querySelector(".container").classList.remove("disable");

  document.getElementById("h2_image_quality").innerHTML = "Image quality: " + image_quality.toString();

  // update_confirm_current_image();
}

function createDivGridPrevious(index) {
  var div = document.createElement("div");
  div.setAttribute("class", "grid-item");
  div.setAttribute("id", "grid_item_" + (index).toString());

  // Setting the css attribute for this div tag
  div.style.position = "absolute";
  div.style.width = "128px";
  div.style.height = "128px";
  div.style.opacity = "0.6";
  div.style.border = "3px solid rgba(255, 255, 0, 1.5)";
  div.style.left = (boxCoordinates[index][0] + xPreviewImg).toString() + "px";
  div.style.top = (boxCoordinates[index][1] + yPreviewImg).toString() + "px";

  // Adding to the parent tag
  grid_container.appendChild(div);
}

function resetNewImage() {
  // Remove all div child
  grid_container.replaceChildren();

  for (i = 0; i < countIndex; i++) {
    if (document.getElementById("grid_item_" + (i).toString()) !== null) {
      document.getElementById("grid_item_" + (i).toString()).remove();
    }
  }

  countIndex = 0;
  console.log("Not confirm, countIndex of previous image: " + countIndex);
  // Reset the results and boxCoordinates array
  results = [];
  results_update = [];
  boxCoordinates = [];
  firstChoices = [];

  isClick = false;
  isSelect = true;
  setDisabled();
  set_result_selector(-1);
  // allowCreate = true;
  currentPatchIndex = null;
  isHovering = false;

  isShowAll = false;
  // btn_bounding_box.innerText = "Show All Bounding Boxes";
  btn_bounding_box.innerHTML = "<img src='static/mats/6684702.png'  style='width: 25px' />";
  btn_bounding_box.title = "Show all boxes";

  isModify = false;
  btn_modify_box.innerText = "Modify";
}

function getPreviousResult() {
  // Remove all div child
  grid_container.replaceChildren();

  previousImageData = returnResults["data"][current_image_name];

  results = previousImageData.results;
  results_update = previousImageData.results_update;
  boxCoordinates = previousImageData.box_coordinates;

  for(i = 0; i < results.length; i++) {
    if (results[i] !== undefined && results[i] !== null) {
      createDivGridPrevious(i);
      showLabel(i);
    }
  }

  // Adding effects for all previous patches
  document.getElementById("img-canvas").addEventListener("mouseenter", () => {
    if (returnResults["data"][current_image_name] !== undefined) {
      for (i = 0; i < results.length; i++) {
        if (results[i] !== undefined) {
          if (document.getElementById("grid_item_" + (i).toString()) !== null) {
            gridEffect(i);
          }
        }
      }
    }
  })

  countIndex = results.length;
  console.log("Already confirm image, countIndex: " + countIndex.toString());
  // Reset to de-select status

  isClick = false;
  isSelect = true;
  setDisabled();
  set_result_selector(-1);
  // allowCreate = true;
  currentPatchIndex = null;
  isHovering = false;

  isShowAll = false;
  // btn_bounding_box.innerText = "Show All Bounding Boxes";
  btn_bounding_box.innerHTML = "<img src='static/mats/6684702.png'  style='width: 25px' />";
  btn_bounding_box.title = "Show all boxes";

  isModify = false;
  btn_modify_box.innerText = "Modify";
}

btnPreImg.addEventListener("click", () => {
  if (current_image_index > 0) {
    current_image_index = current_image_index - 1;
    update_image();

    document.getElementById("img-canvas").style.backgroundImage = "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')";
    console.log("change canvas img to: " + "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')");
  }
});

btnNxtImg.addEventListener("click", () => {
  if (current_image_index < image_num-1) {
    current_image_index = current_image_index + 1;
    update_image();

    document.getElementById("img-canvas").style.backgroundImage = "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')";
    console.log("change canvas img to: " + "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')");
  }
});


function removeHidden() {
  document.getElementById("already_confirm").innerHTML = "Confirmed (All modes)";
}

function setHidden() {
  document.getElementById("already_confirm").innerHTML = "Not Confirm";
}

function setHidden3() {
  document.getElementById("already_confirm").innerHTML = "Confirmed (Auto)";
}

function setHidden4() {
  document.getElementById("already_confirm").innerHTML = "Confirmed (Manual)";
}

function update_confirm_current_image() {
  if (json_result.data[current_image_index].already_confirm == 1 && returnResults.data[current_image_name].already_confirm == 1) {
    removeHidden();

  }
  else if (json_result.data[current_image_index].already_confirm == 0 && returnResults.data[current_image_name].already_confirm == 0) {
    setHidden();
  }
  else if (json_result.data[current_image_index].already_confirm == 1 && returnResults.data[current_image_name].already_confirm == 0) {
    setHidden3();
  }
  else if (json_result.data[current_image_index].already_confirm == 0 && returnResults.data[current_image_name].already_confirm == 1) {
    setHidden4();
  }
}

function confirmCurrentImage(){
  // console.log(current_image_index);
  returnResults.data[current_image_name].already_confirm = 1 - returnResults.data[current_image_name].already_confirm;

  update_confirm_current_image();
}

function saveCurrentMode() {
  var url = "http://" + (location.host).toString() + "/handle-mode";
  var dataMode_json = JSON.stringify(
    {
      currentMode: currentMode,
      current_image_index: current_image_index
    }
  );

  $.ajax({
    url: url,
    type: "POST",
    contentType: "application/json",
    data: dataMode_json,

    success: function (data) {
        console.log(data);
        console.log("SUCCESS");
    },
    error: function (e) {
      console.log("ERROR");
      console.log(e);
    }
  });
}

function saveLoggingManualFile() {
  var url = "http://" + (location.host).toString() + "/handle-logging-manual-file"
  var json_manual_result_updated = JSON.stringify(
    returnResults
  );

  $.ajax({
    url: url,
    type: "POST",
    contentType: "application/json",
    data: json_manual_result_updated,

    success: function (data) {
        console.log(data);
        console.log("SUCCESS");
    },
    error: function (e) {
      console.log("ERROR");
      console.log(e);
    }
  });
}

// ================================ Perform manual mode ================================
function hiddenLabel(btn_index) {
  if (document.getElementById("grid_item_" + btn_index.toString()).querySelector("p") !== null) {
    document.getElementById("grid_item_" + btn_index.toString()).querySelector("p").hidden = true
  }
}

function effect_option_button(btn_index) {

    document.getElementById( "label_radio_btn_" + btn_index.toString()).addEventListener("click", () => {
      if (turnOnRadioBtn === true) {
      set_result_selector(btn_index);
      radion_btn_change_handle();
      }
    // results_update[selected_patch] = get_result_selector();
    // result_20[selected_patch] = get_result_selector();
    // json_result.data[current_image_index].result = result_20
    // json_result.data[current_image_index].result[selected_patch] = get_result_selector();
    // json_result.data[current_image_index].have_changed[selected_patch] = get_result_selector();
    });

    document.getElementById( "label_radio_btn_" + btn_index.toString()).addEventListener("mouseenter", () => {
      if (turnOnRadioBtn === true) {
      document.getElementById( "label_radio_btn_" + btn_index.toString()).style.color = "rgb(227, 43, 98)"
      }
    });

    document.getElementById( "label_radio_btn_" + btn_index.toString()).addEventListener("mouseleave", () => {
      if (turnOnRadioBtn === true) {
      document.getElementById( "label_radio_btn_" + btn_index.toString()).style.color = "rgb(0, 0, 0)"
      }
    });

}

function set_result_selector(class_type) {
  document.getElementById("radion_button_0").checked = false;
  document.getElementById("radion_button_1").checked = false;
  document.getElementById("radion_button_2").checked = false;
  document.getElementById("radion_button_3").checked = false;
  document.getElementById("radion_button_4").checked = false;
  document.getElementById("radion_button_5").checked = false;

  if (class_type !== -1) {
      document.getElementById("radion_button_" + class_type.toString()).checked = true;
  }
}

function get_result_selector() {
  if (document.getElementById("radion_button_0").checked === true) {
      return 0
  } else if (document.getElementById("radion_button_1").checked === true) {
      return 1
  } else if (document.getElementById("radion_button_2").checked === true) {
      return 2
  } else if (document.getElementById("radion_button_3").checked === true) {
      return 3
  } else if (document.getElementById("radion_button_4").checked === true) {
      return 4
  } else if (document.getElementById("radion_button_5").checked === true) {
      return 5
  };
}

function createDivGrid() {
  var div = document.createElement("div");
  div.setAttribute("class", "grid-item");
  div.setAttribute("id", "grid_item_" + (countIndex).toString());

  // Setting the css attribute for thid div tag
  div.style.position = "absolute";
  div.style.width = "128px";
  div.style.height = "128px";
  div.style.opacity = "0.6";
  div.style.border = "3px solid rgba(255, 255, 0, 1.5)";
  div.style.left = (xMouse - 64).toString() + "px";
  div.style.top = (yMouse - 64).toString() + "px";

  // Adding to the parent tag
  grid_container.appendChild(div);

  // Adding the box coordinate to the array
  boxCoordinates[countIndex] = [
    x1MouseLastTime, y1MouseLastTime, x2MouseLastTime, y2MouseLastTime
  ];

  countIndex += 1;
}

function setDisabled() {
  turnOnRadioBtn = false;
  var inputs = document.getElementsByClassName("option");
  for (var i = 0; i < inputs.length; i++) {
      inputs[i].disabled = true;
  }
}

function removeDisable() {
  turnOnRadioBtn = true;
  var inputs = document.getElementsByClassName("option");
  for (var i = 0; i < inputs.length; i++) {
    inputs[i].disabled = false;
  }
}

function showBoxMenu(btn_index) {
  document.onclick = hideMenu;

  function hideMenu() {
      document.getElementById("boxMenu").style.display = "none";
      btn_remove_box.style.display = "block";
      btn_modify_box.style.display = "block";
  }

  document.getElementById("grid_item_" + (currentPatchIndex).toString()).oncontextmenu = rightClick;

  function rightClick(e) {
      e.preventDefault();

      if (document.getElementById("boxMenu").style.display == "block") {
          hideMenu();
      }
      else if (currentPatchIndex != null && currentPatchIndex === btn_index) {
          var menu = document.getElementById("boxMenu");

          menu.style.display = "block";
          menu.style.left = e.pageX + "px";
          menu.style.top = e.pageY + "px";
      }
  }
}

function showLabel(btn_index) {
  // document.getElementById("grid_item_" + btn_index.toString()).innerHTML = '<p style="opacity: 0.5">' + classes[results[btn_index]] + '</p>';
  // document.getElementById("grid_item_" + btn_index.toString()).innerHTML = '<p style="text-align: left">' + classes[results[btn_index]] + '</p>';

  if (results_update[btn_index] !== -1) { // Already updated
    document.getElementById("grid_item_" + btn_index.toString()).innerHTML = '<p style="text-align: left">' + classes[results[btn_index]] + ' <br>(updated) </p>';
  }
  else {
    document.getElementById("grid_item_" + btn_index.toString()).innerHTML = '<p style="text-align: left">' + classes[results[btn_index]] + '</p>';
  }
}

function returnBoxCoordinates() {
  var url = "http://" + (location.host).toString() + "/handle-coords";
  var data_coords = JSON.stringify(
    {
      "name": json_result.data[current_image_index].save_name,
      "boxCoordinates": [
        x1MouseLastTime,
        y1MouseLastTime,
        x2MouseLastTime,
        y2MouseLastTime
      ]
    }
  )

  $.ajax({
    url: url,
    type: "POST",
    contentType: "application/json",
    data: data_coords,

    success: function (response) {
      // resultPhase2 = classes[response["response"]];
      // resultPhase2Selector = response["response"];

      // console.log(response);

      // console.log("[INFO] Success!!!!!!!!!!!!!!!!!!!!!!!!");

      // if (isShowCoords === true) {
      //   set_result_selector(resultPhase2Selector);
      //   ctx.font = "13px Arial";
      //   ctx.fillText(resultPhase2, x1MouseLastTime + 3, y1MouseLastTime + 13);

      //   isShowCoords = false;
      // }
      // else {

      // }

      console.log("[INFO] RETURN BOX COORDINATES SUCCESSFULLY!!!");

      readResultPhase2("http://" + (location.host).toString() + "/static/temp/resultsJson/resultPhase2.json");
    },

    error: function (e) {
      console.log("ERROR");
      console.log(e);
    }
  });
  console.log("AJAX CALLLL");
}

function readResultPhase2(file){
  var url = file;
  var j = [];
  $.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function (data) { j = data; },
    async: false
  });
  resultPhase2Selector = j.predPhase2;
  resultPhase2 = classes[j.predPhase2];

  if (isShowCoords === true) {
      set_result_selector(resultPhase2Selector);
      ctx.font = "13px Arial";
      ctx.fillText(resultPhase2, x1MouseLastTime + 3, y1MouseLastTime + 13);

      isShowCoords = false;
    }
  else {

  }

  console.log("[INFO] ResultPhase2Selector: " + resultPhase2Selector);
  console.log("[INFO] ResultPhase2: " + resultPhase2);
}

function showCoords(event) {
  var img = document.getElementById("endoscope-img");

  xMouse = event.clientX;
  yMouse = event.clientY;
  console.log("Clicking on the canvas");

  // Clearing the lastest bounding box on the canvas
  if (x1MouseLastTime !== null && y1MouseLastTime !== null) {
    ctx.drawImage(img, 0, 0);
  }

  x1 = xMouse - xPreviewImg - 64;
  y1 = yMouse - yPreviewImg - 64;
  x2 = x1 + 128;
  y2 = y1 + 128;

  set_result_selector(-1);
  setDisabled();

  if ((x1 >= 0 && x1 <= 640 && x2 >= 0 && x2 <= 640 && y1 >= 0 && y1 <= 512 && y2 >= 0 && y2 <= 512)) {
    isShowCoords = true;

    // Storing the latest mouse's position
    x1MouseLastTime = x1;
    y1MouseLastTime = y1;
    x2MouseLastTime = x1MouseLastTime + 128;
    y2MouseLastTime = y1MouseLastTime + 128;

    // Return the coordinates back to the BE
    returnBoxCoordinates();

    ctx.strokeStyle = "rgba(255, 255, 0, 0.6)";
    ctx.lineWidth = 3.0;
    ctx.strokeRect(x1, y1, 128, 128);

    // Setting off all previous bounding boxes to the de-select status
    for (i = 0; i < countIndex; i++) {
      if (document.getElementById("grid_item_" + (i).toString()) !== null) {
        if (isShowAll === false) {
          document.getElementById("grid_item_" + (i).toString()).style.border = "3px solid rgba(255, 255, 0, 0.0)";
          hiddenLabel(i.toString());
        }
      }
    }

    isClick = false;
    isSelect = true;
    isHovering = false;

    isModify = false;
    btn_modify_box.innerText = "Modify";

    removeDisable();

    set_result_selector(-1);

    // Changing the status of the firstChoices array
    firstChoices[countIndex] = 1;

    currentPatchIndex = countIndex;

    results_update[currentPatchIndex] = -1;
  }

  else {
      // Skip
  }
}

function handleMouseEnter(btn_index){
  document.getElementById("grid_item_" + (btn_index).toString()).style.border = "3px solid rgba(255, 255, 0, 1.5)";
  if (results[btn_index] !== undefined) {
      showLabel(btn_index);
  }
}

function handleMouseLeave(btn_index){
  document.getElementById("grid_item_" + (btn_index).toString()).style.border = "3px solid rgba(255, 255, 0, 0.0)";
  hiddenLabel(btn_index);
}

function removeBox() {
  document.getElementById("grid_item_" + (currentPatchIndex).toString()).remove();

  // Modify the result and boxCoordinate correspond to the currentPatchIndex
  results[currentPatchIndex] = undefined;
  results_update[currentPatchIndex] = undefined;
  boxCoordinates[currentPatchIndex] = undefined;
  firstChoices[currentPatchIndex] = undefined;

  // Reset to the de-select status
  isClick = false;
  isSelect = true;
  setDisabled();
  set_result_selector(-1);
  // allowCreate = true;
  currentPatchIndex = null;
  isHovering = false;

  isModify = false;
  btn_modify_box.innerText = "Modify";
}

function dragBoundingBox() {
  var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  if (isModify === true) {
    document.getElementById("grid_item_" + (currentPatchIndex).toString()).onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();

    // get the mouse cursor position at startup:
    pos3 = e.clientX;
    pos4 = e.clientY;

    if (isModify === true) {
      if (isShowAll === false && e.button === 0) {
        if (isHovering === false) {
          document.onmouseup = closeDragElement;
          // call a function whenever the cursor moves:
          document.onmousemove = elementDrag;
        }
      }
      else {
        if (mouseEnter ===  currentPatchIndex && e.button === 0) {
          document.onmouseup = closeDragElement;
          // call a function whenever the cursor moves:
          document.onmousemove = elementDrag;
        }
      }
    }
  }

  function elementDrag(e) {
    hiddenLabel(currentPatchIndex);
    set_result_selector(-1);

    e = e || window.event;
    e.preventDefault();
    // calculate the new cursor position:
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // console.log(pos1 + " " + pos2 + " " + pos3 + " " + pos4);
    // set the element's new position

    x1_Drag = document.getElementById("grid_item_" + (currentPatchIndex).toString()).offsetLeft - pos1 - xPreviewImg;
    y1_Drag = document.getElementById("grid_item_" + (currentPatchIndex).toString()).offsetTop - pos2 - yPreviewImg;
    if (
      x1_Drag >= 0 && x1_Drag <= 640 &&
      (x1_Drag + 128 >= 0) && (x1_Drag + 128 <= 640) &&
      y1_Drag >= 0 && y1_Drag <= 512 &&
      (y1_Drag + 128 >= 0) && (y1_Drag + 128 <= 512)
    )
    {
      document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.left = (document.getElementById("grid_item_" + (currentPatchIndex).toString()).offsetLeft - pos1) + "px";
      document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.top = (document.getElementById("grid_item_" + (currentPatchIndex).toString()).offsetTop - pos2) + "px";
    }
  }

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;

    // Update the modified position
    x1_Modified = document.getElementById("grid_item_" + (currentPatchIndex).toString()).offsetLeft - pos1 - xPreviewImg;
    y1_Modified = document.getElementById("grid_item_" + (currentPatchIndex).toString()).offsetTop - pos2 - yPreviewImg;
    x2_Modified = x1_Modified + 128;
    y2_Modified = y1_Modified + 128;

    if (
      x1_Modified >= 0 && x1_Modified <= 640 &&
      x2_Modified >= 0 && x2_Modified <= 640 &&
      y1_Modified >= 0 && y1_Modified <= 512 &&
      y2_Modified >= 0 && y2_Modified <= 512
    ) {

    }
    else {
      console.log("[SOS] Invalid bounding box!!!");
    }

    // SAVING DATA
    boxCoordinates[currentPatchIndex] = [x1_Modified, y1_Modified, x2_Modified, y2_Modified];

    x1MouseLastTime = x1_Modified;
    y1MouseLastTime = y1_Modified;
    x2MouseLastTime = x2_Modified;
    y2MouseLastTime = y2_Modified;
    returnBoxCoordinates();

    returnResults["data"][current_image_name]["box_coordinates"] = boxCoordinates;

    // Update the results_update
    results_update[currentPatchIndex] = -1;

    console.log("Allowing mouse up");
    results[currentPatchIndex] = resultPhase2Selector;

    showLabel(currentPatchIndex);
    element = document.getElementById("grid_item_" + (currentPatchIndex).toString());
    element.getElementsByTagName("p")[0].innerHTML = classes[results[currentPatchIndex]];
    element.getElementsByTagName("p")[0].style.fontFamily = "Arial, sans-serif";
    element.getElementsByTagName("p")[0].style.fontSize = "14px";
    element.getElementsByTagName("p")[0].style.opacity = "1.5";
    element.getElementsByTagName("p")[0].style.color = "black";

    returnResults["data"][current_image_name]["results_update"] = results_update;
    set_result_selector(resultPhase2Selector);

    // Disable "Modify" state
    // isModify = false;
    // btn_modify_box.innerText = "Modify";
    // console.log(isSelect)
    // isSelect = true;
    // alreadyClick = true;
    // document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.removeProperty("cursor");
  }
}

function modifyBox() {
  document.getElementById("grid_item_" + (currentPatchIndex).toString()).addEventListener("mouseenter", () => {
    if (isModify === true) {
      document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.cursor = "move";
      document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.zIndex = "z-index: 99 !important";
      dragBoundingBox();
    }
  });

  document.getElementById("grid_item_" + (currentPatchIndex).toString()).addEventListener("mouseleave", () => {
    if (isModify === true) {
      document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.removeProperty("cursor");
      // dragBoundingBox();
    }
  });
}

document.getElementById("img-canvas").addEventListener("mouseenter", () => {
  for (i = 0; i < countIndex; i++) {
    if (document.getElementById("grid_item_" + (i).toString()) !== null) {
      gridEffect(i);
    }
  }
})

function gridEffect(btn_index) {
  // Adding the blinking effect for the div
  document.getElementById("grid_item_" + (btn_index).toString()).addEventListener("mouseenter", () => {
    if ((isClick === false && isShowAll === false) || (isClick === true && isShowAll === false && btn_index !== currentPatchIndex)) {
      handleMouseEnter(btn_index);
      isHovering = true;
    }
    if (isClick === true) { // while selecting
      mouseEnter = btn_index;
    }
  });

  document.getElementById("grid_item_" + (btn_index).toString()).addEventListener("mouseleave", () => {
    if ((isClick === false && isShowAll === false) || (isClick === true && isShowAll === false && btn_index !== currentPatchIndex)) {
      handleMouseLeave(btn_index);
      isHovering = false
    }
    mouseEnter = null;
  });

  // Selecting effect
  document.getElementById("grid_item_" + (btn_index).toString()).addEventListener("click", () => {
    console.log("Clicking");

    if (alreadyClick === false) {
      isClick = true;

      // Selecting
      if (isSelect === true) {
        // Reset canvas
        document.getElementById("img-canvas").style.backgroundImage = "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')";
        var img = document.getElementById("endoscope-img");
        ctx.drawImage(img, 0, 0);
        ctx.clearRect(0, 0, 640, 512);
        // Reset canvas

        document.getElementById("grid_item_" + (btn_index).toString()).style.border = "3px solid rgba(255, 255, 0, 1.5)";
        isSelect = false;
        currentPatchIndex = btn_index;
        removeDisable();
        if (results[btn_index] !== undefined) {
          set_result_selector(results[btn_index]);
          showLabel(btn_index);
        }
        // allowCreate = false;
        isHovering = false;

        showBoxMenu(btn_index);
      }

      // De-selecting
      else if (isSelect === false && btn_index === currentPatchIndex && isModify === false) {
        if (isShowAll === false) {
          document.getElementById("grid_item_" + (btn_index).toString()).style.border = "3px solid rgba(255, 255, 0, 0.0)";
          hiddenLabel(btn_index);
        }
        isClick = false;
        isSelect = true;
        setDisabled();
        set_result_selector(-1);
        // allowCreate = true;
        currentPatchIndex = null;
        isHovering = false;

        isModify = false;
        btn_modify_box.innerText = "Modify";
      }

      // Choosing other patches while already selected others
      else if (isSelect === false && btn_index !== currentPatchIndex && isModify === false) {
        if (isShowAll === false) {
          document.getElementById("grid_item_" + (currentPatchIndex).toString()).style.border = "3px solid rgba(255, 255, 0, 0.0)";
          hiddenLabel(currentPatchIndex);
        }
        // isSelect = false;
        currentPatchIndex = btn_index;
        if (results[btn_index] !== undefined) {
            set_result_selector(results[btn_index]);
            showLabel(btn_index);
        }
        else {
            set_result_selector(-1);
        }
        // allowCreate = false;

        isModify = false;
        isHovering = false;
        btn_modify_box.innerText = "Modify";

        showBoxMenu(btn_index);
      }

      alreadyClick = true;
    }
  });

  alreadyClick = false;
}

function radion_btn_change_handle() {
  if (firstChoices[currentPatchIndex] === 1) {
    // Update the canvas

    var img = document.getElementById("endoscope-img");
    ctx.drawImage(img, 0, 0);

    // Create the div grid tag
    createDivGrid();

    // Convert to the select mode (not allow blinking effect)
    isClick = true;
    isSelect = false;
    // allowCreate = false;
    isHovering = false;
    showBoxMenu(currentPatchIndex);

    firstChoices[currentPatchIndex] = 0;
  }

  user_choice = get_result_selector();

  // SAVING DATA
  results[currentPatchIndex] = user_choice;

  // Update the results_update
  results_update[currentPatchIndex] = user_choice;

  // Showing the label immediately
  showLabel(currentPatchIndex)

  // Saving the current image data
  currentResults = {};
  currentResults["name"] = current_image_name;
  currentResults["quality_type"] = image_quality;
  currentResults["box_coordinates"] = boxCoordinates;
  currentResults["results"] = results;
  currentResults["results_update"] = results_update;
  currentResults["already_confirm"] = returnResults.data[current_image_name].already_confirm;

  returnResults["data"][current_image_name] = currentResults;
}

// Khi thay doi ket qua trong radio-checkbox
tagOptionBtns.addEventListener("change", radion_btn_change_handle);

img_canvas.addEventListener("click", showCoords);

document.getElementById("btn_bounding_box").addEventListener("click", () => {
  // Reset canvas
  document.getElementById("img-canvas").style.backgroundImage = "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')";
  var img = document.getElementById("endoscope-img");
  ctx.drawImage(img, 0, 0);
  ctx.clearRect(0, 0, 640, 512);
  // Reset canvas

  if (isShowAll === false) {
    btn_bounding_box.innerHTML = "<img src='static/mats/6684701.png'  style='width: 25px' />";
    btn_bounding_box.title = "Hide all boxes";
    isShowAll = true;
    for (i = 0; i < countIndex; i++) {
      if (document.getElementById("grid_item_" + (i).toString()) !== null) {
        setDisabled();
        document.getElementById("grid_item_" + (i).toString()).style.border = "3px solid rgba(255, 255, 0, 1.5)";
        if (results[i] !== undefined) {
            showLabel(i);
        }
        set_result_selector(-1);

        // Reset to the de-select status
        isSelect = true;
        if (isClick == true) {
            isClick = false;
        }
        // allowCreate = true;
        currentPatchIndex = null;
        isHovering = false;

        // Change the status of the isHovering = true
        isHovering = true

        isModify = false;
        btn_modify_box.innerText = "Modify";
      }
    }
  }

  else {
    // btn_bounding_box.innerText = "Show All Bounding Boxes";
    btn_bounding_box.innerHTML = "<img src='static/mats/6684702.png'  style='width: 25px' />";
    btn_bounding_box.title = "Show all boxes";
    isShowAll = false;
    for (i = 0; i < countIndex; i++) {
      if (document.getElementById("grid_item_" + (i).toString()) !== null) {
        document.getElementById("grid_item_" + (i).toString()).style.border = "3px solid rgba(255, 255, 0, 0.0)";
        setDisabled();
        if (results[i] !== undefined) {
            hiddenLabel(i);
        }
        set_result_selector(-1);

        // Reset to the de-select status
        isSelect = true;
        if (isClick == true) {
            isClick = false;
        }
        // allowCreate = true;
        currentPatchIndex = null;
        isHovering = false;

        isModify = false;
        btn_modify_box.innerText = "Modify";
      }
    }
  }
})

document.getElementById("btn_clear_boxes").addEventListener("click", () => {
  // Reset canvas
  document.getElementById("img-canvas").style.backgroundImage = "url('./static/temp/tempData/" + json_result.data[current_image_index].save_name + "')";
  var img = document.getElementById("endoscope-img");
  ctx.drawImage(img, 0, 0);
  ctx.clearRect(0, 0, 640, 512);
  // Reset canvas

  for (i = 0; i < countIndex; i++) {
    if (document.getElementById("grid_item_" + (i).toString()) !== null) {
      document.getElementById("grid_item_" + (i).toString()).remove();
    }
  }

  already_confirm_clear = returnResults["data"][current_image_name]["already_confirm"];

  returnResults["data"][current_image_name] = {};
  returnResults["data"][current_image_name]["name"] = current_image_name;
  returnResults["data"][current_image_name]["already_confirm"] = already_confirm_clear;

  countIndex = 0;
  // Reset the results and boxCoordinates array
  results = [];
  results_update = [];
  boxCoordinates = [];
  firstChoices = [];

  isClick = false;
  isSelect = true;
  setDisabled();
  set_result_selector(-1);
  // allowCreate = true;
  currentPatchIndex = null;
  isHovering = false;

  isModify = false;
  btn_modify_box.innerText = "Modify";

  update_image();
});

document.getElementById("btn_remove_box").addEventListener("click", removeBox);
document.getElementById("btn_modify_box").addEventListener("click", () => {
  if (isModify === false) {
    isModify = true;
    // btn_modify_box.innerText = "Cancel Modify";
    btn_modify_box.innerText = "Cancel";
    modifyBox();
  }
  else {
    isModify = false;
    // btn_modify_box.innerText = "Modify Box";
    btn_modify_box.innerText = "Modify";
    // modifyBox();
  }
});
// ================================ Perform manual mode ================================


// Main
btnConfirm.addEventListener("click", confirm_result);


  effect_option_button(0);
  effect_option_button(1);
  effect_option_button(2);
  effect_option_button(3);
  effect_option_button(4);
  effect_option_button(5);

  // Khi an confirm current image
document.getElementById("confirm_image").addEventListener("click", confirmCurrentImage)

// Handling the change mode
btnChangeMode.addEventListener("click", () => {
    console.log("Pressing change mode button");

    if (currentMode === "auto") {
        currentMode = "manual";

        // Update the currentMode and send it back to the server
        saveCurrentMode();

        window.location.replace("http://" + (location.host).toString() + "/manual-mode");
    }
    else if (currentMode === "manual") {
        currentMode = "auto";

        // Update the currentMode
        saveCurrentMode();
        console.log("[INFO] current_image_index (manual): " + current_image_index)

        // Update the logging.json file
        saveLoggingManualFile();

        window.location.replace("http://" + (location.host).toString() + "/auto-mode");
    }

    console.log(currentMode);
});


// Disable các buttons
document.querySelector(".container").classList.add("disable");

window.onload = function() {
    canvas = document.getElementById("img-canvas");
    ctx = canvas.getContext("2d");
    var img = document.getElementById("endoscope-img");
    ctx.drawImage(img, 0, 0);
}
