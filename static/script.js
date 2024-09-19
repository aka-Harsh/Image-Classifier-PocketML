function createFolderInputs() {
    const numFolders = document.getElementById('numFolders').value;
    const folderInputs = document.getElementById('folderInputs');
    folderInputs.innerHTML = '';
    for (let i = 0; i < numFolders; i++) {
        folderInputs.innerHTML += `<input type="text" id="folder${i}" placeholder="Folder ${i+1} name">`;
    }
    createImageUploadContainers(numFolders);
}

function createImageUploadContainers(numFolders) {
    const imageUploadContainers = document.getElementById('imageUploadContainers');
    imageUploadContainers.innerHTML = '';
    for (let i = 0; i < numFolders; i++) {
        imageUploadContainers.innerHTML += `
            <div class="image-upload-container">
                <label id="folderLabel${i}">Folder ${i+1}</label>
                <label class="custom-file-upload">
                    <input type="file" id="imageUpload${i}" multiple accept="image/*" onchange="updateFileName(this)">
                    Choose Files
                </label>
                <div class="file-names" id="fileNames${i}"></div>
            </div>
        `;
    }
}

function updateFileName(input) {
    const fileNamesDiv = input.parentElement.nextElementSibling;
    fileNamesDiv.innerHTML = '';
    for (let i = 0; i < input.files.length; i++) {
        fileNamesDiv.innerHTML += `<div>${input.files[i].name}</div>`;
    }
}

function createFolders() {
    const folderInputs = document.getElementById('folderInputs').getElementsByTagName('input');
    const folders = Array.from(folderInputs).map(input => input.value);
    
    fetch('/create_folders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({folders: folders}),
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        updateFolderLabels(folders);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function updateFolderLabels(folders) {
    folders.forEach((folder, index) => {
        const label = document.getElementById(`folderLabel${index}`);
        if (label) {
            label.textContent = folder;
        }
    });
}

function uploadImages() {
    const imageUploadContainers = document.getElementById('imageUploadContainers').children;
    const formData = new FormData();

    for (let i = 0; i < imageUploadContainers.length; i++) {
        const folderName = document.getElementById(`folderLabel${i}`).textContent;
        const imageUpload = imageUploadContainers[i].querySelector('input[type="file"]');
        
        for (let j = 0; j < imageUpload.files.length; j++) {
            formData.append('images', imageUpload.files[j]);
            formData.append('folder_names', folderName);
        }
    }

    fetch('/upload_images', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function trainModel() {
    fetch('/train_model', {
        method: 'POST',
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function previewClassifyImage(input) {
    const preview = document.getElementById('classifyImagePreview');
    preview.innerHTML = '';
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            preview.appendChild(img);
        }
        reader.readAsDataURL(input.files[0]);
    }
}

function classifyImage() {
    const classifyImage = document.getElementById('classifyImage');
    const formData = new FormData();
    formData.append('image', classifyImage.files[0]);

    fetch('/classify_image', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        const resultDiv = document.getElementById('result');
        if (data.prediction) {
            resultDiv.innerHTML = `Prediction: ${data.prediction} (Confidence: ${data.confidence})`;
        } else if (data.warning) {
            resultDiv.innerHTML = data.warning;
        } else {
            resultDiv.innerHTML = data.error;
        }
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

// Initialize the page
createFolderInputs();