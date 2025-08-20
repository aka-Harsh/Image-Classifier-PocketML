/**
 * Analytics Dashboard JavaScript
 */

document.addEventListener('DOMContentLoaded', function() {
    loadAnalytics();
});

function loadAnalytics() {
    loadQuickStats();
    loadComparisonChart();
    loadIndividualCharts();
}

function loadQuickStats() {
    fetch('/api/analytics/comparison')
        .then(response => response.json())
        .then(data => {
            displayQuickStats(data.comparison_data);
        })
        .catch(error => {
            document.getElementById('quickStats').innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle me-2"></i>
                        Error loading analytics: ${error.message}
                    </div>
                </div>
            `;
        });
}

function displayQuickStats(data) {
    const container = document.getElementById('quickStats');
    
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="alert alert-warning">
                    <i class="bi bi-info-circle me-2"></i>
                    No training data available. Please train models first.
                </div>
            </div>
        `;
        return;
    }
    
    const trainedModels = data.filter(model => model.status === 'completed');
    const bestModel = trainedModels.reduce((best, current) => 
        current.best_accuracy > best.best_accuracy ? current : best
    );
    const avgAccuracy = trainedModels.reduce((sum, model) => sum + model.best_accuracy, 0) / trainedModels.length;
    const totalTrainingTime = trainedModels.reduce((sum, model) => sum + model.training_time, 0);
    
    container.innerHTML = `
        <div class="col-md-3">
            <div class="card bg-dark border-primary text-center">
                <div class="card-body">
                    <i class="bi bi-trophy-fill text-warning fs-1 mb-2"></i>
                    <h6 class="card-title text-muted">Best Model</h6>
                    <div class="fs-4 fw-bold text-primary">${bestModel.model_name}</div>
                    <small class="text-success">${bestModel.best_accuracy.toFixed(1)}% accuracy</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-dark border-success text-center">
                <div class="card-body">
                    <i class="bi bi-bullseye text-success fs-1 mb-2"></i>
                    <h6 class="card-title text-muted">Average Accuracy</h6>
                    <div class="fs-4 fw-bold text-success">${avgAccuracy.toFixed(1)}%</div>
                    <small class="text-muted">Across ${trainedModels.length} models</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-dark border-info text-center">
                <div class="card-body">
                    <i class="bi bi-stopwatch text-info fs-1 mb-2"></i>
                    <h6 class="card-title text-muted">Total Training Time</h6>
                    <div class="fs-4 fw-bold text-info">${formatTime(totalTrainingTime)}</div>
                    <small class="text-muted">${trainedModels.length} models trained</small>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card bg-dark border-warning text-center">
                <div class="card-body">
                    <i class="bi bi-cpu-fill text-warning fs-1 mb-2"></i>
                    <h6 class="card-title text-muted">Models Ready</h6>
                    <div class="fs-4 fw-bold text-warning">${trainedModels.length}/4</div>
                    <small class="text-muted">Available for prediction</small>
                </div>
            </div>
        </div>
    `;
}

function loadComparisonChart() {
    const img = document.getElementById('comparisonChart');
    const loading = document.getElementById('comparisonChartLoading');
    
    img.style.display = 'none';
    loading.style.display = 'block';
    
    img.onload = function() {
        loading.style.display = 'none';
        img.style.display = 'block';
    };
    
    img.onerror = function() {
        loading.innerHTML = `
            <div class="alert alert-warning">
                <i class="bi bi-exclamation-triangle me-2"></i>
                Comparison chart not available. Train models to generate charts.
            </div>
        `;
    };
    
    img.src = `/api/analytics/plots/model_comparison?t=${Date.now()}`;
}

function loadIndividualCharts() {
    const models = ['mobilenet', 'resnet', 'efficientnet', 'densenet'];
    const container = document.getElementById('individualCharts');
    
    let html = '';
    
    models.forEach(modelType => {
        html += `
            <div class="col-md-6">
                <div class="card bg-dark border-secondary">
                    <div class="card-header bg-transparent border-secondary">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="mb-0 text-primary">${modelType.toUpperCase()} Training History</h6>
                            <div class="btn-group btn-group-sm" role="group">
                                <button class="btn btn-outline-info" onclick="downloadModelMetrics('${modelType}')">
                                    <i class="bi bi-download"></i>
                                </button>
                                <button class="btn btn-outline-success" onclick="downloadModel('${modelType}')">
                                    <i class="bi bi-collection"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="card-body text-center">
                        <img id="chart-${modelType}" class="img-fluid" style="max-height: 300px;" alt="${modelType} Training Chart">
                        <div id="loading-${modelType}" class="text-muted">
                            <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                            Loading ${modelType} chart...
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Load individual charts
    models.forEach(modelType => {
        loadModelChart(modelType);
    });
}

function loadModelChart(modelType) {
    const img = document.getElementById(`chart-${modelType}`);
    const loading = document.getElementById(`loading-${modelType}`);
    
    img.style.display = 'none';
    loading.style.display = 'block';
    
    img.onload = function() {
        loading.style.display = 'none';
        img.style.display = 'block';
    };
    
    img.onerror = function() {
        loading.innerHTML = `
            <div class="alert alert-secondary">
                <i class="bi bi-info-circle me-2"></i>
                ${modelType.toUpperCase()} not trained yet
            </div>
        `;
    };
    
    img.src = `/api/analytics/plots/${modelType}_training_history?t=${Date.now()}`;
}

function generateReport() {
    showToast('Generating comprehensive training report...', 'info');
    
    fetch('/api/analytics/generate_report')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Report generated successfully!', 'success');
                // Refresh comparison chart to show the new report
                setTimeout(() => {
                    loadComparisonChart();
                }, 1000);
            } else {
                showToast(data.error || 'Failed to generate report', 'danger');
            }
        })
        .catch(error => {
            showToast('Error generating report: ' + error.message, 'danger');
        });
}

function downloadAllModels() {
    showToast('Preparing model downloads...', 'info');
    
    const models = ['mobilenet', 'resnet', 'efficientnet', 'densenet'];
    let downloadCount = 0;
    
    models.forEach(modelType => {
        // Check if model exists before downloading
        fetch(`/api/download/model/${modelType}`, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    const link = document.createElement('a');
                    link.href = `/api/download/model/${modelType}`;
                    link.download = `${modelType}_model.h5`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    downloadCount++;
                }
            })
            .catch(error => {
                console.log(`Model ${modelType} not available`);
            });
    });
    
    setTimeout(() => {
        if (downloadCount > 0) {
            showToast(`Started ${downloadCount} model downloads`, 'success');
        } else {
            showToast('No trained models available for download', 'warning');
        }
    }, 1000);
}

function downloadAllMetrics() {
    showToast('Preparing metrics downloads...', 'info');
    
    const models = ['mobilenet', 'resnet', 'efficientnet', 'densenet'];
    let downloadCount = 0;
    
    models.forEach(modelType => {
        fetch(`/api/download/metrics/${modelType}`, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    const link = document.createElement('a');
                    link.href = `/api/download/metrics/${modelType}`;
                    link.download = `${modelType}_metrics.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    downloadCount++;
                }
            })
            .catch(error => {
                console.log(`Metrics for ${modelType} not available`);
            });
    });
    
    setTimeout(() => {
        if (downloadCount > 0) {
            showToast(`Started ${downloadCount} metrics downloads`, 'success');
        } else {
            showToast('No metrics available for download', 'warning');
        }
    }, 1000);
}

function downloadReport() {
    const link = document.createElement('a');
    link.href = '/api/analytics/plots/comprehensive_training_report';
    link.download = 'comprehensive_training_report.png';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Training report download started', 'success');
}

function downloadCharts() {
    showToast('Preparing chart downloads...', 'info');
    
    const charts = [
        'model_comparison',
        'mobilenet_training_history',
        'resnet_training_history',
        'efficientnet_training_history',
        'densenet_training_history'
    ];
    
    let downloadCount = 0;
    
    charts.forEach(chartName => {
        fetch(`/api/analytics/plots/${chartName}`, { method: 'HEAD' })
            .then(response => {
                if (response.ok) {
                    const link = document.createElement('a');
                    link.href = `/api/analytics/plots/${chartName}`;
                    link.download = `${chartName}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    downloadCount++;
                }
            })
            .catch(error => {
                console.log(`Chart ${chartName} not available`);
            });
    });
    
    setTimeout(() => {
        if (downloadCount > 0) {
            showToast(`Started ${downloadCount} chart downloads`, 'success');
        } else {
            showToast('No charts available for download', 'warning');
        }
    }, 1000);
}

function downloadModel(modelType) {
    const link = document.createElement('a');
    link.href = `/api/download/model/${modelType}`;
    link.download = `${modelType}_model.h5`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`${modelType.toUpperCase()} model download started`, 'success');
}

function downloadModelMetrics(modelType) {
    const link = document.createElement('a');
    link.href = `/api/download/metrics/${modelType}`;
    link.download = `${modelType}_metrics.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`${modelType.toUpperCase()} metrics download started`, 'success');
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${remainingSeconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
}