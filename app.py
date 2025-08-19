"""
Enhanced Multi-Model Image Classification Flask Application
Supports MobileNetV2, ResNet50, EfficientNetB0, and DenseNet121
"""

import os
import json
import time
import threading
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, session
import tensorflow as tf
import numpy as np
from werkzeug.utils import secure_filename

# Import utility modules
from utils.model_factory import ModelFactory
from utils.training_utils import TrainingPipeline
from utils.prediction_utils import MultiModelPredictor
from utils.analytics_utils import AnalyticsUtils

# Initialize Flask app
app = Flask(__name__)
app.secret_key = 'your-secret-key-change-this-in-production'

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MODELS_FOLDER'] = 'models'
app.config['METRICS_FOLDER'] = 'metrics'
app.config['DATA_FOLDER'] = 'data'

# Create necessary directories
for folder in [app.config['UPLOAD_FOLDER'], app.config['MODELS_FOLDER'], 
               app.config['METRICS_FOLDER'], app.config['DATA_FOLDER']]:
    os.makedirs(folder, exist_ok=True)

# GPU Configuration
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
        print(f"✅ GPU configured: {len(gpus)} GPU(s) available")
    except RuntimeError as e:
        print(f"⚠️ GPU configuration error: {e}")
else:
    print("⚠️ No GPU detected, using CPU")

# Initialize global components
training_pipeline = TrainingPipeline(
    data_dir=app.config['DATA_FOLDER'],
    models_dir=app.config['MODELS_FOLDER'],
    metrics_dir=app.config['METRICS_FOLDER']
)

# Initialize predictor (will handle missing class indices gracefully)
try:
    predictor = MultiModelPredictor(
        models_dir=app.config['MODELS_FOLDER'],
        metrics_dir=app.config['METRICS_FOLDER']
    )
    print("✅ Predictor initialized successfully")
except Exception as e:
    print(f"⚠️  Predictor initialization warning: {e}")
    predictor = None

analytics_utils = AnalyticsUtils(app.config['METRICS_FOLDER'])

# Global training status
training_status = {
    'is_training': False,
    'current_model': None,
    'progress': {},
    'start_time': None,
    'selected_models': []
}

@app.route('/')
def index():
    """Main interface for dataset setup and training"""
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    """Multi-model prediction results dashboard"""
    return render_template('dashboard.html')

@app.route('/analytics')
def analytics():
    """Training metrics and analytics visualization"""
    available_models = get_trained_models()
    return render_template('analytics.html', models=available_models)

# ==================== Dataset Management Routes ====================

@app.route('/api/create_folders', methods=['POST'])
def create_folders():
    """Create class folders for training data"""
    try:
        data = request.get_json()
        folders = data.get('folders', [])
        
        if not folders:
            return jsonify({'error': 'No folders specified'}), 400
        
        created_folders = []
        for folder_name in folders:
            folder_name = secure_filename(folder_name)
            if folder_name:
                folder_path = os.path.join(app.config['DATA_FOLDER'], folder_name)
                os.makedirs(folder_path, exist_ok=True)
                created_folders.append(folder_name)
        
        session['class_folders'] = created_folders
        
        return jsonify({
            'message': f'Successfully created {len(created_folders)} folders',
            'folders': created_folders
        })
        
    except Exception as e:
        return jsonify({'error': f'Error creating folders: {str(e)}'}), 500

@app.route('/api/upload_images', methods=['POST'])
def upload_images():
    """Upload training images to class folders"""
    try:
        images = request.files.getlist('images')
        folder_names = request.form.getlist('folder_names')
        
        if not images or not folder_names:
            return jsonify({'error': 'No images or folder names provided'}), 400
        
        uploaded_count = 0
        errors = []
        
        for image, folder_name in zip(images, folder_names):
            if image and image.filename:
                try:
                    filename = secure_filename(image.filename)
                    folder_path = os.path.join(app.config['DATA_FOLDER'], folder_name)
                    
                    if not os.path.exists(folder_path):
                        os.makedirs(folder_path, exist_ok=True)
                    
                    file_path = os.path.join(folder_path, filename)
                    image.save(file_path)
                    uploaded_count += 1
                    
                except Exception as e:
                    errors.append(f'Error uploading {image.filename}: {str(e)}')
        
        response_data = {
            'message': f'Successfully uploaded {uploaded_count} images',
            'uploaded_count': uploaded_count
        }
        
        if errors:
            response_data['warnings'] = errors
        
        return jsonify(response_data)
        
    except Exception as e:
        return jsonify({'error': f'Error uploading images: {str(e)}'}), 500

@app.route('/api/dataset_info')
def dataset_info():
    """Get information about the current dataset"""
    try:
        dataset_info = {}
        total_images = 0
        
        if os.path.exists(app.config['DATA_FOLDER']):
            for item in os.listdir(app.config['DATA_FOLDER']):
                item_path = os.path.join(app.config['DATA_FOLDER'], item)
                # Only process directories, ignore files like info.txt
                if os.path.isdir(item_path):
                    image_count = len([f for f in os.listdir(item_path) 
                                     if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif'))])
                    if image_count > 0:  # Only count classes with images
                        dataset_info[item] = image_count
                        total_images += image_count
        
        return jsonify({
            'classes': dataset_info,
            'total_images': total_images,
            'num_classes': len(dataset_info)
        })
        
    except Exception as e:
        return jsonify({'error': f'Error getting dataset info: {str(e)}'}), 500

# ==================== Training Routes ====================

@app.route('/api/start_training', methods=['POST'])
def start_training():
    """Start training process for selected models"""
    global training_status
    
    if training_status['is_training']:
        return jsonify({'error': 'Training is already in progress'}), 400
    
    try:
        data = request.get_json()
        selected_models = data.get('models', list(ModelFactory.SUPPORTED_MODELS.keys()))
        
        # Validate selected models
        valid_models = [m for m in selected_models if m in ModelFactory.SUPPORTED_MODELS]
        if not valid_models:
            return jsonify({'error': 'No valid models selected'}), 400
        
        # Check if dataset exists
        if not os.path.exists(app.config['DATA_FOLDER']) or not os.listdir(app.config['DATA_FOLDER']):
            return jsonify({'error': 'No training data found. Please upload images first.'}), 400
        
        # Initialize training status
        training_status.update({
            'is_training': True,
            'current_model': None,
            'progress': {model: {'status': 'pending', 'epochs': 0, 'accuracy': 0} 
                        for model in valid_models},
            'start_time': datetime.now().isoformat(),
            'selected_models': valid_models
        })
        
        # Start training in background thread
        training_thread = threading.Thread(
            target=background_training,
            args=(valid_models,)
        )
        training_thread.daemon = True
        training_thread.start()
        
        return jsonify({
            'message': 'Training started successfully',
            'models': valid_models,
            'estimated_time': len(valid_models) * 10  # Rough estimate: 10 min per model
        })
        
    except Exception as e:
        training_status['is_training'] = False
        return jsonify({'error': f'Error starting training: {str(e)}'}), 500

def background_training(selected_models):
    """Background training function"""
    global training_status
    
    try:
        print(f"🚀 Starting background training for models: {selected_models}")
        
        # Train all selected models
        results = training_pipeline.train_all_models(selected_models)
        
        # Update training status with results
        for model_type, result in results.items():
            if model_type in training_status['progress']:
                if result['status'] == 'success':
                    training_status['progress'][model_type].update({
                        'status': 'completed',
                        'accuracy': result.get('final_accuracy', 0) * 100
                    })
                else:
                    training_status['progress'][model_type].update({
                        'status': 'error',
                        'error': result.get('error', 'Unknown error')
                    })
        
        training_status['is_training'] = False
        training_status['current_model'] = None
        print("✅ Background training completed")
        
    except Exception as e:
        print(f"❌ Background training error: {str(e)}")
        training_status.update({
            'is_training': False,
            'current_model': None,
            'error': str(e)
        })

@app.route('/api/training_status')
def get_training_status():
    """Get current training status"""
    global training_status
    
    # Update progress from saved files if training is active
    if training_status['is_training']:
        for model_type in training_status['selected_models']:
            progress_file = os.path.join(app.config['METRICS_FOLDER'], f"{model_type}_progress.json")
            if os.path.exists(progress_file):
                try:
                    with open(progress_file, 'r') as f:
                        progress_data = json.load(f)
                    
                    if progress_data['epochs']:
                        current_epoch = len(progress_data['epochs'])
                        latest_accuracy = progress_data['val_accuracy'][-1] if progress_data['val_accuracy'] else 0
                        
                        training_status['progress'][model_type].update({
                            'status': 'training',
                            'epochs': current_epoch,
                            'accuracy': latest_accuracy * 100
                        })
                        training_status['current_model'] = model_type
                        
                except Exception as e:
                    print(f"Error reading progress for {model_type}: {e}")
    
    return jsonify(training_status)

@app.route('/api/stop_training', methods=['POST'])
def stop_training():
    """Stop training process (best effort)"""
    global training_status
    
    training_status.update({
        'is_training': False,
        'current_model': None
    })
    
    return jsonify({'message': 'Training stop signal sent'})

# ==================== Prediction Routes ====================

@app.route('/api/predict', methods=['POST'])
def predict_image():
    """Make predictions using all available models"""
    global predictor
    
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image file selected'}), 400
        
        # Reinitialize predictor if it wasn't available at startup
        if predictor is None:
            try:
                predictor = MultiModelPredictor(
                    models_dir=app.config['MODELS_FOLDER'],
                    metrics_dir=app.config['METRICS_FOLDER']
                )
            except Exception as e:
                return jsonify({'error': 'No trained models available. Please train models first.'}), 400
        
        # Save uploaded image temporarily
        filename = secure_filename(image_file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_{int(time.time())}_{filename}")
        image_file.save(filepath)
        
        try:
            # Load models if not already loaded
            loading_status = predictor.load_all_models()
            loaded_models = [model for model, status in loading_status.items() if status == 'loaded']
            
            if not loaded_models:
                return jsonify({'error': 'No trained models available. Please train models first.'}), 400
            
            # Make predictions
            individual_results, ensemble_result = predictor.predict_all_models(filepath)
            
            # Clean up temporary file
            os.remove(filepath)
            
            if not individual_results:
                return jsonify({'error': 'Failed to make predictions'}), 500
            
            # Format results for frontend
            formatted_results = []
            for result in individual_results:
                formatted_results.append({
                    'model_name': result.model_name,
                    'model_display_name': result.model_display_name,
                    'predicted_class': result.predicted_class,
                    'confidence': round(result.confidence, 2),
                    'all_probabilities': {k: round(v, 2) for k, v in result.all_probabilities.items()},
                    'prediction_time': round(result.prediction_time * 1000, 1),  # Convert to ms
                    'model_params': result.model_params,
                    'model_speed': result.model_speed
                })
            
            # Format ensemble result
            ensemble_data = None
            if ensemble_result:
                ensemble_data = {
                    'predicted_class': ensemble_result.predicted_class,
                    'confidence': round(ensemble_result.confidence, 2),
                    'model_agreement': round(ensemble_result.model_agreement, 1),
                    'voting_results': ensemble_result.voting_results,
                    'average_probabilities': {k: round(v, 2) for k, v in ensemble_result.average_probabilities.items()}
                }
            
            # Generate explanation
            explanation = predictor.get_prediction_explanation(individual_results, ensemble_result)
            
            # Confidence analysis
            confidence_analysis = predictor.analyze_prediction_confidence(individual_results)
            
            return jsonify({
                'success': True,
                'individual_results': formatted_results,
                'ensemble_result': ensemble_data,
                'explanation': explanation,
                'confidence_analysis': {
                    'avg_confidence': round(confidence_analysis.get('avg_confidence', 0), 1),
                    'confidence_level': confidence_analysis.get('confidence_level', 'Unknown'),
                    'class_consensus': confidence_analysis.get('unanimous_prediction', False),
                    'confidence_range': round(confidence_analysis.get('confidence_range', 0), 1)
                },
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            # Clean up temporary file if it exists
            if os.path.exists(filepath):
                os.remove(filepath)
            raise e
            
    except Exception as e:
        return jsonify({'error': f'Prediction error: {str(e)}'}), 500

@app.route('/api/models/available')
def get_available_models():
    """Get information about available models"""
    global predictor
    
    try:
        # Reinitialize predictor if needed
        if predictor is None:
            try:
                predictor = MultiModelPredictor(
                    models_dir=app.config['MODELS_FOLDER'],
                    metrics_dir=app.config['METRICS_FOLDER']
                )
            except:
                # If predictor can't be initialized, create a minimal response
                model_info = ModelFactory.get_model_info()
                available_models = {}
                
                for model_type, info in model_info.items():
                    model_path = os.path.join(app.config['MODELS_FOLDER'], f"{model_type}_model.h5")
                    status = 'available' if os.path.exists(model_path) else 'not_trained'
                    
                    available_models[model_type] = {
                        **info,
                        'status': status,
                        'loading_status': 'not_loaded',
                        'model_path': model_path
                    }
                
                return jsonify(available_models)
        
        available_models = predictor.get_available_models()
        training_status_info = training_pipeline.get_training_status()
        
        # Combine information
        for model_type in available_models:
            available_models[model_type]['training_status'] = training_status_info.get(model_type, 'unknown')
        
        return jsonify(available_models)
        
    except Exception as e:
        return jsonify({'error': f'Error getting model info: {str(e)}'}), 500

# ==================== Analytics Routes ====================

@app.route('/api/analytics/metrics/<model_name>')
def get_model_metrics(model_name):
    """Get training metrics for a specific model"""
    try:
        metrics_file = os.path.join(app.config['METRICS_FOLDER'], f"{model_name}_metrics.json")
        
        if not os.path.exists(metrics_file):
            return jsonify({'error': f'Metrics not found for {model_name}'}), 404
        
        with open(metrics_file, 'r') as f:
            metrics = json.load(f)
        
        return jsonify(metrics)
        
    except Exception as e:
        return jsonify({'error': f'Error loading metrics: {str(e)}'}), 500

@app.route('/api/analytics/comparison')
def get_model_comparison():
    """Get comparison data for all trained models"""
    try:
        comparison_data = []
        
        for model_type in ModelFactory.SUPPORTED_MODELS.keys():
            metrics_file = os.path.join(app.config['METRICS_FOLDER'], f"{model_type}_metrics.json")
            if os.path.exists(metrics_file):
                with open(metrics_file, 'r') as f:
                    metrics = json.load(f)
                
                summary = metrics.get('summary', {})
                comparison_data.append({
                    'model': model_type,
                    'model_name': ModelFactory.SUPPORTED_MODELS[model_type],
                    'best_accuracy': summary.get('best_val_accuracy', 0) * 100,
                    'final_accuracy': summary.get('final_accuracy', 0) * 100,
                    'training_time': metrics.get('training_time', 0),
                    'total_epochs': summary.get('total_epochs', 0),
                    'status': 'completed' if summary else 'not_trained'
                })
        
        # Generate rankings
        rankings = analytics_utils.get_model_rankings(app.config['METRICS_FOLDER'])
        
        return jsonify({
            'comparison_data': comparison_data,
            'rankings': rankings
        })
        
    except Exception as e:
        return jsonify({'error': f'Error generating comparison: {str(e)}'}), 500

@app.route('/api/analytics/plots/<plot_name>')
def get_plot(plot_name):
    """Serve analytics plot images"""
    try:
        plot_path = os.path.join(app.config['METRICS_FOLDER'], f"{plot_name}.png")
        
        if not os.path.exists(plot_path):
            return jsonify({'error': 'Plot not found'}), 404
        
        return send_file(plot_path, mimetype='image/png')
        
    except Exception as e:
        return jsonify({'error': f'Error serving plot: {str(e)}'}), 500

@app.route('/api/analytics/generate_report')
def generate_analytics_report():
    """Generate comprehensive analytics report"""
    try:
        report_path = analytics_utils.generate_training_report(app.config['METRICS_FOLDER'])
        
        if report_path and os.path.exists(report_path):
            return jsonify({
                'success': True,
                'message': 'Report generated successfully',
                'report_url': f"/api/analytics/plots/comprehensive_training_report"
            })
        else:
            return jsonify({'error': 'Failed to generate report'}), 500
            
    except Exception as e:
        return jsonify({'error': f'Error generating report: {str(e)}'}), 500

# ==================== Model Download Routes ====================

@app.route('/api/download/model/<model_name>')
def download_model(model_name):
    """Download trained model file"""
    try:
        if model_name not in ModelFactory.SUPPORTED_MODELS:
            return jsonify({'error': 'Invalid model name'}), 400
        
        model_path = os.path.join(app.config['MODELS_FOLDER'], f"{model_name}_model.h5")
        
        if not os.path.exists(model_path):
            return jsonify({'error': f'Model {model_name} not found'}), 404
        
        return send_file(
            model_path,
            as_attachment=True,
            download_name=f"{model_name}_model.h5",
            mimetype='application/octet-stream'
        )
        
    except Exception as e:
        return jsonify({'error': f'Error downloading model: {str(e)}'}), 500

@app.route('/api/download/metrics/<model_name>')
def download_metrics(model_name):
    """Download model training metrics"""
    try:
        if model_name not in ModelFactory.SUPPORTED_MODELS:
            return jsonify({'error': 'Invalid model name'}), 400
        
        metrics_path = os.path.join(app.config['METRICS_FOLDER'], f"{model_name}_metrics.json")
        
        if not os.path.exists(metrics_path):
            return jsonify({'error': f'Metrics for {model_name} not found'}), 404
        
        return send_file(
            metrics_path,
            as_attachment=True,
            download_name=f"{model_name}_metrics.json",
            mimetype='application/json'
        )
        
    except Exception as e:
        return jsonify({'error': f'Error downloading metrics: {str(e)}'}), 500

# ==================== Helper Functions ====================

def get_trained_models():
    """Get list of trained models"""
    trained_models = []
    
    for model_type in ModelFactory.SUPPORTED_MODELS.keys():
        model_path = os.path.join(app.config['MODELS_FOLDER'], f"{model_type}_model.h5")
        if os.path.exists(model_path):
            trained_models.append({
                'type': model_type,
                'name': ModelFactory.SUPPORTED_MODELS[model_type],
                'info': ModelFactory.get_model_info()[model_type]
            })
    
    return trained_models

# ==================== Error Handlers ====================

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 16MB.'}), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({'error': 'Resource not found'}), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({'error': 'Internal server error'}), 500

# ==================== Main ====================

if __name__ == '__main__':
    print("🚀 Starting Enhanced Multi-Model Image Classifier")
    print(f"📁 Data folder: {app.config['DATA_FOLDER']}")
    print(f"🤖 Models folder: {app.config['MODELS_FOLDER']}")
    print(f"📊 Metrics folder: {app.config['METRICS_FOLDER']}")
    print("🌐 Starting Flask server...")
    
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)