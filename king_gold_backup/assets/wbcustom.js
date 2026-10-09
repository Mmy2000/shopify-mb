// product grid/list
// function listgridJavascript() {
// Array.from(document.querySelectorAll(".wblistgridbtn")).forEach(link => {
//     link.addEventListener('click', function(event) {
//         Array.from(document.querySelectorAll(".wblistgridbtn")).forEach(e => e.classList.remove('active'));
//         this.classList.add('active');
//         if(this.classList.contains('listv')){
//             document.getElementById('product-grid').classList.add('product-list');
//             document.getElementById('product-grid').classList.remove('product-grid');
//         }else if(this.classList.contains('gridv')){
//             document.getElementById('product-grid').classList.add('product-grid');
//             document.getElementById('product-grid').classList.remove('product-list');
//         }
//     });
// });
// };
// document.addEventListener("shopify:section:load", listgridJavascript);
// listgridJavascript();


function layoutSwitcher() {
  Array.from(document.querySelectorAll(".wblistgridbtn")).forEach(link => {
    link.addEventListener('click', toggle);
    link.addEventListener('keydown', handleKeyDown);
  });
};
function handleKeyDown(event){
  if (event.keyCode === 13) {
    toggle(event);
  }
}
function toggle(event){
  Array.from(document.querySelectorAll(".wblistgridbtn")).forEach(e => e.classList.remove('active'));
  event.currentTarget.classList.add('active');
  if(event.currentTarget.classList.contains('listv')){
    document.getElementById('ProductGridContainer').classList.add('product-list');
    document.getElementById('ProductGridContainer').classList.remove('product-grid');
  }else if(event.currentTarget.classList.contains('gridv')){
    document.getElementById('ProductGridContainer').classList.add('product-grid');
    document.getElementById('ProductGridContainer').classList.remove('product-list');
  }
}
document.addEventListener("shopify:section:load", layoutSwitcher);
layoutSwitcher();

// on scroll play video
window.addEventListener('load', videoScroll);
window.addEventListener('scroll', videoScroll);
function videoScroll() {
  if ( document.querySelectorAll('video[autoplay]').length > 0) {
    var windowHeight = window.innerHeight, videoEl = document.querySelectorAll('video[autoplay]');
    for (var i = 0; i < videoEl.length; i++) {
      var thisVideoEl = videoEl[i],
          videoHeight = thisVideoEl.clientHeight,
          videoClientRect = thisVideoEl.getBoundingClientRect().top;
      if ( videoClientRect <= ( (windowHeight) - (videoHeight*.5) ) && videoClientRect >= ( 0 - ( videoHeight*.5 ) ) ) {
        thisVideoEl.play();
      } else {
        thisVideoEl.pause();
      }
    }
  }
}

// timer
setInterval(countDown, 1000);
function countDown() {
  const countCardSections = document.querySelectorAll('.countd_all');
  countCardSections.forEach((countdownSection) => {
    var countDownDate = new Date(countdownSection.getAttribute('data-date')).getTime();
    var now = new Date().getTime();
    var distance = countDownDate - now;
    if (distance < 0 || isNaN(countDownDate)) {
      countdownSection.querySelector('.main_cdays .wb_cdays').textContent = "00";
      countdownSection.querySelector('.main_chours .wb_chours').textContent = "00";
      countdownSection.querySelector('.main_cminutes .wb_cminutes').textContent = "00";
      countdownSection.querySelector('.main_cseconds .wb_cseconds').textContent = "00";
    }
    else {
      countdownSection.querySelector('.main_cdays .wb_cdays').textContent = Math.floor(distance / (1000 * 60 * 60 * 24));
      countdownSection.querySelector('.main_chours .wb_chours').textContent = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      countdownSection.querySelector('.main_cminutes .wb_cminutes').textContent = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      countdownSection.querySelector('.main_cseconds .wb_cseconds').textContent = Math.floor((distance % (1000 * 60)) / 1000);
    }
  });
}