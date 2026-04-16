import os

path = r'c:\Users\Antonio\Desktop\DRA\Proyecto grupal\magicvs26\backend\src\main\java\com\magicvs\backend\service\RegistrationVerificationService.java'

if not os.path.exists(path):
    print(f"Error: {path} no existe.")
    exit(1)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Arreglar comillas dobles anidadas en el HTML del logo
# Buscamos las partes problemáticas y las pasamos a comillas simples
fixed = content.replace('<div style="text-align: center; margin-bottom: 30px;">', "<div style='text-align: center; margin-bottom: 30px;'>")
fixed = fixed.replace('<img src="data:image/png;base64,', "<img src='data:image/png;base64,")
# El cierre del tag img tiene muchas variantes de comillas fallidas
fixed = fixed.replace('" width="220" alt="MagicVS Logo" style="display: inline-block; border: 0;">', "' width='220' alt='MagicVS Logo' style='display: inline-block; border: 0;'>")

with open(path, 'w', encoding='utf-8') as f:
    f.write(fixed)

print("Java corregido con éxito.")
