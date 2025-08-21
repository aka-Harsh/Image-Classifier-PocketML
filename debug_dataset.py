#!/usr/bin/env python3
"""
Debug script to check dataset structure and identify training issues
"""

import os
from tensorflow.keras.preprocessing.image import ImageDataGenerator

def debug_dataset(data_dir='data'):
    """Debug dataset structure and data generators"""
    
    print("🔍 Dataset Debug Information")
    print("=" * 50)
    
    # Check if data directory exists
    if not os.path.exists(data_dir):
        print(f"❌ Data directory '{data_dir}' does not exist!")
        return
    
    print(f"📁 Data directory: {data_dir}")
    
    # List all items in data directory
    items = os.listdir(data_dir)
    print(f"📋 Contents: {items}")
    
    # Check each subdirectory
    total_images = 0
    class_info = {}
    
    for item in items:
        item_path = os.path.join(data_dir, item)
        if os.path.isdir(item_path):
            # Count images in this class folder
            image_files = [f for f in os.listdir(item_path) 
                          if f.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp', '.gif'))]
            image_count = len(image_files)
            total_images += image_count
            class_info[item] = {
                'count': image_count,
                'files': image_files[:5]  # Show first 5 files
            }
            
            print(f"📂 Class '{item}': {image_count} images")
            if image_count > 0:
                print(f"   Sample files: {image_files[:3]}")
            else:
                print(f"   ⚠️  No images found!")
    
    print(f"\n📊 Total: {total_images} images across {len(class_info)} classes")
    
    if total_images == 0:
        print("❌ No images found! Please upload images to class folders.")
        return
    
    # Test data generators with different configurations
    print(f"\n🧪 Testing Data Generators")
    print("-" * 30)
    
    configs = [
        {'batch_size': 1, 'validation_split': 0.1},
        {'batch_size': 2, 'validation_split': 0.1},
        {'batch_size': 4, 'validation_split': 0.15},
        {'batch_size': 8, 'validation_split': 0.2}
    ]
    
    for i, config in enumerate(configs):
        try:
            print(f"\n🔧 Config {i+1}: batch_size={config['batch_size']}, validation_split={config['validation_split']}")
            
            # Create data generators
            train_datagen = ImageDataGenerator(
                rescale=1./255,
                validation_split=config['validation_split']
            )
            
            train_generator = train_datagen.flow_from_directory(
                data_dir,
                target_size=(224, 224),
                batch_size=config['batch_size'],
                class_mode='categorical',
                subset='training',
                shuffle=True
            )
            
            validation_generator = train_datagen.flow_from_directory(
                data_dir,
                target_size=(224, 224),
                batch_size=config['batch_size'],
                class_mode='categorical',
                subset='validation',
                shuffle=False
            )
            
            print(f"   ✅ Training samples: {train_generator.samples}")
            print(f"   ✅ Validation samples: {validation_generator.samples}")
            print(f"   ✅ Steps per epoch: {max(1, train_generator.samples // config['batch_size'])}")
            print(f"   ✅ Validation steps: {max(1, validation_generator.samples // config['batch_size']) if validation_generator.samples > 0 else 0}")
            
            # Try to get one batch
            try:
                batch_x, batch_y = next(train_generator)
                print(f"   ✅ Successfully loaded batch: {batch_x.shape}, {batch_y.shape}")
                
                # Reset generator
                train_generator.reset()
                
                # This config works!
                print(f"   🎉 This configuration works!")
                break
                
            except Exception as batch_error:
                print(f"   ❌ Error loading batch: {batch_error}")
                
        except Exception as gen_error:
            print(f"   ❌ Error creating generators: {gen_error}")
    
    print(f"\n💡 Recommendations:")
    print(f"   - Minimum 10-20 images per class for good results")
    print(f"   - Use batch_size <= {total_images // 4} for this dataset")
    print(f"   - Consider validation_split <= 0.15 for small datasets")

if __name__ == "__main__":
    debug_dataset()