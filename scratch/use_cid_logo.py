
import re
import os

java_file_path = r"c:\Users\Antonio\Desktop\DRA\Proyecto grupal\magicvs26\backend\src\main\java\com\magicvs\backend\service\RegistrationVerificationService.java"

def fix_java_logo_src():
    if not os.path.exists(java_file_path):
        print(f"Error: File not found at {java_file_path}")
        return

    with open(java_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find <img src='data:image/png;base64,...' ...>
    # We look for the base64 start and go until the next single quote
    pattern = r"src='data:image/png;base64,[^']*'"
    replacement = "src='cid:logo'"
    
    new_content = re.sub(pattern, replacement, content)

    if new_content == content:
        print("Warning: No matches found for the Base64 src pattern.")
    else:
        num_matches = len(re.findall(pattern, content))
        print(f"Found and replaced {num_matches} Base64 image tags.")
        
    with open(java_file_path, 'w', encoding='utf-8', newline='') as f:
        f.write(new_content)
    
    print("Successfully updated RegistrationVerificationService.java with CID references.")

if __name__ == "__main__":
    fix_java_logo_src()
