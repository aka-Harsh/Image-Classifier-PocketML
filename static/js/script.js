/**
 * Enhanced Multi-Model Image Classifier - Main JavaScript
 */

// Global state
let selectedModels = new Set();
let trainingInterval = null;
let isTraining = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    refreshDatasetInfo();
    setupModelSelection();
    checkTrainingStatus();
});

// ==================== Dataset Management ====================

function refreshDatasetInfo() {
    fetch('/api/dataset_info')
        .then(response => response.json())
        .then(data => {
            updateDatasetDisplay(data);
        })
        .catch(error => {
            document.getElementById('datasetInfo').innerHTML = `
                <div class="text-danger">
                    <i class="bi bi-exclamation-triangle me-1"></i>
                    Error loading dataset info: ${error.message}
                </div>
            `;
        });
}

function updateDatasetDisplay(data) {
    const container = document.getElementById('datasetInfo');
    
    if (data.total_images === 0) {
        container.innerHTML = `
            <div class="text-warning">
                <i class="bi bi-inbox me-1"></i>
                No training data found. Please create folders and upload images.
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="row">
            <div class="col-md-8">
                <div class="d-flex align-items-center mb-2">
                    <i class="bi bi-collection-fill text-success me-2"></i>
                    <strong>${data.num_classes} classes, ${data.total_images} total images</strong>
                </div>
                <div class="row g-2">
    `;
    
    Object.entries(data.classes).forEach(([className, count]) => {
        const percentage = ((count / data.total_images) * 100).toFixed(1);
        html += `
            <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted">${className}:</span>
                    <span class="badge bg-primary">${count} images (${percentage}%)</span>
                </div>
            </div>
        `;
    });
    
    html += `
                </div>
            </div>
            <div class="col-md-4 text-md-end">
                <div class="text-success">
                    <i class="bi bi-check-circle me-1"></i>
                    Ready for training
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
}

// ==================== Folder Creation ====================

function createFolderInputs() {
    const numFolders = document.getElementById('numFolders').value;
    const container = document.getElementById('folderInputsContainer');
    
    if (numFolders < 2 || numFolders > 10) {
        showToast('Please select between 2 and 10 classes', 'warning');
        return;
    }
    
    let html = `
        <div class="row g-2 mb-3">
            <div class="col-12">
                <label class="form-label fw-bold">Class Names:</label>
            </div>
    `;
    
    for (let i = 0; i < numFolders; i++) {
        html += `
            <div class="col-md-6 col-lg-4">
                <div class="input-group">
                    <span class="input-group-text">
                        <i class="bi bi-folder"></i>
                    </span>
                    <input type="text" id="folder${i}" class="form-control" 
                           placeholder="Class ${i + 1} name" onkeyup="validateFolderInputs()">
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
    
    // Focus on first input
    setTimeout(() => {
        document.getElementById('folder0').focus();
    }, 100);
}

function validateFolderInputs() {
    const inputs = document.querySelectorAll('#folderInputsContainer input[type="text"]');
    const createBtn = document.getElementById('createFoldersBtn');
    
    let allFilled = true;
    const values = [];
    
    inputs.forEach(input => {
        const value = input.value.trim();
        if (!value) {
            allFilled = false;
        } else {
            values.push(value.toLowerCase());
        }
    });
    
    // Check for duplicates
    const hasDuplicates = values.length !== new Set(values).size;
    
    if (hasDuplicates) {
        createBtn.disabled = true;
        showToast('Class names must be unique', 'warning');
    } else {
        createBtn.disabled = !allFilled;
    }
}

function createFolders() {
    const inputs = document.querySelectorAll('#folderInputsContainer input[type="text"]');
    const folders = Array.from(inputs).map(input => input.value.trim()).filter(value => value);
    
    if (folders.length === 0) {
        showToast('Please enter class names', 'warning');
        return;
    }
    
    showLoading();
    
    fetch('/api/create_folders', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folders: folders })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            showToast(data.error, 'danger');
        } else {
            showToast(data.message, 'success');
            createImageUploadContainers(data.folders);
            refreshDatasetInfo();
        }
    })
    .catch(error => {
        hideLoading();
        showToast('Error creating folders: ' + error.message, 'danger');
    });
}

// ==================== Image Upload ====================

function createImageUploadContainers(folders) {
    const container = document.getElementById('imageUploadContainer');
    
    let html = '';
    folders.forEach((folder, index) => {
        html += `
            <div class="col-md-6 col-lg-4">
                <div class="card bg-dark border-secondary h-100">
                    <div class="card-header bg-transparent border-secondary">
                        <h6 class="mb-0">
                            <i class="bi bi-folder-fill me-2 text-primary"></i>
                            ${folder}
                        </h6>
                    </div>
                    <div class="card-body">
                        <div class="mb-3">
                            <label class="form-label small">Select Images:</label>
                            <input type="file" id="imageUpload${index}" 
                                   class="form-control form-control-sm" 
                                   multiple accept="image/*" 
                                   onchange="previewImages(this, ${index})">
                        </div>
                        <div id="preview${index}" class="image-preview-container"></div>
                        <div id="fileCount${index}" class="text-muted small mt-2">No files selected</div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    document.getElementById('uploadImagesBtn').disabled = false;
}

function previewImages(input, containerIndex) {
    const previewContainer = document.getElementById(`preview${containerIndex}`);
    const fileCountDisplay = document.getElementById(`fileCount${containerIndex}`);
    
    previewContainer.innerHTML = '';
    
    if (input.files.length === 0) {
        fileCountDisplay.textContent = 'No files selected';
        return;
    }
    
    fileCountDisplay.innerHTML = `
        <i class="bi bi-images me-1"></i>
        ${input.files.length} image(s) selected
    `;
    
    // Show first few images as preview
    const maxPreviews = 3;
    for (let i = 0; i < Math.min(input.files.length, maxPreviews); i++) {
        const file = input.files[i];
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.className = 'image-preview me-1 mb-1';
                img.title = file.name;
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    }
    
    if (input.files.length > maxPreviews) {
        const moreIndicator = document.createElement('span');
        moreIndicator.className = 'badge bg-secondary';
        moreIndicator.textContent = `+${input.files.length - maxPreviews} more`;
        previewContainer.appendChild(moreIndicator);
    }
    
    validateUploadReadiness();
}

function validateUploadReadiness() {
    const uploadInputs = document.querySelectorAll('#imageUploadContainer input[type="file"]');
    const uploadBtn = document.getElementById('uploadImagesBtn');
    
    let hasImages = false;
    uploadInputs.forEach(input => {
        if (input.files.length > 0) {
            hasImages = true;
        }
    });
    
    uploadBtn.disabled = !hasImages;
}

function uploadImages() {
    const uploadInputs = document.querySelectorAll('#imageUploadContainer input[type="file"]');
    const formData = new FormData();
    
    let totalFiles = 0;
    
    uploadInputs.forEach((input, index) => {
        const folderName = input.closest('.card').querySelector('.card-header h6').textContent.trim();
        
        for (let i = 0; i < input.files.length; i++) {
            formData.append('images', input.files[i]);
            formData.append('folder_names', folderName);
            totalFiles++;
        }
    });
    
    if (totalFiles === 0) {
        showToast('No images to upload', 'warning');
        return;
    }
    
    showLoading();
    showToast(`Uploading ${totalFiles} images...`, 'info');
    
    fetch('/api/upload_images', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            showToast(data.error, 'danger');
        } else {
            showToast(data.message, 'success');
            if (data.warnings && data.warnings.length > 0) {
                data.warnings.forEach(warning => {
                    showToast(warning, 'warning', 8000);
                });
            }
            refreshDatasetInfo();
            enableTrainingStep();
        }
    })
    .catch(error => {
        hideLoading();
        showToast('Error uploading images: ' + error.message, 'danger');
    });
}

// ==================== Model Selection ====================

function setupModelSelection() {
    const modelCards = document.querySelectorAll('.model-selection-card');
    
    modelCards.forEach(card => {
        card.addEventListener('click', function() {
            const modelType = this.dataset.model;
            
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedModels.delete(modelType);
            } else {
                this.classList.add('selected');
                selectedModels.add(modelType);
            }
            
            updateTrainingButton();
        });
    });
}

function selectAllModels() {
    const modelCards = document.querySelectorAll('.model-selection-card');
    modelCards.forEach(card => {
        card.classList.add('selected');
        selectedModels.add(card.dataset.model);
    });
    updateTrainingButton();
}

function clearModelSelection() {
    const modelCards = document.querySelectorAll('.model-selection-card');
    modelCards.forEach(card => {
        card.classList.remove('selected');
    });
    selectedModels.clear();
    updateTrainingButton();
}

function updateTrainingButton() {
    const trainBtn = document.getElementById('startTrainingBtn');
    trainBtn.disabled = selectedModels.size === 0 || isTraining;
    
    if (selectedModels.size > 0) {
        trainBtn.innerHTML = `
            <i class="bi bi-play-circle me-2"></i>
            Train ${selectedModels.size} Model${selectedModels.size > 1 ? 's' : ''}
        `;
    } else {
        trainBtn.innerHTML = `
            <i class="bi bi-play-circle me-2"></i>
            Start Training
        `;
    }
}

function enableTrainingStep() {
    // Enable training once images are uploaded
    document.getElementById('startTrainingBtn').disabled = selectedModels.size === 0;
}

// ==================== Training Management ====================

function startTraining() {
    if (selectedModels.size === 0) {
        showToast('Please select at least one model to train', 'warning');
        return;
    }
    
    const modelArray = Array.from(selectedModels);
    
    showLoading();
    
    fetch('/api/start_training', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ models: modelArray })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            showToast(data.error, 'danger');
        } else {
            showToast(data.message, 'success');
            isTraining = true;
            startTrainingMonitoring();
            showTrainingModal();
            updateTrainingButton();
        }
    })
    .catch(error => {
        hideLoading();
        showToast('Error starting training: ' + error.message, 'danger');
    });
}

function startTrainingMonitoring() {
    if (trainingInterval) {
        clearInterval(trainingInterval);
    }
    
    trainingInterval = setInterval(checkTrainingStatus, 2000); // Check every 2 seconds
}

function checkTrainingStatus() {
    fetch('/api/training_status')
        .then(response => response.json())
        .then(data => {
            updateTrainingDisplay(data);
            
            if (!data.is_training && trainingInterval) {
                clearInterval(trainingInterval);
                trainingInterval = null;
                isTraining = false;
                updateTrainingButton();
                
                if (data.error) {
                    showToast('Training stopped with error: ' + data.error, 'danger');
                } else {
                    showToast('Training completed successfully!', 'success');
                    setTimeout(() => {
                        hideTrainingModal();
                    }, 3000);
                }
            }
        })
        .catch(error => {
            console.error('Error checking training status:', error);
        });
}

function updateTrainingDisplay(status) {
    const progressContainer = document.getElementById('trainingProgressContainer');
    const modalContent = document.getElementById('trainingModalContent');
    
    if (!status.is_training && Object.keys(status.progress || {}).length === 0) {
        progressContainer.innerHTML = `
            <div class="text-center text-muted">
                <i class="bi bi-clock fs-1"></i>
                <p>Training progress will appear here once started</p>
            </div>
        `;
        return;
    }
    
    let html = '<div class="row g-3">';
    
    Object.entries(status.progress || {}).forEach(([modelType, progress]) => {
        const statusIcon = getStatusIcon(progress.status);
        const statusColor = getStatusColor(progress.status);
        
        html += `
            <div class="col-md-6">
                <div class="card bg-dark border-${statusColor}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <h6 class="mb-0">${modelType.toUpperCase()}</h6>
                            <span class="badge bg-${statusColor}">
                                <i class="bi bi-${statusIcon} me-1"></i>
                                ${progress.status}
                            </span>
                        </div>
                        
                        ${progress.status === 'training' ? `
                            <div class="progress mb-2">
                                <div class="progress-bar progress-bar-striped progress-bar-animated bg-${statusColor}" 
                                     style="width: ${(progress.epochs / 15) * 100}%">
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-6">
                                    <small><strong>Epoch:</strong> ${progress.epochs}/15</small>
                                </div>
                                <div class="col-6">
                                    <small><strong>Accuracy:</strong> ${progress.accuracy.toFixed(1)}%</small>
                                </div>
                            </div>
                        ` : progress.status === 'completed' ? `
                            <div class="progress mb-2">
                                <div class="progress-bar bg-success" style="width: 100%"></div>
                            </div>
                            <div class="text-center">
                                <strong class="text-success">Final Accuracy: ${progress.accuracy.toFixed(1)}%</strong>
                            </div>
                        ` : progress.status === 'error' ? `
                            <div class="alert alert-danger small mb-0">
                                ${progress.error || 'Unknown error occurred'}
                            </div>
                        ` : `
                            <div class="text-center text-muted">
                                <i class="bi bi-hourglass-split"></i>
                                Waiting to start...
                            </div>
                        `}
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    if (status.current_model) {
        html += `
            <div class="alert alert-info mt-3">
                <i class="bi bi-gear-wide-connected me-2"></i>
                Currently training: <strong>${status.current_model.toUpperCase()}</strong>
            </div>
        `;
    }
    
    progressContainer.innerHTML = html;
    if (modalContent) {
        modalContent.innerHTML = html;
    }
}

function getStatusIcon(status) {
    const icons = {
        'pending': 'hourglass-split',
        'training': 'gear-wide-connected',
        'completed': 'check-circle-fill',
        'error': 'exclamation-triangle-fill'
    };
    return icons[status] || 'question-circle';
}

function getStatusColor(status) {
    const colors = {
        'pending': 'secondary',
        'training': 'primary',
        'completed': 'success',
        'error': 'danger'
    };
    return colors[status] || 'secondary';
}

function showTrainingModal() {
    const modal = new bootstrap.Modal(document.getElementById('trainingModal'));
    modal.show();
}

function hideTrainingModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('trainingModal'));
    if (modal) {
        modal.hide();
    }
}

function stopTraining() {
    fetch('/api/stop_training', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        showToast(data.message, 'warning');
        if (trainingInterval) {
            clearInterval(trainingInterval);
            trainingInterval = null;
        }
        isTraining = false;
        updateTrainingButton();
        hideTrainingModal();
    })
    .catch(error => {
        showToast('Error stopping training: ' + error.message, 'danger');
    });
}