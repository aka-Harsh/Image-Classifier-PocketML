from flask import Flask, render_template, request, jsonify
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.optimizers import Adam
import numpy as np
import os
from PIL import Image
import io
import json

app = Flask(__name__)

# Set up GPU memory growth to avoid OOM errors
gpus = tf.config.experimental.list_physical_devices('GPU')
if gpus:
    try:
        for gpu in gpus:
            tf.config.experimental.set_memory_growth(gpu, True)
    except RuntimeError as e:
        print(e)

def create_model(num_classes):
    base_model = MobileNetV2(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    x = tf.keras.layers.GlobalAveragePooling2D()(base_model.output)
    x = tf.keras.layers.Dense(1024, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    output = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
    model = tf.keras.Model(inputs=base_model.input, outputs=output)
    
    for layer in base_model.layers:
        layer.trainable = False
    
    return model

def train_model(model, train_dir, epochs=10, batch_size=32):
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        fill_mode='nearest'
    )

    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=(224, 224),
        batch_size=batch_size,
        class_mode='categorical'
    )

    num_classes = len(train_generator.class_indices)
    if num_classes != model.output_shape[-1]:
        x = model.layers[-2].output
        output = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
        model = tf.keras.Model(inputs=model.input, outputs=output)

    model.compile(optimizer=Adam(learning_rate=0.001),
                  loss='categorical_crossentropy',
                  metrics=['accuracy'])

    history = model.fit(
        train_generator,
        steps_per_epoch=train_generator.samples // batch_size,
        epochs=epochs
    )

    return model, history, train_generator.class_indices

def predict_image(model, image_bytes, class_names):
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img = img.resize((224, 224))
        img_array = tf.keras.preprocessing.image.img_to_array(img)
        img_array = tf.expand_dims(img_array, 0)
        img_array /= 255.0

        predictions = model.predict(img_array)
        score = tf.nn.softmax(predictions[0])
        predicted_class = class_names[np.argmax(score)]
        confidence = 100 * np.max(score)

        return predicted_class, confidence
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return None, None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/create_folders', methods=['POST'])
def create_folders():
    folders = request.json['folders']
    for folder_name in folders:
        os.makedirs(f"data/{folder_name}", exist_ok=True)
    return jsonify({"message": "Folders created successfully!"})

@app.route('/upload_images', methods=['POST'])
def upload_images():
    images = request.files.getlist('images')
    folder_names = request.form.getlist('folder_names')
    
    for image, folder_name in zip(images, folder_names):
        image.save(os.path.join(f"data/{folder_name}", image.filename))
    
    return jsonify({"message": "Images uploaded successfully!"})

@app.route('/train_model', methods=['POST'])
def train_model_route():
    num_classes = len(os.listdir('data'))
    model = create_model(num_classes)
    trained_model, history, class_indices = train_model(model, "data")
    trained_model.save("trained_model.h5")
    
    with open("class_indices.json", "w") as f:
        json.dump(class_indices, f)
    
    return jsonify({"message": "Model trained successfully!"})

@app.route('/classify_image', methods=['POST'])
def classify_image():
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"})
    
    image = request.files['image']
    image_bytes = image.read()
    
    if not os.path.exists("trained_model.h5") or not os.path.exists("class_indices.json"):
        return jsonify({"error": "Please train the model first!"})
    
    model = tf.keras.models.load_model("trained_model.h5")
    
    with open("class_indices.json", "r") as f:
        class_indices = json.load(f)
    
    class_names = {int(v): k for k, v in class_indices.items()}
    
    predicted_class, confidence = predict_image(model, image_bytes, class_names)
    
    if predicted_class is not None:
        if confidence > 70:
            return jsonify({"prediction": predicted_class, "confidence": f"{confidence:.2f}%"})
        else:
            return jsonify({"warning": "Not an identical match"})
    else:
        return jsonify({"error": "Error processing image"})

if __name__ == '__main__':
    app.run(debug=True)