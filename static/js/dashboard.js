/**
 * Dashboard JavaScript for Multi-Model Prediction Interface
 */

let currentImage = null;
let predictionResults = null;
let probabilityViewMode = 'bars'; // 'bars' or 'table'

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    loadModelStatus();
    setupDragAndDrop();
});

// ==================== Model Status Management ====================

function loadModelStatus() {
    fetch('/api/models/available')
        .then(response => response.json())
        .then(data => {
            updateModelStatusDisplay(data);
        })
        .catch(error => {
            document.getElementById('modelStatusOverview').innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error loading model status: ${error.message}
                    </div>
                </div>
            `;
        });
}

function updateModelStatusDisplay(models) {
    const container = document.getElementById('modelStatusOverview');
    
    let availableCount = 0;
    let html = '';
    
    Object.entries(models).forEach(([modelType, info]) => {
        const isAvailable = info.status === 'available';
        if (isAvailable) availableCount++;
        
        const statusColor = isAvailable ? 'success' : 'secondary';
        const statusIcon = isAvailable ? 'check-circle-fill' : 'x-circle';
        
        html += `
            <div class="col-md-6 col-lg-3 mb-3">
                <div class="card bg-dark border-${statusColor} h-100">
                    <div class="card-body text-center">
                        <i class="bi bi-${statusIcon} text-${statusColor} fs-2 mb-2"></i>
                        <h6 class="card-title">${info.name}</h6>
                        <p class="card-text small text-muted">${info.description}</p>
                        <div class="row text-start">
                            <div class="col-6">
                                <small><strong>Params:</strong></small><br>
                                <small class="text-muted">${info.params}</small>
                            </div>
                            <div class="col-6">
                                <small><strong>Speed:</strong></small><br>
                                <small class="text-muted">${info.speed}</small>
                            </div>
                        </div>
                        <div class="mt-2">
                            <span class="badge bg-${statusColor}">${info.status}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Add summary
    const totalModels = Object.keys(models).length;
    html = `
        <div class="col-12 mb-3">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-0">
                        <i class="bi bi-cpu-fill text-primary me-2"></i>
                        ${availableCount}/${totalModels} models ready for prediction
                    </h6>
                </div>
                <button class="btn btn-outline-primary btn-sm" onclick="loadModelStatus()">
                    <i class="bi bi-arrow-clockwise me-1"></i>Refresh
                </button>
            </div>
        </div>
    ` + html;
    
    container.innerHTML = html;
    
    // Show warning if no models available
    if (availableCount === 0) {
        showToast('No trained models available. Please train models first.', 'warning', 8000);
    }
}

// ==================== Image Upload Management ====================

function setupDragAndDrop() {
    const uploadZone = document.getElementById('uploadZone');
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });
    
    // Handle dropped files
    uploadZone.addEventListener('drop', handleDrop, false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    document.getElementById('uploadZone').classList.add('dragover');
}

function unhighlight(e) {
    document.getElementById('uploadZone').classList.remove('dragover');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleImageFile(files[0]);
    }
}

function handleImageUpload(input) {
    if (input.files && input.files[0]) {
        handleImageFile(input.files[0]);
    }
}

function handleImageFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'danger');
        return;
    }
    
    // Validate file size (16MB max)
    if (file.size > 16 * 1024 * 1024) {
        showToast('File size too large. Maximum size is 16MB.', 'danger');
        return;
    }
    
    currentImage = file;
    
    // Read and display image
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('previewImage').src = e.target.result;
        displayImageDetails(file);
        document.getElementById('imagePreviewSection').classList.remove('d-none');
    };
    reader.readAsDataURL(file);
}

function displayImageDetails(file) {
    const img = new Image();
    img.onload = function() {
        const details = {
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            dimensions: `${this.width} × ${this.height}`,
            aspectRatio: (this.width / this.height).toFixed(2)
        };
        
        const detailsHTML = `
            <table class="table table-sm table-dark">
                <tr><td><strong>Filename:</strong></td><td>${details.name}</td></tr>
                <tr><td><strong>File Size:</strong></td><td>${details.size}</td></tr>
                <tr><td><strong>Type:</strong></td><td>${details.type}</td></tr>
                <tr><td><strong>Dimensions:</strong></td><td>${details.dimensions}</td></tr>
                <tr><td><strong>Aspect Ratio:</strong></td><td>${details.aspectRatio}</td></tr>
            </table>
        `;
        
        document.getElementById('imageDetails').innerHTML = `
            <div class="card-body">
                ${detailsHTML}
            </div>
        `;
    };
    
    const reader = new FileReader();
    reader.onload = function(e) {
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function clearImage() {
    currentImage = null;
    predictionResults = null;
    document.getElementById('imagePreviewSection').classList.add('d-none');
    document.getElementById('resultsSection').classList.add('d-none');
    document.getElementById('imageInput').value = '';
}

// ==================== Prediction Management ====================

function predictImage() {
    if (!currentImage) {
        showToast('Please select an image first', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('image', currentImage);
    
    // Show loading modal
    const modal = new bootstrap.Modal(document.getElementById('predictionModal'));
    modal.show();
    
    fetch('/api/predict', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        modal.hide();
        
        if (data.error) {
            showToast(data.error, 'danger');
        } else if (data.success) {
            predictionResults = data;
            displayPredictionResults(data);
            showToast('Predictions completed successfully!', 'success');
        }
    })
    .catch(error => {
        modal.hide();
        showToast('Error making predictions: ' + error.message, 'danger');
    });
}

function displayPredictionResults(results) {
    document.getElementById('resultsSection').classList.remove('d-none');
    
    // Display ensemble result
    displayEnsembleResult(results.ensemble_result);
    
    // Display individual model results
    displayIndividualResults(results.individual_results);
    
    // Display confidence analysis
    displayConfidenceAnalysis(results.confidence_analysis, results.explanation);
    
    // Display detailed probabilities
    displayDetailedProbabilities(results.individual_results);
    
    // Smooth scroll to results
    setTimeout(() => {
        document.getElementById('resultsSection').scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }, 100);
}

function displayEnsembleResult(ensemble) {
    const container = document.getElementById('ensembleResult');
    
    if (!ensemble) {
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-info">
                    <i class="bi bi-info-circle me-2"></i>
                    Ensemble prediction requires multiple models. Train more models for ensemble results.
                </div>
            </div>
        `;
        return;
    }
    
    const confidenceColor = getConfidenceColor(ensemble.confidence);
    
    container.innerHTML = `
        <div class="col-md-8">
            <div class="row">
                <div class="col-12 mb-3">
                    <h3 class="text-primary mb-2">
                        <i class="bi bi-award me-2"></i>${ensemble.predicted_class}
                    </h3>
                    <div class="confidence-bar">
                        <div class="confidence-fill ${confidenceColor}" 
                             style="width: ${ensemble.confidence}%"></div>
                    </div>
                    <div class="d-flex justify-content-between mt-1">
                        <small class="text-muted">Confidence</small>
                        <small class="fw-bold">${ensemble.confidence}%</small>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-dark border-secondary">
                        <div class="card-body text-center">
                            <h6 class="card-title text-muted">Model Agreement</h6>
                            <div class="fs-4 fw-bold text-primary">${ensemble.model_agreement}%</div>
                        </div>
                    </div>
                </div>
                <div class="col-6">
                    <div class="card bg-dark border-secondary">
                        <div class="card-body text-center">
                            <h6 class="card-title text-muted">Voting Results</h6>
                            <div class="small">
                                ${Object.entries(ensemble.voting_results).map(([cls, votes]) => 
                                    `<div>${cls}: ${votes} vote${votes !== 1 ? 's' : ''}</div>`
                                ).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card bg-dark border-primary">
                <div class="card-header bg-transparent">
                    <h6 class="mb-0 text-primary">
                        <i class="bi bi-bar-chart me-1"></i>Average Probabilities
                    </h6>
                </div>
                <div class="card-body">
                    ${Object.entries(ensemble.average_probabilities)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 3)
                        .map(([cls, prob]) => `
                            <div class="mb-2">
                                <div class="d-flex justify-content-between">
                                    <small>${cls}</small>
                                    <small class="fw-bold">${prob.toFixed(1)}%</small>
                                </div>
                                <div class="probability-bar">
                                    <div class="probability-fill" style="width: ${prob}%"></div>
                                </div>
                            </div>
                        `).join('')}
                </div>
            </div>
        </div>
    `;
}

function displayIndividualResults(results) {
    const container = document.getElementById('individualResults');
    
    // Find best prediction
    const bestResult = results.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
    );
    
    let html = '';
    
    results.forEach(result => {
        const isBest = result === bestResult;
        const confidenceColor = getConfidenceColor(result.confidence);
        
        html += `
            <div class="col-md-6 col-lg-3">
                <div class="model-prediction-card card bg-dark border-secondary ${isBest ? 'best-prediction' : ''}">
                    ${isBest ? '<div class="position-absolute top-0 end-0 p-2"><i class="bi bi-trophy-fill text-warning"></i></div>' : ''}
                    <div class="card-header bg-transparent border-secondary">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0">${result.model_display_name}</h6>
                            <span class="badge bg-secondary">${result.model_speed}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <div class="text-center mb-3">
                            <h5 class="text-primary mb-2">${result.predicted_class}</h5>
                            <div class="confidence-bar">
                                <div class="confidence-fill ${confidenceColor}" 
                                     style="width: ${result.confidence}%"></div>
                            </div>
                            <div class="d-flex justify-content-between mt-1">
                                <small class="text-muted">Confidence</small>
                                <small class="fw-bold">${result.confidence}%</small>
                            </div>
                        </div>
                        
                        <div class="row text-center">
                            <div class="col-6">
                                <small class="text-muted">Parameters</small>
                                <div class="small fw-bold">${result.model_params}</div>
                            </div>
                            <div class="col-6">
                                <small class="text-muted">Time</small>
                                <div class="small fw-bold">${result.prediction_time}ms</div>
                            </div>
                        </div>
                        
                        <div class="mt-3">
                            <button class="btn btn-outline-info btn-sm w-100" 
                                    onclick="showDetailedPrediction('${result.model_name}')">
                                <i class="bi bi-eye me-1"></i>View Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function displayConfidenceAnalysis(analysis, explanation) {
    const container = document.getElementById('confidenceAnalysis');
    
    container.innerHTML = `
        <div class="col-md-8">
            <div class="row g-3">
                <div class="col-md-3">
                    <div class="card bg-dark border-secondary text-center">
                        <div class="card-body">
                            <h6 class="card-title text-muted">Average Confidence</h6>
                            <div class="fs-4 fw-bold text-primary">${analysis.avg_confidence}%</div>
                            <small class="badge bg-${getConfidenceBadgeColor(analysis.confidence_level)}">${analysis.confidence_level}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-dark border-secondary text-center">
                        <div class="card-body">
                            <h6 class="card-title text-muted">Consensus</h6>
                            <div class="fs-4 fw-bold ${analysis.class_consensus ? 'text-success' : 'text-warning'}">
                                <i class="bi bi-${analysis.class_consensus ? 'check-circle' : 'exclamation-triangle'}"></i>
                            </div>
                            <small class="text-muted">${analysis.class_consensus ? 'All Agree' : 'Mixed'}</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-dark border-secondary text-center">
                        <div class="card-body">
                            <h6 class="card-title text-muted">Confidence Range</h6>
                            <div class="fs-4 fw-bold text-info">${analysis.confidence_range.toFixed(1)}%</div>
                            <small class="text-muted">Spread</small>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card bg-dark border-secondary text-center">
                        <div class="card-body">
                            <h6 class="card-title text-muted">Reliability</h6>
                            <div class="fs-4 fw-bold text-${getReliabilityColor(analysis)}">
                                <i class="bi bi-${getReliabilityIcon(analysis)}"></i>
                            </div>
                            <small class="text-muted">${getReliabilityText(analysis)}</small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-md-4">
            <div class="card bg-dark border-info">
                <div class="card-header bg-transparent">
                    <h6 class="mb-0 text-info">
                        <i class="bi bi-lightbulb me-1"></i>Analysis Summary
                    </h6>
                </div>
                <div class="card-body">
                    <p class="small mb-0">${explanation}</p>
                </div>
            </div>
        </div>
    `;
}

function displayDetailedProbabilities(results) {
    const container = document.getElementById('detailedProbabilities');
    
    // Get all unique classes
    const allClasses = new Set();
    results.forEach(result => {
        Object.keys(result.all_probabilities).forEach(cls => allClasses.add(cls));
    });
    
    const classArray = Array.from(allClasses).sort();
    
    if (probabilityViewMode === 'bars') {
        displayProbabilityBars(container, results, classArray);
    } else {
        displayProbabilityTable(container, results, classArray);
    }
}

function displayProbabilityBars(container, results, classes) {
    let html = '<div class="row g-3">';
    
    classes.forEach(className => {
        html += `
            <div class="col-md-6 col-lg-4">
                <div class="card bg-dark border-secondary">
                    <div class="card-header bg-transparent">
                        <h6 class="mb-0 text-center">${className}</h6>
                    </div>
                    <div class="card-body">
        `;
        
        results.forEach(result => {
            const prob = result.all_probabilities[className] || 0;
            const barColor = prob > 50 ? 'success' : prob > 25 ? 'warning' : 'secondary';
            
            html += `
                <div class="mb-2">
                    <div class="d-flex justify-content-between">
                        <small>${result.model_display_name}</small>
                        <small class="fw-bold">${prob.toFixed(1)}%</small>
                    </div>
                    <div class="progress" style="height: 6px;">
                        <div class="progress-bar bg-${barColor}" style="width: ${prob}%"></div>
                    </div>
                </div>
            `;
        });
        
        html += `
                    </div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function displayProbabilityTable(container, results, classes) {
    let html = `
        <div class="table-responsive">
            <table class="table table-dark table-striped">
                <thead>
                    <tr>
                        <th>Model</th>
                        ${classes.map(cls => `<th class="text-center">${cls}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;
    
    results.forEach(result => {
        html += `<tr><td>${result.model_display_name}</td>`;
        classes.forEach(className => {
            const prob = result.all_probabilities[className] || 0;
            const cellColor = prob > 50 ? 'success' : prob > 25 ? 'warning' : '';
            html += `<td class="text-center ${cellColor ? `text-${cellColor}` : ''}">${prob.toFixed(1)}%</td>`;
        });
        html += '</tr>';
    });
    
    html += `
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = html;
}

// ==================== Utility Functions ====================

function getConfidenceColor(confidence) {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
}

function getConfidenceBadgeColor(level) {
    const colors = {
        'Very High': 'success',
        'High': 'primary',
        'Medium': 'warning',
        'Low': 'danger'
    };
    return colors[level] || 'secondary';
}

function getReliabilityColor(analysis) {
    if (analysis.class_consensus && analysis.avg_confidence >= 80) return 'success';
    if (analysis.avg_confidence >= 60) return 'warning';
    return 'danger';
}

function getReliabilityIcon(analysis) {
    if (analysis.class_consensus && analysis.avg_confidence >= 80) return 'shield-check';
    if (analysis.avg_confidence >= 60) return 'shield-exclamation';
    return 'shield-x';
}

function getReliabilityText(analysis) {
    if (analysis.class_consensus && analysis.avg_confidence >= 80) return 'High';
    if (analysis.avg_confidence >= 60) return 'Medium';
    return 'Low';
}

function toggleProbabilityView() {
    probabilityViewMode = probabilityViewMode === 'bars' ? 'table' : 'bars';
    if (predictionResults) {
        displayDetailedProbabilities(predictionResults.individual_results);
    }
}

function showDetailedPrediction(modelName) {
    const result = predictionResults.individual_results.find(r => r.model_name === modelName);
    if (!result) return;
    
    const modal = new bootstrap.Modal(document.getElementById('imageDetailsModal'));
    const modalContent = document.getElementById('detailedModalContent');
    
    modalContent.innerHTML = `
        <div class="row">
            <div class="col-md-6">
                <h6 class="text-primary mb-3">${result.model_display_name} Details</h6>
                <table class="table table-sm table-dark">
                    <tr><td><strong>Predicted Class:</strong></td><td>${result.predicted_class}</td></tr>
                    <tr><td><strong>Confidence:</strong></td><td>${result.confidence}%</td></tr>
                    <tr><td><strong>Parameters:</strong></td><td>${result.model_params}</td></tr>
                    <tr><td><strong>Prediction Time:</strong></td><td>${result.prediction_time}ms</td></tr>
                    <tr><td><strong>Model Speed:</strong></td><td>${result.model_speed}</td></tr>
                </table>
            </div>
            <div class="col-md-6">
                <h6 class="text-info mb-3">All Class Probabilities</h6>
                <div class="card bg-dark border-secondary">
                    <div class="card-body">
                        ${Object.entries(result.all_probabilities)
                            .sort(([,a], [,b]) => b - a)
                            .map(([cls, prob]) => `
                                <div class="mb-2">
                                    <div class="d-flex justify-content-between">
                                        <small>${cls}</small>
                                        <small class="fw-bold">${prob.toFixed(1)}%</small>
                                    </div>
                                    <div class="progress" style="height: 4px;">
                                        <div class="progress-bar bg-primary" style="width: ${prob}%"></div>
                                    </div>
                                </div>
                            `).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modal.show();
}