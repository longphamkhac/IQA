// For image
const actualBtn = document.getElementById('image');

const fileChosen = document.getElementById('file-chosen');

actualBtn.addEventListener('change', function(){
  // fileChosen.textContent = this.files[0].name
  fileChosen.textContent = this.files.length.toString() + ' images';
})

// For video
const actualBtnVideo = document.getElementById("video");

const fileChosenVideo = document.getElementById("file-chosen-video");

actualBtnVideo.addEventListener("change", function(){
  fileChosenVideo.textContent = this.files[0].name
})

// Adding and removing disable options
const imgInput = document.querySelector(".img-input"),
previewImg = document.querySelector(".preview-img img");
chooseImgBtn = document.querySelector(".choose-img");
// document.getElementById('.preview-img').style.backgroundImage = "url('./static/bg.png')";

const handleImage = () => {
  // let img = imgInput.files[0];
  // if (!img) return;

  // let p = document.getElementsByTagName("p");
  // let resultText;

  // for (i = 0; i < p.length; i++) {
  //   resultText = p[i];
  //   break;
  // }
  // resultText.removeAttribute("hidden");

  // previewImg.src = URL.createObjectURL(img);
  // previewImg.addEventListener("load", () => {
  //   document.querySelector(".container").classList.remove("disable");
  // });
}

// imgInput.addEventListener("change", handleImage);

// Handling Confirm button
