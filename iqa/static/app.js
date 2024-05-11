const actualBtn = document.getElementById('image');

const fileChosen = document.getElementById('file-chosen');
const btnConfirm = document.getElementById('btn_confirm');
const grid_button = document.querySelector(".grid-item");
const tagOptionBtns = document.querySelector(".options");
// const btnShowResults = document.getElementById('btn_showResults');
const btnPreImg = document.getElementById('btn_previous_image');
const btnNxtImg = document.getElementById('btn_next_image');
const btnChangeMode = document.getElementById("btn_change_mode");

const default_grid_btn_border = "2px solid rgba(255, 255, 255, 0.9)";

const tempData_save_path = "static/temp/tempData";
const states_save_path = "static/temp/states"
const output_save_path = "static/temp/resultsJson";

let turn_on_hover = false;

let classses = ["Atrophic gastritis", "Chronic gastritis", "Intestinal metaplasia", "Normal", "Uncertain", "Antrophic metaplasia"];
let ignore_select_class = 6; // state mà sẽ đươc ignore các hiệu ứng click
let ignore_hover_class = 3;
let ignore_hover_class_2 = 4;

let result_20 = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
let selected_patch = -1;
let result_update = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];

let image_num = 0;
let current_image_name = "";
let image_quality = ""
let current_image_index = -1;
let json_result = null;
let currentMode = null;
let currentType = null;

let img_canvas = null;
let ctx = null;

let returnResults = {}; // Store all the resturned data

function color_picker(class_type) {
  if (class_type === 0) return default_grid_btn_border;
  if (class_type === 1) return default_grid_btn_border;
  if (class_type === 2) return default_grid_btn_border;
  if (class_type === 3) return "2px solid rgba(255, 255, 255, 0.0)";
  if (class_type === 4) return "2px solid rgba(255, 255, 255, 0.0)";
  if (class_type === 5) return default_grid_btn_border;
}

function saveResult() {
  var xhr = new XMLHttpRequest();
  var url = "http://" + (location.host).toString() + "/get_result";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var json = JSON.parse(xhr.responseText);
    }
  };
  var data = JSON.stringify(json_result);
  xhr.send(data);

  return $.ajax({
    url: url,
    data: data
  });
  // window.location.replace("http://" + (location.host).toString() + "/confirm");
}

function saveResultV2(){
  var url = "http://" + (location.host).toString() + "/get_result";
  var data_json = JSON.stringify(json_result);

  $.ajax({
    url: url,
    type: 'POST',
    contentType: "application/json",
    data: data_json,

    success: function (data) {
      console.log(data);
      console.log("SUCCESS");

      console.log("Already chosen a saving directory!!!");

      window.location.replace("http://" + (location.host).toString() + "/confirm");
    },
    error: function (e) {

      console.log(e);
      console.log("ERROR");

      console.log("Canceling the choose saving directory option!!!");

      // Enable the "End session & save"
      btnConfirm.disabled = false;
      btnChangeMode.disabled = false;
      document.getElementById("logo").href = "/home";
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
  console.log("Current Mode on Front End: " + currentMode);
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


function gridbtn_effect() {
  if (currentMode === "auto") {

    for (i = 0; i < 20; i++) {
      document.getElementById("grid_item_" + i.toString()).style.border = color_picker(result_20[i]);

      if (result_update[i] != -1) {
        document.getElementById("grid_item_" + i.toString()).innerHTML = '<p style="opacity: 0.5">' + classses[result_20[i]] + ' <br>(updated) </p>';
      } else {
        document.getElementById("grid_item_" + i.toString()).innerHTML = '<p style="opacity: 0.5">' + classses[result_20[i]] + '</p>';
      }

    }

    if (selected_patch >= 0) {
      document.getElementById("grid_item_" + selected_patch.toString()).style.border = "2px solid rgba(255, 255, 0, 0.8)";
    }

  }
}

function select_patch_to_hightlight(patch_index) {
  // for (i = 0; i < 20; i++) {
  //   document.getElementById("grid_item_" + i.toString()).style.border = default_grid_btn_border;
  // }
  gridbtn_effect()

}

function effect_grid_button(btn_index) {
  // === 0
  document.getElementById("grid_item_" + btn_index.toString()).addEventListener('mouseenter', () => {
    // console.log(result_20);
    // console.log(selected_patch);
    if (turn_on_hover === true && result_20[btn_index] != ignore_hover_class && result_20[btn_index] != ignore_hover_class_2 && selected_patch != btn_index) {
      document.getElementById("grid_item_" + btn_index.toString()).style.border = "2px solid rgba(255, 255, 0, 0.8)";
    }
  });
  document.getElementById("grid_item_" + btn_index.toString()).addEventListener('mouseleave', () => {
    if (turn_on_hover === true) {
      gridbtn_effect()
      // document.getElementById("grid_item_" + btn_index.toString()).style.border = "2px solid rgba(255, 255, 255, 0.0)";
    }
  });

  document.getElementById("grid_item_" + btn_index.toString()).addEventListener('click', () => {
    //select
    if (turn_on_hover === true && result_20[btn_index] != ignore_select_class && selected_patch != btn_index) {
      // document.getElementById("grid_item_" + btn_index.toString()).style.border = "4px solid rgba(255, 255, 0, 0.8)";
      selected_patch = btn_index;
      set_result_selector(result_20[btn_index]);
      gridbtn_effect();
    }
    // deselect
    else if (turn_on_hover === true && result_20[btn_index] != ignore_select_class && selected_patch === btn_index) {
      selected_patch = -1;
      document.getElementById("grid_item_" + btn_index.toString()).style.border = "4px solid rgba(255, 255, 0, 0.0)";
      set_result_selector(-1);

    } else if (turn_on_hover === true && result_20[btn_index] == ignore_select_class && selected_patch != -1) {
      selected_patch = -1;
      gridbtn_effect();
      set_result_selector(-1);
    }
  });
}

function effect_option_button(btn_index) {
  document.getElementById( "label_radio_btn_" + btn_index.toString()).addEventListener("click", () => {
    set_result_selector(btn_index);
    result_update[selected_patch] = get_result_selector();
    result_20[selected_patch] = get_result_selector();
    json_result.data[current_image_index].result = result_20
    json_result.data[current_image_index].result[selected_patch] = get_result_selector();
    json_result.data[current_image_index].have_changed[selected_patch] = get_result_selector();
    gridbtn_effect();
  });

  document.getElementById( "label_radio_btn_" + btn_index.toString()).addEventListener("mouseenter", () => {
    document.getElementById( "label_radio_btn_" + btn_index.toString()).style.color = "rgb(227, 43, 98)"
  });

  document.getElementById( "label_radio_btn_" + btn_index.toString()).addEventListener("mouseleave", () => {
    document.getElementById( "label_radio_btn_" + btn_index.toString()).style.color = "rgb(0, 0, 0)"
  });
}

function set_result_selector(class_type) {
  document.getElementById("radion_button_0").checked = false;
  document.getElementById("radion_button_1").checked = false;
  document.getElementById("radion_button_2").checked = false;
  document.getElementById("radion_button_3").checked = false;
  document.getElementById("radion_button_4").checked = false;
  document.getElementById("radion_button_5").checked = false;
  if (class_type != -1) {
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

function radion_btn_change_handle() {
  // console.log(result_20);
  if (selected_patch >= 0) {
    result_update[selected_patch] = get_result_selector();
    result_20[selected_patch] = get_result_selector();
    json_result.data[current_image_index].result = result_20
    json_result.data[current_image_index].result[selected_patch] = get_result_selector();
    json_result.data[current_image_index].have_changed[selected_patch] = get_result_selector();

    console.log("Update patch " + selected_patch.toString() + " to " + result_20[selected_patch].toString());
    gridbtn_effect()
    // console.log(result_update);
  }
}

function confirm_result() {
  console.log("Save result !");
  console.log(result_20);

  // Disable the "End session & save" button
  btnConfirm.disabled = true;
  btnChangeMode.disabled = true;
  document.getElementById("logo").href = "#";

  saveResultV2();
}

function show_file_name() {
  if (current_image_name.length > 20) {
    fileChosen.textContent = current_image_name.substring(0, 5) + "..." + current_image_name.substring(current_image_name.length - 10, current_image_name.length) + ' (' + (current_image_index+1).toString() + '/' + image_num.toString() + ')'
  } else {
    fileChosen.textContent = current_image_name + ' (' + (current_image_index+1).toString() + '/' + image_num.toString() + ')'

  }
}

function update_image() {
  current_image_name = json_result.data[current_image_index].name;
  image_quality = json_result.data[current_image_index].quality_type;
  result_20 = json_result.data[current_image_index].result;
  result_update = json_result.data[current_image_index].have_changed;

  // Checking "already_confirm" attribute
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

  // if (already_confirm == 1) {
  //   removeHidden();
  // }
  // else {
  //   setHidden();
  // }

  update_confirm_current_image();

  show_file_name();

  if (currentMode === "auto") {
    previewImg.style.backgroundImage = "url('http://" + (location.host).toString() + "/" + tempData_save_path + "/" + json_result.data[current_image_index].save_name + "')";

  }
  else {
    previewImg.src = tempData_save_path + "/" + json_result.data[current_image_index].save_name;
    // Updating the canvas
    var img = document.getElementById("endoscope-img");
    ctx.drawImage(img, 0, 0);
  }

  document.querySelector(".container").classList.remove("disable");
  turn_on_hover = true;
  selected_patch = -1;
  gridbtn_effect();
  document.getElementById("h2_image_quality").innerHTML = "Image quality: " + image_quality.toString();
  set_result_selector(-1);

  // update_confirm_current_image();
}

// Adding and removing disable options
const imgInput = document.querySelector(".img-input");

const previewImg = document.querySelector(".preview-img");
if (currentMode === "manual") {
  const previewImg = document.getElementById("endoscope-img");
}

function init() {
  readTextFile("http://" + (location.host).toString() + "/" + output_save_path + "/" + "logging.json");
  readCurrentModeFile("http://" + (location.host).toString() + "/" + states_save_path + "/" + "currentMode.json");

  readLoggingManual("http://" + (location.host).toString() + "/" + output_save_path + "/" + "loggingManual.json");
  if (Object.keys(returnResults).length === 0) {
    returnResults["data"] = {};
  }

  // Initialize the ctx(canvas) if the currentMode === "manual"
  if (currentMode === "manual") {
    img_canvas = document.getElementById("img-canvas");
    ctx = img_canvas.getContext("2d");
  }

  if (image_num > 0) {
    // current_image_index = 0;
    update_image();
  }
}

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
  json_result.data[current_image_index].already_confirm = 1 - json_result.data[current_image_index].already_confirm;
  update_confirm_current_image();
}

// Disable các buttons
document.querySelector(".container").classList.add("disable");
init();



// Khi load ảnh
const handleImage = () => {

  // Tắt disable các buttons
  document.querySelector(".container").classList.remove("disable");

  // Hiệu ứng hover khi di chuột vào đưọc kích hoạt
  // document.querySelector(".grid-container").style.display = "grid";
  turn_on_hover = true;

  // Đọc kết quả phân loại của mô hình
  readTextFile("http://" + (location.host).toString() + "/" + output_save_path + "/" + "logging.json");
  var sothn = null;
  gridbtn_effect();
  document.getElementById("h2_image_quality").innerHTML = "Image quality: " + image_quality.toString();
}


// Thêm hiệu ứng xử lý cho các grid button
effect_grid_button(0);
effect_grid_button(1);
effect_grid_button(2);
effect_grid_button(3);
effect_grid_button(4);
effect_grid_button(5);
effect_grid_button(6);
effect_grid_button(7);
effect_grid_button(8);
effect_grid_button(9);
effect_grid_button(10);
effect_grid_button(11);
effect_grid_button(12);
effect_grid_button(13);
effect_grid_button(14);
effect_grid_button(15);
effect_grid_button(16);
effect_grid_button(17);
effect_grid_button(18);
effect_grid_button(19);

effect_option_button(0);
effect_option_button(1);
effect_option_button(2);
effect_option_button(3);
effect_option_button(4);
effect_option_button(5);


// Main
// imgInput.addEventListener("change", handleImage);
btnConfirm.addEventListener("click", confirm_result);

// btnShowResults.addEventListener("click", handleImage);
btnPreImg.addEventListener("click", () => {
  if (current_image_index > 0) {
    current_image_index = current_image_index - 1;
    update_image();
  }
});

btnNxtImg.addEventListener("click", () => {
  if (current_image_index < image_num-1) {
    current_image_index = current_image_index + 1;
    update_image();
  }
});

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

function saveLoggingFile() {
  var url = "http://" + (location.host).toString() + "/handle-logging-file";
  var json_result_updated = JSON.stringify(
    json_result
  );

  $.ajax({
    url: url,
    type: "POST",
    contentType: "application/json",
    data: json_result_updated,

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

tagOptionBtns.addEventListener("change", radion_btn_change_handle);

// Khi an confirm current image
document.getElementById("confirm_image").addEventListener("click", confirmCurrentImage)

// Handling the change mode
btnChangeMode.addEventListener("click", () => {
  console.log("Pressing change mode button");
  console.log(currentMode);

  if (currentMode === "auto") {
    currentMode = "manual";

    // Update the currentMode and send it back to the server
    saveCurrentMode();
    console.log("[INFO] current_image_index (auto): " + current_image_index)

    // Update the logging.json file (For preserve the updated results when pressing the change mode button)
    saveLoggingFile();

    window.location.replace("http://" + (location.host).toString() + "/manual-mode");
  }
  else if (currentMode === "manual") {
    currentMode = "auto";

    // Update the currentMode
    saveCurrentMode();

    window.location.replace("http://" + (location.host).toString() + "/auto-mode");
  }
});
