// DOM Elements
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const registerBtn = document.getElementById('registerBtn');
const startMatchBtn = document.getElementById('startMatchBtn');
const statusEl = document.getElementById('status');
const MODEL_URL = './models';
const detectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

// Modal Elements
const registerModal = document.getElementById('registerModal');
const modalUsername = document.getElementById('modalUsername');
const submitRegistration = document.getElementById('submitRegistration');
const cancelRegistration = document.getElementById('cancelRegistration');
const closeModal = document.getElementById('closeModal');

// Variables for throttling auto-match requests
let lastAutoMatchTime = 0;
let isMatching = false;
let autoMatchEnabled = false;
let cameraStarted = false;

// Modified showNotification that logs messages since the notification div is removed
function showNotification(message, type = "info") {
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Validate that only one face is visible in the video stream
async function validateSingleFace() {
  const detections = await faceapi.detectAllFaces(video, detectorOptions);
  if (detections.length > 1) {
    showNotification("Multiple faces detected. Only one face allowed.", "error");
    return false;
  }
  if (detections.length === 0) {
    showNotification("No face detected. Please ensure your face is clearly visible.", "error");
    return false;
  }
  return true;
}

// Utility: Normalize a descriptor (L2 normalization)
function normalizeDescriptor(descriptor) {
  const sumSquares = descriptor.reduce((sum, val) => sum + val * val, 0);
  const norm = Math.sqrt(sumSquares);
  return descriptor.map(val => val / norm);
}

// Capture multiple embeddings and return the averaged (and normalized) descriptor
async function getAverageFaceDescriptor(frameCount = 5, interval = 200) {
  let descriptors = [];
  for (let i = 0; i < frameCount; i++) {
    const detection = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (detection && detection.descriptor) {
      descriptors.push(Array.from(detection.descriptor));
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  if (descriptors.length === 0) return null;
  const avgDescriptor = descriptors[0].map((_, i) => {
    return descriptors.reduce((sum, desc) => sum + desc[i], 0) / descriptors.length;
  });
  return normalizeDescriptor(avgDescriptor);
}

// Start the camera and face detection
async function startCameraAndDetection() {
  if (cameraStarted) {
    autoMatchEnabled = !autoMatchEnabled;
    showNotification(autoMatchEnabled ? 'Matching resumed.' : 'Matching paused.', 'info');
    return;
  }
  statusEl.textContent = 'Loading models...';
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    statusEl.textContent = 'Models loaded. Starting camera...';
  } catch (err) {
    console.error(err);
    showNotification('Error loading models. Please refresh the page or try again.', 'error');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    video.play();
    cameraStarted = true;
    autoMatchEnabled = true;
    statusEl.textContent = 'Camera started. Detecting faces...';
    document.querySelector('.placeholder').style.display = 'none';
    startFaceDetectionLoop();
  } catch (err) {
    console.error(err);
    showNotification('Error accessing camera: ' + err.message + '. Please check camera permissions.', 'error');
  }
}

// Continuously detect faces and update the overlay
function startFaceDetectionLoop() {
  const overlayCtx = overlay.getContext('2d');
  const displaySize = { width: video.clientWidth, height: video.clientHeight };
  faceapi.matchDimensions(overlay, displaySize);
  setInterval(async () => {
    if (!cameraStarted) return;
    const faceDetections = await faceapi
      .detectAllFaces(video, detectorOptions)
      .withFaceLandmarks();
    const resizedFaceDetections = faceapi.resizeResults(faceDetections, displaySize);
    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    faceapi.draw.drawDetections(overlay, resizedFaceDetections);
    if (autoMatchEnabled && faceDetections.length === 1) {
      doAutoMatch();
    }
  }, 300);
}

// Auto-match logic
async function doAutoMatch() {
  const detections = await faceapi.detectAllFaces(video, detectorOptions);
  if (detections.length !== 1) return;
  const now = Date.now();
  if (isMatching || (now - lastAutoMatchTime < 3000)) return;
  isMatching = true;
  const avgDescriptor = await getAverageFaceDescriptor();
  if (!avgDescriptor) {
    isMatching = false;
    showNotification('No face detected for auto-match. Please position your face clearly.', 'error');
    return;
  }
  fetch('/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embedding: avgDescriptor })
  })
    .then(res => res.json())
    .then(data => {
      const matchPreview = document.getElementById('matchPreview');
      if (data.matchFound) {
        showNotification('Auto Match Found! Name: ' + data.name + ', Similarity: ' + data.similarity.toFixed(2), 'success');
        matchPreview.innerHTML = `
          <div class="match-result">
            <div class="match-image">
              <img src="${data.image}" alt="Matched Face">
            </div>
            <div class="match-details">
              <h3>Match Details</h3>
              <p><strong>Name:</strong> ${data.name}</p>
              <p><strong>Similarity:</strong> ${(data.similarity * 100).toFixed(2)}%</p>
            </div>
          </div>
        `;
      } else {
        showNotification(data.message || 'No matching face found.', 'info');
        matchPreview.innerHTML = `
          <div class="match-result">
            <div class="match-image">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-39.1 48H96C78.3 304 64 318.3 64 336c0 77.4 55.7 142.1 128.8 156.1c-1.2-8.6-0.8-17.5 1.4-26.2l9.7-38.8C198.6 417.4 208 404.1 208 389.8V384c0-17.7-14.3-32-32-32zm95.2 128.1l9.7 38.8c2.2 8.7 2.6 17.6 1.4 26.2C328.3 478.1 384 413.4 384 336c0-17.7-14.3-32-32-32H263.1c-17.7 0-32 14.3-32 32v5.8c0 14.3 9.4 27.6 23.2 31.3l9.7 38.8z"/>
              </svg>
            </div>
            <div class="match-details">
              <h3>No Match Found</h3>
              <p>Waiting for face detection...</p>
            </div>
          </div>
        `;
      }
    })
    .catch(err => {
      console.error(err);
      showNotification('Auto-match error. Please try again.', 'error');
    })
    .finally(() => {
      lastAutoMatchTime = Date.now();
      isMatching = false;
    });
}

// Capture a snapshot from the video feed (for registration)
function captureSnapshot() {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/png');
}

// For registration: get the averaged descriptor
async function getFaceDescriptorForAction() {
  const avgDescriptor = await getAverageFaceDescriptor();
  if (!avgDescriptor) {
    showNotification('No face detected. Please try again.', 'error');
    return null;
  }
  return avgDescriptor;
}

// Show and hide modal functions
function openModal() {
  registerModal.style.display = 'block';
}
function closeModalFunction() {
  registerModal.style.display = 'none';
  modalUsername.value = '';
}

// When the Register button is clicked, open the modal
registerBtn.addEventListener('click', () => {
  openModal();
});

// When the submit button in the modal is clicked, trigger registration
submitRegistration.addEventListener('click', async () => {
  const username = modalUsername.value.trim();
  if (!username) {
    showNotification('Please enter a username.', 'error');
    return;
  }
  if (!(await validateSingleFace())) return;
  statusEl.textContent = 'Capturing face data for registration...';
  const descriptor = await getFaceDescriptorForAction();
  if (!descriptor) return;
  const imageData = captureSnapshot();
  fetch('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: username,
      embedding: descriptor,
      image: imageData
    })
  })
    .then(res => res.json())
    .then(data => {
      showNotification(data.message, 'success');
      statusEl.textContent = data.message;
      closeModalFunction();
    })
    .catch(err => {
      console.error(err);
      showNotification('Registration error. Please try again.', 'error');
    });
});

// Cancel registration or close modal when clicking Cancel or the close icon
cancelRegistration.addEventListener('click', closeModalFunction);
closeModal.addEventListener('click', closeModalFunction);

// Start matching when the green camera button is clicked
startMatchBtn.addEventListener('click', () => {
  startCameraAndDetection();
});
