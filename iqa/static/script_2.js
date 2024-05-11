
// Handling Confirm button
function function_a() {
  document.getElementById("blank_div").innerHTML = "<div class='warning' style='border-radius: 10px;'><div class='alert alert-warning alert-dismissible fade show' role='alert'><span>Waiting for processing video completes...</span></div></div>";
}

document.getElementById('btn_extract_hq').addEventListener("click", function_a)

document.getElementById('btn_auto_process').addEventListener("click", function_a)
