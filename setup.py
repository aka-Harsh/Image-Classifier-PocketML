#!/usr/bin/env python3
"""
Setup script for Enhanced Multi-Model Image Classifier
This script creates the project structure and initializes the application
"""

import os
import sys
from pathlib import Path

def create_directory_structure():
    """Create the required directory structure"""
    
    directories = [
        'models',
        'data', 
        'metrics',
        'uploads',
        'templates',
        'static/css',
        'static/js', 
        'static/img',
        'utils'
    ]
    
    print("🏗️  Creating directory structure...")
    
    for directory in directories:
        Path(directory).mkdir(parents=True, exist_ok=True)
        print(f"   ✅ Created: {directory}/")
    
    # Create __init__.py files
    init_files = [
        'models/__init__.py',
        'metrics/__init__.py', 
        'uploads/__init__.py',
        'utils/__init__.py'
    ]
    
    for init_file in init_files:
        Path(init_file).touch()
        print(f"   ✅ Created: {init_file}")
    
    # Create .gitkeep files for empty directories
    gitkeep_files = [
        'data/.gitkeep',
        'uploads/.gitkeep',
        'static/img/.gitkeep'
    ]
    
    for gitkeep_file in gitkeep_files:
        Path(gitkeep_file).touch()
        print(f"   ✅ Created: {gitkeep_file}")

def check_python_version():
    """Check Python version compatibility"""
    
    print("🐍 Checking Python version...")
    
    if sys.version_info < (3, 8):
        print("   ❌ Python 3.8 or higher required!")
        print(f"   Current version: {sys.version}")
        return False
    
    print(f"   ✅ Python {sys.version_info.major}.{sys.version_info.minor} - Compatible")
    return True

def create_virtual_environment():
    """Create virtual environment"""
    
    print("📦 Setting up virtual environment...")
    
    if Path('venv').exists():
        print("   ⚠️  Virtual environment already exists")
        return True
    
    try:
        import venv
        venv.create('venv', with_pip=True)
        print("   ✅ Virtual environment created successfully")
        return True
    except Exception as e:
        print(f"   ❌ Failed to create virtual environment: {e}")
        return False

def print_next_steps():
    """Print next steps for the user"""
    
    print("\n" + "="*60)
    print("🎉 SETUP COMPLETE!")
    print("="*60)
    
    print("\n📋 NEXT STEPS:")
    print("\n1️⃣  Activate virtual environment:")
    if os.name == 'nt':  # Windows
        print("   venv\\Scripts\\activate")
    else:  # macOS/Linux
        print("   source venv/bin/activate")
    
    print("\n2️⃣  Install dependencies:")
    print("   pip install -r requirements.txt")
    
    print("\n3️⃣  Run the application:")
    print("   python app.py")
    
    print("\n4️⃣  Open your browser:")
    print("   http://localhost:5000")
    
    print("\n📚 USAGE GUIDE:")
    print("   1. Create class folders and upload training images")
    print("   2. Select models and start training")
    print("   3. Use the prediction dashboard to test your models")
    print("   4. Analyze results in the analytics dashboard")
    
    print("\n🔧 REQUIREMENTS:")
    print("   - Python 3.8+")
    print("   - 8GB+ RAM recommended")
    print("   - CUDA GPU (optional, for faster training)")
    print("   - 5GB+ free disk space")
    
    print("\n🆘 NEED HELP?")
    print("   - Check the README.md file")
    print("   - Ensure all files are in the correct directories")
    print("   - Verify virtual environment is activated before installing packages")

def main():
    """Main setup function"""
    
    print("🚀 Enhanced Multi-Model Image Classifier Setup")
    print("="*50)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Create directory structure
    create_directory_structure()
    
    # Create virtual environment
    if not create_virtual_environment():
        print("   ⚠️  You can create it manually: python -m venv venv")
    
    # Print next steps
    print_next_steps()

if __name__ == "__main__":
    main()