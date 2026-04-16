
import base64
import os
from PIL import Image
import io

# Paths
base_path = r"c:\Users\Antonio\Desktop\DRA\Proyecto grupal\magicvs26"
image_path = os.path.join(base_path, "frontend", "src", "resources", "icono.png")
java_file_path = os.path.join(base_path, "backend", "src", "main", "java", "com", "magicvs", "backend", "service", "RegistrationVerificationService.java")

def process():
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return

    # Open image
    img = Image.open(image_path)
    print(f"Original size: {img.size}")

    # Resize to ~200px width keeping aspect ratio if it's too big
    max_width = 250
    if img.width > max_width:
        ratio = max_width / float(img.width)
        new_height = int(float(img.height) * ratio)
        img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
        print(f"Resized to: {img.size}")

    # Convert to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG", optimize=True)
    img_str = base64.b64encode(buffered.getvalue()).decode('utf-8')
    print(f"Base64 length: {len(img_str)}")

    # Read Java file
    with open(java_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the data:image/png;base64,... part and replace it
    # We look for src='data:image/png;base64, ... '
    import re
    pattern = r"src='data:image/png;base64,[^']*'"
    replacement = f"src='data:image/png;base64,{img_str}'"
    
    new_content = re.sub(pattern, replacement, content)

    if new_content == content:
        print("Warning: Pattern not found or content identical. Check the regex or file content.")
    
    with open(java_file_path, 'w', encoding='utf-8', newline='') as f:
        f.write(new_content)
    
    print("Successfully updated Java file.")

if __name__ == "__main__":
    process()
