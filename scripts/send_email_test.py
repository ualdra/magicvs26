import os
import smtplib
from email.message import EmailMessage

SMTP_USER = os.environ.get('SMTP_USER')
SMTP_PASS = os.environ.get('SMTP_PASS')
SMTP_FROM = os.environ.get('SMTP_FROM') or SMTP_USER

if not SMTP_USER or not SMTP_PASS:
    print('Missing SMTP_USER or SMTP_PASS environment variables')
    raise SystemExit(1)

msg = EmailMessage()
msg['Subject'] = 'Prueba de envío MagicVs'
msg['From'] = SMTP_FROM
msg['To'] = SMTP_USER
msg.set_content('Este es un email de prueba desde el script de tests.')

try:
    with smtplib.SMTP('smtp.gmail.com', 587, timeout=20) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASS)
        server.send_message(msg)
    print('Email enviado correctamente')
except Exception as e:
    print('Fallo al enviar email:', e)
    raise
